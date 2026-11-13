import test from "node:test";
import assert from "node:assert/strict";
import { createVisitorFixture } from "./helpers/visitors.mjs";
import { createVisitorService } from "../dist/visitors/service.js";

test("one start-time cohort drives counts, metadata, product ranking and complete cross-boundary URLs", async (t) => {
  const f = await createVisitorFixture(t, 100);
  await f.collect(f.batch, f.cookie);
  const [[a]] = await f.pool.query("SELECT id FROM visitors");
  const old = "2020-01-01 10:00:00.000";
  await f.pool.query("UPDATE visitor_sessions SET started_at=?,last_received_at=?", [old, old]);
  const add = async (id, visitor, date, ip) =>
    f.pool.query(
      "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path,client_ip,ip_status,device_type,browser,operating_system) VALUES(?,?,?,?,'/','/',?,'verified','desktop','Edge','Windows')",
      [id, visitor, date, date, ip],
    );
  await add("a1", a.id, "2026-11-01 18:00:00", "8.8.8.8");
  await add("a2", a.id, "2026-11-13 16:59:59", "1.1.1.1");
  await add("outside", a.id, "2026-11-14 00:00:00", "9.9.9.9");
  const other = await f.collect(f.batch);
  await f.collect(f.batch, other.cookie.value);
  const [[b]] = await f.pool.query("SELECT id FROM visitors WHERE id<>?", [a.id]);
  await f.pool.query(
    "UPDATE visitor_sessions SET started_at='2026-11-03',client_ip='8.8.8.8',ip_status='verified',device_type='desktop',browser='Edge' WHERE visitor_id=?",
    [b.id],
  );
  for (const id of ["a1", "a2"])
    await f.pool.query(
      "INSERT INTO visitor_viewed_products VALUES(?,'product-0','2026-11-14','2026-11-14')",
      [id],
    );
  await f.pool.query(
    "INSERT INTO visitor_session_pages VALUES('a2','/contact','2026-11-14','2026-11-14')",
  );
  const api = createVisitorService(f.pool, f.catalogue, f.clock);
  const scope = { from: "2026-11-01", to: "2026-11-13", page: 1, pageSize: 20, search: "" };
  const report = await api.report(scope);
  assert.equal(report.totalVisitors, 2);
  assert.equal(report.totalSessions, 3);
  assert.equal(report.totalInterestedVisitors, 2);
  assert.equal(report.products[0].interestedVisitors, 2);
  assert.equal(
    report.series.reduce((n, bucket) => n + bucket.sessions, 0),
    3,
  );
  const list = await api.list(scope);
  assert.equal(list.total, 2);
  const visitor = list.items.find((v) => v.id === a.id);
  assert.equal(visitor.ipAddress, "1.1.1.1");
  assert.equal(visitor.sessionCount, 2);
  const detail = await api.sessionHistory(a.id, scope);
  assert.deepEqual(
    detail.items.find((s) => s.id === "a2").pages.map((p) => p.path),
    ["/contact"],
  );
  assert.equal((await api.report({ ...scope, search: "8.8.8.8" })).totalSessions, 2);
  assert.equal((await api.report({ ...scope, search: "::ffff:8.8.8.8" })).totalSessions, 2);
  assert.equal((await api.report({ ...scope, deviceType: "mobile" })).totalSessions, 0);
  assert.equal(
    (await api.get(a.id, { ...scope, from: "2021-01-01", to: "2021-12-31" })).sessionCount,
    0,
  );
  assert.equal(
    (await api.report({ ...scope, from: "2020-01-01", to: "2020-01-02" })).totalSessions,
    1,
  );
  await assert.rejects(api.get("missing", scope), { status: 404 });
});

