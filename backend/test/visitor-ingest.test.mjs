import test from "node:test";
import assert from "node:assert/strict";
import { createVisitorFixture } from "./helpers/visitors.mjs";
test("cookie bootstrap writes zero rows; repeated views keep one visitor/session/product association", async (t) => {
  const f = await createVisitorFixture(t);
  assert.equal(f.bootstrap.status, 202);
  for (const table of [
    "visitors",
    "visitor_sessions",
    "visitor_session_pages",
    "visitor_viewed_products",
    "rate_limit_counters",
  ]) {
    const [[row]] = await f.pool.query(`SELECT COUNT(*) n FROM ${table}`);
    assert.equal(row.n, 0);
  }
  for (let i = 0; i < 100; i++) {
    f.clock.advance(7000);
    assert.equal((await f.collect(f.batch, f.cookie)).status, 204);
  }
  for (const table of [
    "visitors",
    "visitor_sessions",
    "visitor_session_pages",
    "visitor_viewed_products",
  ]) {
    const [[row]] = await f.pool.query(`SELECT COUNT(*) n FROM ${table}`);
    assert.equal(row.n, 1);
  }
  const [[visitor]] = await f.pool.query("SELECT session_count FROM visitors");
  assert.equal(visitor.session_count, 1);
});
test("normalization stores no raw IP, UA, query, hash or cookie and excludes product listings", async (t) => {
  const f = await createVisitorFixture(t);
  await f.collect(
    {
      paths: [
        "/products/product-0?email=private@example.test#token=secret",
        "/products/notebooks",
        "/admin/accounts",
      ],
      products: ["product-0", "notebooks"],
      lastPath: "/products/product-0?form=private",
    },
    f.cookie,
  );
  const [[visitor]] = await f.pool.query("SELECT * FROM visitors");
  assert.equal(visitor.ip_prefix, "192.0.2.0/24");
  assert.equal(visitor.device_type, "mobile");
  assert.equal(visitor.operating_system, "Android");
  assert.equal(visitor.browser, "Chrome");
  assert.equal(visitor.country, null);
  assert.equal(visitor.city, null);
  const [pages] = await f.pool.query("SELECT * FROM visitor_session_pages");
  assert.deepEqual(pages.map((row) => row.path).sort(), [
    "/products/notebooks",
    "/products/product-0",
  ]);
  const [products] = await f.pool.query("SELECT product_slug FROM visitor_viewed_products");
  assert.deepEqual(
    products.map((row) => row.product_slug),
    ["product-0"],
  );
  const persisted = JSON.stringify([visitor, pages, products]);
  for (const secret of [
    "192.0.2.123",
    "Chrome/123",
    "private@example",
    "token=secret",
    f.cookie,
    "/admin/",
  ])
    assert.ok(!persisted.includes(secret));
});
test("DNT, private-only batches, forged markers and invalid bodies cannot create visitors", async (t) => {
  const f = await createVisitorFixture(t);
  assert.equal((await f.collect(f.batch, undefined, { doNotTrack: true })).status, 204);
  assert.equal(
    (await f.collect({ paths: ["/admin/users"], products: [], lastPath: "/admin/users" })).status,
    204,
  );
  await assert.rejects(
    f.collect({ ...f.batch, is_test: true }, f.cookie),
    (error) => error.status === 400,
  );
  await assert.rejects(
    f.collect({ ...f.batch, paths: Array(51).fill("/") }, f.cookie),
    (error) => error.status === 400,
  );
  const [[row]] = await f.pool.query("SELECT COUNT(*) n FROM visitors");
  assert.equal(row.n, 0);
  const forged = await f.collect(
    f.batch,
    f.cookie.slice(0, -1) + (f.cookie.endsWith("a") ? "b" : "a"),
  );
  assert.equal(forged.status, 202);
});
test("session bounds cap distinct pages/products and mark truncation", async (t) => {
  const f = await createVisitorFixture(t, 250);
  for (let index = 0; index < 5; index++) {
    const products = Array.from({ length: 50 }, (_, i) => `product-${index * 50 + i}`);
    await f.collect(
      {
        paths: products.map((slug) => `/products/${slug}`),
        products,
        lastPath: `/products/${products.at(-1)}`,
      },
      f.cookie,
    );
  }
  const [[row]] = await f.pool.query(
    "SELECT page_count,product_count,truncated FROM visitor_sessions",
  );
  assert.equal(row.page_count, 200);
  assert.equal(row.product_count, 100);
  assert.equal(row.truncated, 1);
});
