import test from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { normalizeAvatar, createAvatarNormalizer } from "../dist/profile/avatar-codec.js";
import { serve } from "./helpers/http.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  pngImage,
  jpegImage,
  chunk,
  changeHeader,
  orientedJpeg,
} from "./helpers/avatar-images.mjs";
const status = (code) => (error) => error.status === code;
test("avatar re-encoding bounds output, preserves PNG alpha and removes original metadata", async () => {
  const raw = pngImage(800, 400),
    withText = Buffer.concat([
      raw.subarray(0, 33),
      chunk("tEXt", Buffer.from("private metadata")),
      raw.subarray(33),
    ]);
  const image = await normalizeAvatar(withText, "image/png");
  assert.equal(image.width, 512);
  assert.equal(image.height, 256);
  assert.equal(image.format, "png");
  assert.ok(!image.bytes.includes(Buffer.from("private metadata")));
  const small = await normalizeAvatar(jpegImage(), "image/jpeg");
  assert.equal(small.width, 40);
  assert.equal(small.height, 60);
  const transparent = new PNG({ width: 1, height: 1 });
  transparent.data = Buffer.from([255, 0, 0, 0]);
  const alpha = await normalizeAvatar(PNG.sync.write(transparent), "image/png");
  assert.equal(PNG.sync.read(alpha.bytes).data[3], 0);
});
test("invalid signature/MIME, size, CRC, APNG, encoding and dimension bombs are rejected", async () => {
  const png = pngImage();
  await assert.rejects(normalizeAvatar(png, "image/jpeg"), status(415));
  await assert.rejects(normalizeAvatar(Buffer.from("<svg></svg>"), "image/svg+xml"), status(415));
  await assert.rejects(normalizeAvatar(Buffer.alloc(2097153), "image/png"), status(413));
  const corrupted = Buffer.from(png);
  corrupted[corrupted.length - 1] ^= 1;
  await assert.rejects(normalizeAvatar(corrupted, "image/png"), status(422));
  await assert.rejects(
    normalizeAvatar(
      Buffer.concat([png.subarray(0, 33), chunk("acTL", Buffer.alloc(8)), png.subarray(33)]),
      "image/png",
    ),
    status(415),
  );
  for (const value of [changeHeader(png, 24, 16), changeHeader(png, 28, 1)])
    await assert.rejects(normalizeAvatar(value, "image/png"), status(415));
  const huge = Buffer.from(png);
  huge.writeUInt32BE(16000001, 16);
  await assert.rejects(normalizeAvatar(huge, "image/png"), status(413));
  await assert.rejects(
    normalizeAvatar(
      Buffer.concat([png.subarray(0, 33), png.subarray(8, 33), png.subarray(33)]),
      "image/png",
    ),
    status(422),
  );
  await assert.rejects(normalizeAvatar(png.subarray(0, 20), "image/png"), status(422));
});
test("JPEG EXIF orientations1–8 are honored then stripped", async () => {
  const origin = jpeg.decode(jpegImage()).data;
  const mappings = [
    null,
    (x, y) => [x, y],
    (x, y) => [39 - x, y],
    (x, y) => [39 - x, 59 - y],
    (x, y) => [x, 59 - y],
    (x, y) => [y, x],
    (x, y) => [y, 59 - x],
    (x, y) => [39 - y, 59 - x],
    (x, y) => [39 - y, x],
  ];
  for (let n = 1; n <= 8; n++) {
    const result = await normalizeAvatar(orientedJpeg(n), "image/jpeg"),
      decoded = jpeg.decode(result.bytes);
    assert.equal(result.width, n >= 5 ? 60 : 40);
    assert.equal(result.height, n >= 5 ? 40 : 60);
    assert.ok(!result.bytes.includes(Buffer.from("Exif\0\0")));
    const [sx, sy] = mappings[n](10, 10),
      at = (sy * 40 + sx) * 4,
      out = (10 * decoded.width + 10) * 4;
    for (let c = 0; c < 3; c++)
      assert.ok(
        Math.abs(origin[at + c] - decoded.data[out + c]) < 45,
        `orientation${n} channel${c}`,
      );
  }
});
test("worker bounds concurrency and timeout while the main loop stays responsive", async (t) => {
  const base = await serve(t, (_req, res) => res.end("ready"));
  const data = pngImage(4000, 4000);
  let ticks = 0;
  const heartbeat = setInterval(() => ticks++, 1);
  const start = performance.now(),
    processing = normalizeAvatar(data, "image/png");
  await assert.rejects(normalizeAvatar(data, "image/png"), status(429));
  assert.equal(await (await fetch(base)).text(), "ready");
  const result = await processing;
  clearInterval(heartbeat);
  assert.ok(ticks > 0);
  assert.equal(result.width, 512);
  console.log(
    JSON.stringify({
      maxInputPixels: 16000000,
      elapsedMs: Math.round(performance.now() - start),
      rssBytes: process.memoryUsage().rss,
    }),
  );
  const impatient = createAvatarNormalizer({ timeoutMs: 1 });
  await assert.rejects(
    impatient(pngImage(), "image/png"),
    (error) => error.code === "AVATAR_TIMEOUT",
  );
  await assert.rejects(normalizeAvatar(data.subarray(0, 50), "image/png"), status(422));
  const directory = await mkdtemp(join(tmpdir(), "bibi-avatar-measure-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "synthetic.png");
  await writeFile(input, data);
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [resolve("backend/test/helpers/avatar-measure.mjs"), input],
    { windowsHide: true, timeout: 10000 },
  );
  const measured = JSON.parse(stdout);
  assert.equal(measured.width, 512);
  assert.equal(measured.height, 512);
  console.log("isolated decoder measurement", stdout.trim());
});
