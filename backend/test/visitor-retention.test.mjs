import test from "node:test";
import assert from "node:assert/strict";
import { createVisitorFixture } from "./helpers/visitors.mjs";

test("bounded retention removes old analytics in FK order without touching audit/auth", async (t) => {
  const f = await createVisitorFixture(t);
  const { cleanupAnalytics } = await import("../dist/visitors/cleanup.js");
  await f.collect(f.batch, f.cookie);
  await f.pool.query("INSERT INTO audit_logs(action,created_at) VALUES ('test',?)", [
    f.clock.now(),
  ]);
  f.clock.advance(91 * 86400000);
  const bootstrap = await f.collect(f.batch);
  await f.collect(f.batch, bootstrap.cookie.value);
  const result = await cleanupAnalytics(f.pool, f.clock.now(), 1);
  assert.equal(result.sessions, 1);
  assert.equal(result.visitors, 1);
  for (const table of [
    "visitors",
    "visitor_sessions",
    "visitor_session_pages",
    "visitor_viewed_products",
    "audit_logs",
  ]) {
    const [[row]] = await f.pool.query(`SELECT COUNT(*) n FROM ${table}`);
    assert.equal(row.n, 1, table);
  }
  await assert.rejects(cleanupAnalytics(f.pool, f.clock.now(), 1001));
});

test("old associations expire even if a session remains active, then counts match retained data", async (t) => {
  const f = await createVisitorFixture(t);
  const { cleanupAnalytics } = await import("../dist/visitors/cleanup.js");
  await f.collect(f.batch, f.cookie);
  const [[session]] = await f.pool.query("SELECT id FROM visitor_sessions");
  f.clock.advance(91 * 86400000);
  // Model a long-lived active session without 90 days of artificial requests.
  await f.pool.query("UPDATE visitor_sessions SET last_received_at=? WHERE id=?", [
    f.clock.now(),
    session.id,
  ]);
  await f.pool.query("UPDATE visitors SET last_seen_at=?", [f.clock.now()]);
  await cleanupAnalytics(f.pool, f.clock.now(), 10);
  const [[remaining]] = await f.pool.query("SELECT page_count,product_count FROM visitor_sessions");
  assert.equal(remaining.page_count, 0);
  assert.equal(remaining.product_count, 0);
});
