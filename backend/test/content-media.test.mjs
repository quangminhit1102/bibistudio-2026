import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, cp, mkdir, open } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { crc32 } from "node:zlib";
import { createContentMedia } from "../dist/content/media/service.js";
import { normalizeContentImage } from "../dist/content/media/codec.js";
import {
  withContentEnvironmentLock,
  underContentEnvironmentLease,
} from "../dist/content/environment-lock.js";
import sharp from "sharp";
import { createContentMediaFixture } from "./helpers/content.mjs";
import { pngImage, jpegImage, orientedJpeg } from "./helpers/avatar-images.mjs";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { createVerifiedBackup, runNativeTool } from "../dist/db/backup.js";
import { bridge } from "./helpers/native-backup.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const webpFixture = JSON.parse(
  await readFile(new URL("./fixtures/content-webp.json", import.meta.url), "utf8"),
);
const webp = Buffer.from(webpFixture.base64, "base64");

function gpsJpeg() {
  const image = jpegImage(),
    tiff = Buffer.alloc(92);
  tiff.write("II");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  for (const [at, tag, type, count, value] of [
    [10, 0x112, 3, 1, 6],
    [22, 0x8825, 4, 1, 38],
    [40, 1, 2, 2, 78],
    [52, 2, 5, 3, 68],
  ]) {
    tiff.writeUInt16LE(tag, at);
    tiff.writeUInt16LE(type, at + 2);
    tiff.writeUInt32LE(count, at + 4);
    tiff.writeUInt32LE(value, at + 8);
  }
  tiff.writeUInt16LE(2, 38);
  for (const at of [68, 76, 84]) tiff.writeUInt32LE(1, at + 4);
  const payload = Buffer.concat([Buffer.from("Exif\0\0"), tiff]),
    header = Buffer.from([255, 225, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([image.subarray(0, 2), header, payload, image.subarray(2)]);
}

test("stores actual JPEG PNG WebP as private normalized variants with server filenames", async (t) => {
  assert.equal(hash(webp), "c517b8b9b9d814e6d76f3cb97849f82d34a108095526286cde90656f17767e42");
  const f = await createContentMediaFixture(t);
  assert.ok((await sharp(gpsJpeg()).metadata()).exif.includes(Buffer.from([0x25, 0x88])));
  for (const [mimeType, bytes] of [
    ["image/jpeg", gpsJpeg()],
    ["image/png", pngImage(3000, 1)],
    ["image/webp", webp],
  ]) {
    const value = await f.media.upload(f.admin, {
      mimeType,
      bytes,
      originalName: "../../original.php",
    });
    assert.match(value.id, /^[a-f\d-]{36}$/);
    assert.ok(value.width <= 2400 && value.height <= 2400);
    if (mimeType === "image/jpeg") assert.deepEqual([value.width, value.height], [60, 40]);
    if (mimeType === "image/png") assert.equal(Math.max(value.width, value.height), 2400);
    for (const variant of value.variants) {
      assert.match(variant.file, new RegExp(`^${value.id}/[a-f0-9]{64}\\.webp$`));
      const image = await f.media.readPrivate(f.viewer, value.id, variant.hash);
      assert.equal(hash(image.bytes), variant.hash);
      assert.equal(image.mimeType, "image/webp");
      const metadata = await sharp(image.bytes).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, variant.width);
      assert.equal(metadata.height, variant.height);
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.icc, undefined);
      assert.equal(metadata.xmp, undefined);
    }
    assert.ok(
      (await f.media.references([value.id, value.id])).every((item) => item.id === value.id),
    );
  }
  assert.equal(
    (await f.media.list(f.viewer, { page: 1, pageSize: 100, search: "original" })).total,
    3,
  );
  await assert.rejects(
    f.media.readPrivate(
      { ...f.viewer, sid: "not-a-session" },
      "11111111-1111-4111-8111-111111111111",
      "a".repeat(64),
    ),
    (error) => error.status === 401,
  );
});

test("rejects decoded bytes above 5MiB before MIME sniffing and excessive declared pixels", async (t) => {
  const f = await createContentMediaFixture(t);
  await assert.rejects(
    f.media.upload(f.admin, {
      bytes: Buffer.alloc(5242881),
      mimeType: "image/png",
      originalName: "large.png",
    }),
    (error) => error.status === 413,
  );
  const pixels = Buffer.from(pngImage());
  pixels.writeUInt32BE(16000001, 16);
  pixels.writeUInt32BE(1, 20);
  pixels.writeUInt32BE(crc32(pixels.subarray(12, 29)), 29);
  await assert.rejects(
    f.media.upload(f.admin, { bytes: pixels, mimeType: "image/png", originalName: "pixels.png" }),
    (error) => error.status === 413,
  );
  assert.equal((await f.media.list(f.admin, { page: 1, pageSize: 10 })).total, 0);
});