test("product Top10 and paged drilldown keep every product without multiplying session counts", async (t) => {
  const f = await createVisitorFixture(t, 100);
  await f.collect(f.batch, f.cookie);
  const [[s]] = await f.pool.query("SELECT id FROM visitor_sessions");
  for (let i = 1; i < 100; i++)
    await f.pool.query("INSERT INTO visitor_viewed_products VALUES(?,?,?,?)", [
      s.id,
      `product-${i}`,
      f.clock.now(),
      f.clock.now(),
    ]);
  const api = createVisitorService(f.pool, f.catalogue, f.clock);
  const scope = { from: "2026-11-01", to: "2026-11-30" };
  const report = await api.report(scope);
  assert.equal(report.totalSessions, 1);
  assert.equal(report.totalProducts, 100);
  assert.equal(report.products.length, 10);
  const products = [];
  for (let page = 1; page <= 5; page++) {
    const result = await api.productReport({ ...scope, page, pageSize: 20 });
    assert.equal(result.total, 100);
    products.push(...result.items.map((p) => p.slug));
  }
  assert.equal(new Set(products).size, 100);
});

test("narrow date cohort uses its history index on 10000 sessions", async (t) => {
  const f = await createVisitorFixture(t);
  await f.collect(f.batch, f.cookie);
  const [[visitor]] = await f.pool.query("SELECT id FROM visitors");
  for (let offset = 0; offset < 10000; offset += 500) {
    const rows = Array.from({ length: 500 }, (_, i) => {
      const time = new Date(Date.UTC(2020, 0, 1) + (offset + i) * 86400000);
      return [`bulk-${offset + i}`, visitor.id, time, time, "/", "/"];
    });
    await f.pool.query(
      "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path) VALUES ?",
      [rows],
    );
  }
  await f.pool.query("ANALYZE TABLE visitor_sessions");
  const [plan] = await f.pool.query(
    "EXPLAIN SELECT s.id FROM visitor_sessions s JOIN visitors v ON v.id=s.visitor_id WHERE v.is_probe=0 AND s.started_at>='2026-11-01' AND s.started_at<'2026-11-02'",
  );
  const sessionPlan = plan.find((row) => row.table === "s");
  assert.match(sessionPlan.possible_keys, /visitor_history_window/);
  assert.equal(sessionPlan.key, "visitor_history_window");
  assert.equal(sessionPlan.type, "range");
  const report = await createVisitorService(f.pool, f.catalogue, f.clock).report({
    from: "2026-11-01",
    to: "2026-11-01",
  });
  assert.equal(report.totalSessions, 1);
});

test("one report retains a consistent snapshot while ingestion commits between aggregate queries", async (t) => {
  const f = await createVisitorFixture(t);
  await f.collect(f.batch, f.cookie);
  const [[visitor]] = await f.pool.query("SELECT id FROM visitors");
  const rawQuery = f.pool.query.bind(f.pool),
    rawConnection = f.pool.getConnection.bind(f.pool);
  const restore = [];
  let injected = false;
  const interleave =
    (query) =>
    async (sql, ...args) => {
      const result = await query(sql, ...args);
      if (!injected && typeof sql === "string" && sql.includes("COUNT(*) sessions")) {
        injected = true;
        await rawQuery(
          "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path) VALUES('interleaved',?,?,?,'/','/')",
          [visitor.id, f.clock.now(), f.clock.now()],
        );
        await rawQuery(
          "INSERT INTO visitor_viewed_products VALUES('interleaved','product-1',?,?)",
          [f.clock.now(), f.clock.now()],
        );
      }
      return result;
    };
  f.pool.query = interleave(rawQuery);
  f.pool.getConnection = async () => {
    const c = await rawConnection(),
      query = c.query.bind(c);
    c.query = interleave(query);
    restore.push(() => {
      c.query = query;
    });
    return c;
  };
  try {
    const report = await createVisitorService(f.pool, f.catalogue, f.clock).report({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    assert.equal(injected, true, "A real concurrent commit must occur during this report");
    assert.equal(report.totalSessions, 1);
    assert.equal(
      report.series.reduce((sum, point) => sum + point.sessions, 0),
      1,
    );
    assert.equal(report.totalProducts, 1);
    assert.equal(report.products.length, 1);
    const [[count]] = await rawQuery("SELECT COUNT(*) n FROM visitor_sessions");
    assert.equal(
      count.n,
      2,
      "Concurrent ingestion succeeds without entering the earlier report snapshot",
    );
  } finally {
    f.pool.query = rawQuery;
    f.pool.getConnection = rawConnection;
    for (const reset of restore) reset();
  }
});
