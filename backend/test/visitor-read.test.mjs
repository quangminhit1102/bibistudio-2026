import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createAuthFixture } from "./helpers/auth.mjs";
import { createApp } from "../dist/app.js";
import { serve } from "./helpers/http.mjs";

test("visitor private APIs serve real deduplicated data, static routes and permission checks", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateVisitorHistory } = await import("../dist/visitors/schema.js");
  await migrateVisitorHistory(
    f.pool,
    fileURLToPath(new URL("../visitor-migrations", import.meta.url)),
  );
  const { createCatalogue } = await import("../dist/visitors/catalogue.js");
  const { collectVisitor } = await import("../dist/visitors/collector.js");
  const catalogue = createCatalogue({
    version: 1,
    routes: [
      { path: "/", label: "Trang chủ" },
      { path: "/products/a", label: "Sổ A" },
    ],
    products: [{ slug: "a", name: "Sổ A" }],
  });
  const analytics = {
    pool: f.pool,
    idSecret: randomBytes(32).toString("hex"),
    catalogue,
    cookieSecure: false,
  };
  const context = {
    now: f.clock.now(),
    ip: "192.0.2.123",
    userAgent: "Android Mobile Chrome/123.0",
    ...analytics,
  };
  const batch = { paths: ["/products/a"], products: ["a"], lastPath: "/products/a" };
  const bootstrap = await collectVisitor(f.pool, batch, context);
  await collectVisitor(f.pool, batch, { ...context, cookie: bootstrap.cookie.value });
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      { db: f.pool, config: f.config, clock: f.clock, analytics },
    ),
  );
  const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const get = async (path) => {
    const response = await fetch(base + path, {
      headers: { Authorization: `Bearer ${grant.accessToken}` },
    });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await fetch(base + "/api/customer-access")).status, 401);
  const list = await get("/api/customer-access?page=1&pageSize=1");
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 1);
  const visitor = list.body.items[0];
  assert.equal(visitor.ipAddress, "");
  assert.equal(visitor.ipStatus, "unavailable");
  assert.equal(visitor.sessionCount, 1);
  assert.equal(visitor.distinctPageCount, 1);
  assert.equal(visitor.identity_hash, undefined);
  assert.equal((await get("/api/customer-access?search=unknown")).body.total, 0);
  assert.equal((await get("/api/customer-access?deviceType=desktop")).body.total, 0);
  assert.equal((await get("/api/customer-access?product=a")).status, 400);
  assert.equal((await get("/api/customer-access?pageSize=101")).status, 400);
  for (const query of [
    "from=2026-02-30&to=2026-03-01",
    "from=2026-11-14&to=2026-11-01",
    "from=2026-11-01",
  ]) {
    assert.equal((await get(`/api/customer-access/report?${query}`)).status, 400);
  }
  const detail = await get(`/api/customer-access/${visitor.id}`);
  assert.equal(detail.body.id, visitor.id);
  const sessions = await get(`/api/customer-access/${visitor.id}/sessions`);
  assert.equal(sessions.body.total, 1);
  assert.equal(sessions.body.items[0].products[0].name, "Sổ A");
  assert.equal(
    (await get(`/api/customer-access/${visitor.id}/session-history?from=2026-11-01&to=2026-11-30`))
      .body.items.length,
    1,
  );
  assert.equal(
    (await get("/api/customer-access/report/products?from=2026-11-01&to=2026-11-30")).body.total,
    1,
  );
  const empty = await get("/api/customer-access/report?from=2021-01-01&to=2021-01-01");
  assert.equal(empty.body.totalSessions, 0);
  assert.equal(empty.body.series.length, 24);
  const report = await get("/api/customer-access/report");
  const admin = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  assert.equal(
    (
      await fetch(base + "/api/customer-access/report", {
        headers: { Authorization: `Bearer ${admin.accessToken}` },
      })
    ).status,
    200,
  );
  assert.equal(report.body.totalVisitors, 1);
  assert.equal(report.body.totalSessions, 1);
  assert.deepEqual(report.body.products, [{ slug: "a", name: "Sổ A", interestedVisitors: 1 }]);
  assert.deepEqual((await get("/api/customer-access/filter-options")).body.deviceTypes, ["mobile"]);
  assert.equal((await get("/api/accounts")).status, 403);
  // Probe data cannot leak into any real summary or detail route.
  await f.pool.query("UPDATE visitors SET is_probe=1 WHERE id=?", [visitor.id]);
  assert.equal((await get("/api/customer-access")).body.total, 0);
  assert.equal((await get(`/api/customer-access/${visitor.id}`)).status, 404);
  assert.equal((await get(`/api/customer-access/${visitor.id}/sessions`)).status, 404);
  assert.equal((await get("/api/customer-access/report")).body.totalSessions, 0);
  assert.deepEqual((await get("/api/customer-access/filter-options")).body.deviceTypes, []);
  await f.pool.query(
    "DELETE FROM user_roles WHERE user_id=(SELECT id FROM users WHERE username='user01')",
  );
  for (const path of ["/report", "/report/products", `/${visitor.id}/session-history`]) {
    assert.equal((await fetch(base + "/api/customer-access" + path)).status, 401);
    assert.equal((await get("/api/customer-access" + path)).status, 403);
  }
});