test("rejects MIME mismatch, SVG, malformed data and unknown references", async (t) => {
  const f = await createContentMediaFixture(t);
  for (const input of [
    { bytes: pngImage(), mimeType: "image/jpeg" },
    { bytes: Buffer.from('<svg onload="alert(1)"/>'), mimeType: "image/svg+xml" },
    { bytes: Buffer.from("not an image"), mimeType: "image/png" },
  ])
    await assert.rejects(f.media.upload(f.admin, { ...input, originalName: "bad" }), (error) =>
      [400, 415].includes(error.status),
    );
  await assert.rejects(
    f.media.references(["11111111-1111-4111-8111-111111111111"]),
    (error) => error.code === "INVALID_MEDIA_REFERENCE",
  );
  await assert.rejects(
    f.media.upload(f.viewer, {
      bytes: pngImage(),
      mimeType: "image/png",
      originalName: "denied.png",
    }),
    (error) => error.status === 403,
  );
  assert.equal((await f.media.list(f.admin, { page: 1, pageSize: 100 })).total, 0);
});

test("cancelled or failed decoding creates no ready row or media file", async (t) => {
  const f = await createContentMediaFixture(t),
    image = await normalizeContentImage(pngImage(), "image/png"),
    started = deferred(),
    release = deferred();
  const slow = createContentMedia({
    pool: f.pool,
    paths: f.paths,
    clock: f.clock,
    codec: async () => {
      started.resolve();
      await release.promise;
      return image;
    },
  });
  const controller = new AbortController();
  const operation = slow.upload(
    f.admin,
    { bytes: pngImage(), mimeType: "image/png", originalName: "cancel.png" },
    controller.signal,
  );
  const rejected = assert.rejects(operation, (error) => error.code === "REQUEST_ABORTED");
  await started.promise;
  controller.abort();
  release.resolve();
  await rejected;
  const broken = createContentMedia({
    pool: f.pool,
    paths: f.paths,
    clock: f.clock,
    codec: async () => {
      throw Error("controlled decode failure");
    },
  });
  await assert.rejects(
    broken.upload(f.admin, {
      bytes: pngImage(),
      mimeType: "image/png",
      originalName: "broken.png",
    }),
  );
  assert.equal(
    (await f.pool.query("SELECT COUNT(*) n FROM content_media WHERE state='complete'"))[0][0].n,
    0,
  );
  assert.deepEqual(await readdir(f.paths.media), []);
});

test("backup waits between file staging and metadata commit and restore has every file digest", async (t) => {
  const f = await createContentMediaFixture(t),
    verifier = await createDatabaseFixture(t),
    staged = deferred(),
    release = deferred();
  const get = f.pool.getConnection.bind(f.pool),
    seen = new WeakSet();
  let pause = true;
  f.pool.getConnection = async () => {
    const connection = await get();
    if (seen.has(connection)) return connection;
    seen.add(connection);
    const execute = connection.execute.bind(connection);
    connection.execute = async (sql, ...args) => {
      if (pause && String(sql).startsWith("INSERT INTO content_media(")) {
        pause = false;
        staged.resolve();
        await release.promise;
      }
      return execute(sql, ...args);
    };
    return connection;
  };
  const uploading = f.media.upload(f.admin, {
    bytes: jpegImage(),
    mimeType: "image/jpeg",
    originalName: "paired.jpg",
  });
  await staged.promise;
  let backupEntered = false,
    restoredCount = 0;
  const backup = withContentEnvironmentLock(f.paths, async () => {
    backupEntered = true;
    const target = join(f.paths.root, "restore-media");
    await cp(f.paths.media, target, { recursive: true });
    return createVerifiedBackup({
      pool: f.pool,
      database: f.dbConfig,
      verifyDatabase: verifier.config.database,
      directory: join(f.paths.root, "backups"),
      releaseId: "a".repeat(40) + "-123",
      flavor: "mariadb",
      runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
      verifyRestored: async (connection, database) => {
        const [rows] = await connection.query(
          `SELECT file,hash FROM \`${database}\`.content_media_variants`,
        );
        restoredCount = rows.length;
        for (const row of rows) {
          assert.match(row.file, /^[a-f0-9-]{36}\/[a-f0-9]{64}\.webp$/);
          assert.equal(hash(await readFile(join(target, row.file))), row.hash);
        }
      },
    });
  });
  await new Promise((done) => setTimeout(done, 100));
  assert.equal(backupEntered, false);
  release.resolve();
  await uploading;
  assert.equal((await backup).verified, true);
  assert.ok(restoredCount > 0);
});

test("an acquired environment lock is released after failure and rejects forged leases", async (t) => {
  const f = await createContentMediaFixture(t);
  await assert.rejects(
    withContentEnvironmentLock(f.paths, async (lease) => {
      lease.assertActive();
      throw Error("controlled callback failure");
    }),
    /controlled/,
  );
  assert.equal(
    await withContentEnvironmentLock(f.paths, async (lease) => {
      lease.assertActive();
      return "next owner";
    }),
    "next owner",
  );
  let invoked = false;
  await assert.rejects(
    underContentEnvironmentLease(f.paths, { assertActive() {} }, () => {
      invoked = true;
    }),
  );
  assert.equal(invoked, false);
});

