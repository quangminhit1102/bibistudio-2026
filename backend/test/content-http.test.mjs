import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";

const directory = resolve("backend/content-migrations");

test("content admin API requires auth, serves authorized lists and 404s unknown ids", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
  const { createApp } = await import("../dist/app.js");
  const { serve } = await import("./helpers/http.mjs");
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        content: { schemaDirectory: directory },
      },
    ),
  );
  const grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const list = (path) =>
    fetch(base + "/api" + path, {
      method: "GET",
      headers: { Authorization: `Bearer ${grant.accessToken}` },
    });

  for (const path of [
    "/customers",
    "/posts",
    "/products",
    "/product-categories",
    "/content-categories",
  ])
    assert.equal((await fetch(base + "/api" + path)).status, 401, `${path} unauthenticated`);

  for (const path of [
    "/customers",
    "/posts",
    "/products",
    "/product-categories",
    "/content-categories",
  ]) {
    const response = await list(path);
    assert.equal(response.status, 200, path);
    const body = await response.json();
    assert.equal(body.total, 0, path);
    assert.deepEqual(body.items, [], path);
  }

  assert.equal(
    (await list("/customers/00000000-0000-4000-8000-000000000000")).status,
    404,
  );
});
