import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mediaRoutes } from "../dist/content/media/routes.js";
import { installSecurity } from "../dist/http/security.js";
import { ApiError, errorHandler } from "../dist/http/errors.js";
import { serve } from "./helpers/http.mjs";
import { createContentMediaFixture } from "./helpers/content.mjs";
import { pngImage } from "./helpers/avatar-images.mjs";

async function fixture(t) {
  const f = await createContentMediaFixture(t),
    app = express();
  installSecurity(app, f.config);
  app.use(mediaRoutes(f.media, f.auth, f.config, { pool: f.pool, clock: f.clock }));
  app.post("/api/analytics/collect", (_req, res) => res.sendStatus(204));
  app.use(() => {
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy");
  });
  app.use(errorHandler);
  const base = await serve(t, app),
    tokens = {};
  for (const username of ["admin", "editor", "viewer"])
    tokens[username] = (
      await f.auth.login({
        username,
        password: username === "admin" ? f.secrets.masterPassword : f.secrets.userPassword,
      })
    ).accessToken;
  const request = (path, method = "GET", body, actor = "admin", extra = {}) =>
    fetch(base + path, {
      method,
      headers: {
        Origin: f.config.allowedOrigins[0],
        "X-Bibi-Request": "1",
        "Content-Type": "application/json",
        ...(actor ? { Authorization: "Bearer " + tokens[actor] } : {}),
        ...extra,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    });
  return { ...f, request };
}

test("auth and permission run before a large media parser; analytics keeps its16KiB limit", async (t) => {
  const f = await fixture(t),
    huge = "x".repeat(7 * 1024 * 1024);
  assert.equal((await f.request("/api/content/media", "POST", huge, null)).status, 401);
  assert.equal((await f.request("/api/content/media", "POST", huge, "viewer")).status, 403);
  assert.equal(
    (await f.request("/api/content/media", "POST", huge, "admin", { "X-Bibi-Request": "" })).status,
    403,
  );
  assert.equal(
    (
      await f.request(
        "/api/analytics/collect",
        "POST",
        JSON.stringify({ value: "x".repeat(16385) }),
      )
    ).status,
    413,
  );
});

test("canonical base64, decoded-byte and JSON-envelope limits are enforced separately", async (t) => {
  const f = await fixture(t),
    input = {
      mimeType: "image/png",
      originalName: "sample.png",
      data: pngImage().toString("base64"),
    };
  for (const data of ["AAAA===", "data:image/png;base64,AAAA", "AA=A"])
    assert.equal((await f.request("/api/content/media", "POST", { ...input, data })).status, 400);
  assert.equal(
    (
      await f.request("/api/content/media", "POST", {
        ...input,
        data: Buffer.alloc(5242881).toString("base64"),
      })
    ).status,
    413,
  );
  assert.equal(
    (await f.request("/api/content/media", "POST", { ...input, data: "A".repeat(6991533) })).status,
    413,
  );
});

test("private image bytes require header auth and never expose a public upload directory", async (t) => {
  const f = await fixture(t),
    response = await f.request(
      "/api/content/media",
      "POST",
      { mimeType: "image/png", originalName: "sample.png", data: pngImage().toString("base64") },
      "editor",
    );
  assert.equal(response.status, 201);
  const media = await response.json(),
    hash = media.variants[0].hash,
    path = `/api/content/media/${media.id}/${hash}`;
  assert.equal((await f.request(path, "GET", undefined, null)).status, 401);
  assert.equal((await f.request(path + "?token=ignored", "GET", undefined, null)).status, 401);
  const image = await f.request(path, "GET", undefined, "viewer");
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("cache-control"), "private, no-store");
  assert.match(image.headers.get("content-type"), /^image\/webp/);
  assert.equal(
    (await f.request(`/media/content/${hash}.webp`, "GET", undefined, null)).status,
    404,
  );
});
