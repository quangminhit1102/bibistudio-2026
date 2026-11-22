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
  const authHeaders = { Authorization: `Bearer ${grant.accessToken}` };
  const list = (path) =>
    fetch(base + "/api" + path, {
      method: "GET",
      headers: authHeaders,
    });
  const write = (path, method, body) =>
    fetch(base + "/api" + path, {
      method,
      headers: {
        ...authHeaders,
        Origin: f.config.allowedOrigins[0],
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
      },
      body: JSON.stringify(body),
    });

  for (const path of [
    "/customers",
    "/posts",
    "/products",
    "/product-categories",
    "/content-categories",
  ])
    assert.equal((await fetch(base + "/api" + path)).status, 401, `${path} unauthenticated`);

  // Lists must accept the frontend admin client's exact query shape
  // (page/size/q/sort=<field>/dir/<f_key> filters) without a 400.
  for (const path of [
    "/customers",
    "/posts",
    "/products",
    "/product-categories",
    "/content-categories",
  ]) {
    const response = await list(`${path}?page=1&size=10&q=test&sort=name&dir=asc&f_status=published`);
    assert.equal(response.status, 200, path);
    const body = await response.json();
    assert.equal(body.total, 0, path);
    assert.deepEqual(body.items, [], path);
  }

  assert.equal(
    (await list("/customers/00000000-0000-4000-8000-000000000000")).status,
    404,
  );

  // A non-digit productCode must be rejected with 400 (spec §2).
  const badProduct = await write("/products", "POST", {
    productCode: "abc-1",
    name: "Sản phẩm",
    slug: "san-pham",
    description: "<p>Mô tả</p>",
    productType: "book",
    collection: "featured",
  });
  assert.equal(badProduct.status, 400, "non-digit productCode is rejected");

  // A valid product with status=published is returned by the f_status filter.
  const created = await write("/products", "POST", {
    productCode: "1001",
    name: "Sản phẩm",
    slug: "san-pham",
    description: "<p>Mô tả</p>",
    productType: "book",
    collection: "featured",
    status: "published",
  });
  assert.equal(created.status, 201, "valid product is created");

  const published = await (await list("/products?page=1&size=10&f_status=published")).json();
  assert.equal(published.total, 1);
  assert.equal(published.items[0].productCode, "1001");

  const drafts = await (await list("/products?page=1&size=10&f_status=draft")).json();
  assert.equal(drafts.total, 0);

  const searched = await (
    await list(`/products?page=1&size=10&q=${encodeURIComponent("phẩm")}`)
  ).json();
  assert.equal(searched.total, 1);
  assert.equal(searched.items[0].productCode, "1001");
});
