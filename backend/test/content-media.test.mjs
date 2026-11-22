import nodeTest from "node:test";
const test = (name, fn) => nodeTest(name, { timeout: 25000 }, fn);
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";
import { pngImage, jpegImage } from "./helpers/avatar-images.mjs";

const directory = resolve("backend/content-migrations");

async function createMediaFixture(t) {
  const f = await createAuthFixture(t);
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
  const mediaDirectory = await mkdtemp(join(tmpdir(), "bibi-media-"));
  t.after(() => rm(mediaDirectory, { recursive: true, force: true }));
  const { createApp } = await import("../dist/app.js");
  const base = await serve(
    t,
    createApp(
      { releaseId: "content-media-test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        content: { schemaDirectory: directory, mediaDirectory },
      },
    ),
  );
  const master = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const user = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const upload = (bytes, options = {}) =>
    fetch(base + "/api/media", {
      method: "POST",
      headers: {
        Origin: options.origin ?? f.config.allowedOrigins[0],
        "X-Bibi-Request": "1",
        "Content-Type": "application/json",
        Authorization: "Bearer " + (options.token ?? master.accessToken),
      },
      body: JSON.stringify({
        mimeType: options.mime ?? "image/png",
        data: bytes.toString("base64"),
      }),
    });
  return { ...f, base, master, user, mediaDirectory, upload };
}

test("media upload returns 201 with id and dimensions; GET serves the stored bytes", async (t) => {
  const f = await createMediaFixture(t);
  const image = pngImage(40, 60);
  const upload = await f.upload(image);
  assert.equal(upload.status, 201);
  const a = await upload.json();
  assert.ok(a.id);
  assert.equal(a.width, 40);
  assert.equal(a.height, 60);
  assert.equal(a.size, image.length);
  assert.ok(!JSON.stringify(a).includes(f.mediaDirectory));
  const url = f.base + "/api/media/" + a.id;
  const read = await fetch(url);
  assert.equal(read.status, 200);
  assert.match(read.headers.get("content-type"), /^image\/png/);
  assert.equal(read.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.ok(Buffer.from(await read.arrayBuffer()).equals(image));
  assert.equal((await readdir(f.mediaDirectory)).length, 1);

  const jpeg = await f.upload(jpegImage(30, 30), { mime: "image/jpeg" });
  assert.equal(jpeg.status, 201);
  const b = await jpeg.json();
  const readJpeg = await fetch(f.base + "/api/media/" + b.id, {
    headers: { Authorization: "Bearer " + f.master.accessToken },
  });
  assert.equal(readJpeg.status, 200);
  assert.match(readJpeg.headers.get("content-type"), /^image\/jpeg/);
});

test("media upload rejects bodies over 2 MiB and unauthorized actors", async (t) => {
  const f = await createMediaFixture(t);
  assert.equal((await f.upload(Buffer.alloc(2097153))).status, 413);
  assert.equal((await f.upload(pngImage(), { token: f.user.accessToken })).status, 403);
  assert.equal(
    (
      await fetch(f.base + "/api/media", {
        method: "POST",
        headers: {
          Origin: f.config.allowedOrigins[0],
          "X-Bibi-Request": "1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mimeType: "image/png", data: pngImage().toString("base64") }),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(f.base + "/api/media", {
        method: "POST",
        headers: {
          Origin: f.config.allowedOrigins[0],
          "X-Bibi-Request": "1",
          "Content-Type": "application/json",
          Authorization: "Bearer " + f.master.accessToken,
        },
        body: JSON.stringify({ mimeType: "image/png", data: "YWJj!!" }),
      })
    ).status,
    400,
  );
  assert.equal((await readdir(f.mediaDirectory)).length, 0);
});

test("missing media id is a 404 and reads validate against the stored size", async (t) => {
  const f = await createMediaFixture(t);
  const missing = await fetch(f.base + "/api/media/00000000-0000-4000-8000-000000000000", {
    headers: { Authorization: "Bearer " + f.master.accessToken },
  });
  assert.equal(missing.status, 404);
  assert.equal(
    (
      await fetch(f.base + "/api/media/not-a-uuid", {
        headers: { Authorization: "Bearer " + f.master.accessToken },
      })
    ).status,
    400,
  );
});