test("loss of the owned holder aborts work before another environment writer can enter", async (t) => {
  const f = await createContentMediaFixture(t),
    entered = deferred(),
    release = deferred();
  let owned;
  const first = withContentEnvironmentLock(f.paths, async (lease) => {
    owned = lease;
    entered.resolve();
    await release.promise;
    lease.assertActive();
  });
  const failed = assert.rejects(first, (error) => error.code === "CONTENT_LOCK_LOST");
  await entered.promise;
  const aborted = deferred();
  owned.signal.addEventListener("abort", () => aborted.resolve(), { once: true });
  process.kill(owned.holderPid, "SIGKILL");
  await aborted.promise;
  let secondEntered = false;
  const second = withContentEnvironmentLock(f.paths, async (lease) => {
    lease.assertActive();
    secondEntered = true;
  });
  await new Promise((done) => setTimeout(done, 100));
  assert.equal(secondEntered, false);
  release.resolve();
  await failed;
  await second;
  assert.equal(secondEntered, true);
});

test("a partial disk write cleans its owned staging file without committing media", async (t) => {
  const f = await createContentMediaFixture(t),
    handle = await open(join(f.paths.root, "prototype-handle"), "wx"),
    prototype = Object.getPrototypeOf(handle),
    write = prototype.writeFile;
  await handle.close();
  prototype.writeFile = async function (bytes, ...args) {
    await write.call(this, bytes.subarray(0, 8), ...args);
    throw Object.assign(Error("controlled disk-full write"), { code: "ENOSPC" });
  };
  try {
    await assert.rejects(
      f.media.upload(f.admin, {
        bytes: pngImage(),
        mimeType: "image/png",
        originalName: "partial.png",
      }),
      (error) => error.code === "CONTENT_STORAGE_FULL",
    );
  } finally {
    prototype.writeFile = write;
  }
  assert.equal((await f.media.list(f.admin, { page: 1, pageSize: 10 })).total, 0);
  assert.deepEqual(await readdir(f.paths.media), []);
});

test("quota rejection retains earlier private images and corruption cannot escape the media root", async (t) => {
  const f = await createContentMediaFixture(t),
    value = await f.media.upload(f.admin, {
      bytes: pngImage(),
      mimeType: "image/png",
      originalName: "retained.png",
    });
  f.paths.maxContentBytes = 1;
  await assert.rejects(
    f.media.upload(f.admin, {
      bytes: jpegImage(),
      mimeType: "image/jpeg",
      originalName: "full.jpg",
    }),
    (error) => error.code === "CONTENT_STORAGE_FULL",
  );
  const variant = value.variants[0];
  assert.equal(
    hash((await f.media.readPrivate(f.viewer, value.id, variant.hash)).bytes),
    variant.hash,
  );
  await f.pool.execute(
    "UPDATE content_media_variants SET file='../outside.webp' WHERE media_id=?",
    [value.id],
  );
  await assert.rejects(
    f.media.readPrivate(f.viewer, value.id, variant.hash),
    (error) => error.code === "CONTENT_STORAGE_PATH",
  );
});

test("killing an owned parent releases its holder for the next process", async (t) => {
  const f = await createContentMediaFixture(t),
    code =
      'const {withContentEnvironmentLock}=require(process.argv[1]);void withContentEnvironmentLock(JSON.parse(process.argv[2]),async()=>{process.stdout.write("LOCKED\\n");await new Promise(()=>{});}).catch(()=>{process.exitCode=1;});';
  const child = spawn(
    process.execPath,
    ["-e", code, resolve("backend/dist/content/environment-lock.js"), JSON.stringify(f.paths)],
    {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
    },
  );
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  });
  const lines = createInterface({ input: child.stdout });
  await new Promise((done, fail) => {
    child.once("error", fail);
    child.once("exit", () => fail(Error("Parent exited before lock")));
    lines.on("line", (line) => {
      if (line === "LOCKED") done();
    });
  });
  lines.close();
  const closed = new Promise((done) => child.once("exit", done));
  child.kill("SIGKILL");
  await closed;
  assert.equal(
    await withContentEnvironmentLock(f.paths, async (lease) => {
      lease.assertActive();
      return "recovered";
    }),
    "recovered",
  );
});

test(
  "Linux content locking respects the exact lock used by the native deploy receiver",
  { skip: process.platform !== "linux" },
  async (t) => {
    const f = await createContentMediaFixture(t),
      child = spawn(
        "flock",
        [
          "-x",
          f.paths.deployLock,
          process.execPath,
          "-e",
          'process.stdout.write("LOCKED\\n");process.stdin.resume();',
        ],
        { stdio: ["pipe", "pipe", "ignore"] },
      );
    t.after(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    });
    const lines = createInterface({ input: child.stdout });
    await new Promise((done, fail) => {
      child.once("error", fail);
      child.once("exit", () => fail(Error("Native lock failed")));
      lines.on("line", (line) => {
        if (line === "LOCKED") done();
      });
    });
    lines.close();
    let entered = false;
    const operation = withContentEnvironmentLock(f.paths, async (lease) => {
      lease.assertActive();
      entered = true;
    });
    await new Promise((done) => setTimeout(done, 100));
    assert.equal(entered, false);
    child.stdin.end();
    await operation;
    assert.equal(entered, true);
  },
);
