import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";

async function fixture(t) {
  const f = await createAuthFixture(t, { visitorHistory: false, content: true });
  const { createApp } = await import("../dist/app.js");
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        content: { schemaDirectory: resolve("backend/content-migrations") },
      },
    ),
  );
  const admin = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const request = (path, method = "GET", body, token = admin.accessToken, origin = true) =>
    fetch(base + "/api" + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
        ...(origin ? { Origin: f.config.allowedOrigins[0] } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let sequence = 100;
  async function product(name = "Stock product", stock = 10, reserved = 3) {
    const id = randomUUID();
    await f.pool.execute(
      "INSERT INTO products (id,product_code,name,slug,description,product_type,collection,stock,reserved,image_ids,tags,created_at,updated_at) VALUES (?,?,?,?,'','test','test',?,?,'[]','[]',?,?)",
      [id, String(sequence++), name, id, stock, reserved, f.clock.now(), f.clock.now()],
    );
    return id;
  }
  const adjust = (id, revision, delta, reason = "Manual stock count") =>
    request(`/products/${id}/stock-adjustments`, "POST", { revision, delta, reason });
  const history = async (query = "") => {
    const response = await request("/stock-movements" + query);
    assert.equal(response.status, 200);
    return response.json();
  };
  return { ...f, request, product, adjust, history, admin };
}

test("manual adjustments change stock and revision, snapshot product/actor and write an audit", async (t) => {
  const f = await fixture(t);
  assert.deepEqual((await f.history()).items, []);
  const id = await f.product();
  const response = await f.adjust(id, 1, 5, "  Restock  ");
  assert.equal(response.status, 200);
  const product = await response.json();
  assert.deepEqual([product.stock, product.reserved, product.revision], [15, 3, 2]);
  const history = await f.history(`?productId=${id}`);
  assert.equal(history.total, 1);
  const movement = history.items[0];
  assert.deepEqual(
    { ...movement, id: "id", createdAt: "time" },
    {
      id: "id",
      productId: id,
      productName: "Stock product",
      delta: 5,
      stockBefore: 10,
      stockAfter: 15,
      reason: "Restock",
      source: "manual",
      actorId: f.admin.profile.id,
      actorName: f.admin.profile.displayName,
      createdAt: "time",
    },
  );
  assert.match(movement.createdAt, /^2026-11-04T/);
  const [[audit]] = await f.pool.query(
    "SELECT action,target_id FROM audit_logs WHERE action='product.stock_adjust'",
  );
  assert.deepEqual({ ...audit }, { action: "product.stock_adjust", target_id: id });
  const down = await f.adjust(id, 2, -12);
  assert.equal(down.status, 200);
  assert.deepEqual([(await down.json()).stock, (await f.history()).total], [3, 2]);
});

test("invalid adjustments and stale revisions leave stock, movements and audit unchanged", async (t) => {
  const f = await fixture(t);
  const id = await f.product();
  for (const delta of [-11, -8]) {
    const response = await f.adjust(id, 1, delta);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "STOCK_BELOW_RESERVED");
  }
  for (const body of [
    { revision: 1, delta: 0, reason: "Zero" },
    { revision: 1, delta: 0.5, reason: "Fraction" },
    { revision: 1, delta: 1, reason: " " },
    { revision: 1, delta: 1, reason: "x".repeat(501) },
    { delta: 1, reason: "No revision" },
    { revision: 0, delta: 1, reason: "Bad revision" },
    { revision: 1, delta: 2147483647, reason: "Overflow" },
  ])
    assert.equal((await f.request(`/products/${id}/stock-adjustments`, "POST", body)).status, 400);
  const stale = await f.adjust(id, 2, 1);
  assert.equal(stale.status, 409);
  assert.equal((await f.adjust(randomUUID(), 1, 1)).status, 404);
  assert.equal((await f.history()).total, 0);
  const product = await (await f.request(`/products/${id}`)).json();
  assert.deepEqual([product.stock, product.reserved, product.revision], [10, 3, 1]);
  assert.equal(
    Number(
      (
        await f.pool.query("SELECT COUNT(*) n FROM audit_logs WHERE action='product.stock_adjust'")
      )[0][0].n,
    ),
    0,
  );
});

test("two administrators using the same revision produce one adjustment and one conflict", async (t) => {
  const f = await fixture(t);
  const id = await f.product();
  await f.pool.query("INSERT INTO role_permissions VALUES ('system-user','product.update')");
  const other = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const responses = await Promise.all([
    f.adjust(id, 1, 2),
    f.request(
      `/products/${id}/stock-adjustments`,
      "POST",
      { revision: 1, delta: 2, reason: "Other admin" },
      other.accessToken,
    ),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const product = await (await f.request(`/products/${id}`)).json();
  assert.deepEqual([product.stock, product.revision], [12, 2]);
  assert.equal((await f.history()).total, 1);
  assert.equal(
    Number(
      (
        await f.pool.query("SELECT COUNT(*) n FROM audit_logs WHERE action='product.stock_adjust'")
      )[0][0].n,
    ),
    1,
  );
});

test("audit failure rolls back both stock change and movement", async (t) => {
  const f = await fixture(t);
  const id = await f.product();
  await f.pool.query(
    "CREATE TRIGGER fail_stock_audit BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.action='product.stock_adjust' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test audit failure'; END IF; END",
  );
  assert.equal((await f.adjust(id, 1, 2)).status, 503);
  const product = await (await f.request(`/products/${id}`)).json();
  assert.deepEqual([product.stock, product.revision], [10, 1]);
  assert.equal((await f.history()).total, 0);
});

test("history is filtered and paginated newest first, and survives product deletion", async (t) => {
  const f = await fixture(t);
  const a = await f.product("Product A");
  const b = await f.product("Product B");
  assert.equal((await f.adjust(a, 1, 1, "First")).status, 200);
  f.clock.advance(1000);
  assert.equal((await f.adjust(b, 1, 2, "Second")).status, 200);
  f.clock.advance(1000);
  assert.equal((await f.adjust(a, 2, 3, "Third")).status, 200);
  const first = await f.history("?page=1&pageSize=2");
  assert.deepEqual([first.total, first.page, first.pageSize], [3, 1, 2]);
  assert.deepEqual(
    first.items.map((item) => item.reason),
    ["Third", "Second"],
  );
  assert.deepEqual(
    (await f.history("?page=2&pageSize=2")).items.map((item) => item.reason),
    ["First"],
  );
  assert.deepEqual(
    (await f.history(`?productId=${a}`)).items.map((item) => item.reason),
    ["Third", "First"],
  );
  assert.equal((await f.history(`?productId=${randomUUID()}`)).total, 0);
  assert.equal((await f.request(`/products/${a}`, "DELETE", { revision: 3 })).status, 200);
  assert.equal((await f.history(`?productId=${a}`)).total, 2);
  assert.ok(
    (await f.history(`?productId=${a}`)).items.every((item) => item.productName === "Product A"),
  );
  for (const query of ["?page=0", "?pageSize=0", "?pageSize=1001", "?productId=bad"])
    assert.equal((await f.request("/stock-movements" + query)).status, 400);
});

test("ordinary product edits record only real stock changes with before/after snapshots", async (t) => {
  const f = await fixture(t);
  const id = await f.product();
  assert.equal(
    (await f.request(`/products/${id}`, "PUT", { revision: 1, stock: 20, name: "Renamed" })).status,
    200,
  );
  const [movement] = (await f.history()).items;
  assert.deepEqual(
    [
      movement.source,
      movement.delta,
      movement.stockBefore,
      movement.stockAfter,
      movement.productName,
    ],
    ["product_edit", 10, 10, 20, "Renamed"],
  );
  assert.ok(movement.reason.length > 0);
  assert.equal((await f.request(`/products/${id}`, "PUT", { revision: 2, stock: 20 })).status, 200);
  assert.equal(
    (await f.request(`/products/${id}`, "PUT", { revision: 3, reserved: 4 })).status,
    200,
  );
  assert.equal((await f.request(`/products/${id}`, "PUT", { revision: 3, stock: 30 })).status, 409);
  assert.equal((await f.history()).total, 1);
  assert.equal((await (await f.request(`/products/${id}`)).json()).reserved, 4);
});

test("adjustments and history independently enforce auth, browser origin and permissions", async (t) => {
  const f = await fixture(t);
  const id = await f.product();
  const path = `/products/${id}/stock-adjustments`;
  const body = { revision: 1, delta: 1, reason: "Count" };
  assert.equal((await f.request(path, "POST", body, "invalid")).status, 401);
  assert.equal((await f.request("/stock-movements", "GET", undefined, "invalid")).status, 401);
  assert.equal((await f.request(path, "POST", body, undefined, false)).status, 403);
  const user = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  assert.equal((await f.request(path, "POST", body, user.accessToken)).status, 403);
  assert.equal(
    (await f.request("/stock-movements", "GET", undefined, user.accessToken)).status,
    403,
  );
  await f.pool.query("INSERT INTO role_permissions VALUES ('system-user','product.view')");
  const viewer = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  assert.equal(
    (await f.request("/stock-movements", "GET", undefined, viewer.accessToken)).status,
    200,
  );
  assert.equal((await f.request(path, "POST", body, viewer.accessToken)).status, 403);
  assert.equal((await f.history()).total, 0);
});
