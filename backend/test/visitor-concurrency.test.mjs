import test from "node:test";
import assert from "node:assert/strict";
import { createVisitorFixture } from "./helpers/visitors.mjs";
test("same-cookie concurrent requests create one session, including after 30minute idle", async (t) => {
  const f = await createVisitorFixture(t);
  await Promise.all(Array.from({ length: 5 }, () => f.collect(f.batch, f.cookie)));
  f.clock.advance(30 * 60000 + 1);
  await Promise.all(Array.from({ length: 5 }, () => f.collect(f.batch, f.cookie)));
  const [[row]] = await f.pool.query("SELECT session_count FROM visitors");
  assert.equal(row.session_count, 2);
  const [[sessions]] = await f.pool.query("SELECT COUNT(*) n FROM visitor_sessions");
  assert.equal(sessions.n, 2);
});
test("delayed older batches never reduce server timestamps or replace a newer last route", async (t) => {
  const f = await createVisitorFixture(t);
  await f.collect(f.batch, f.cookie);
  const older = f.clock.now();
  f.clock.advance(60000);
  await f.collect({ paths: ["/contact"], products: [], lastPath: "/contact" }, f.cookie);
  const [[before]] = await f.pool.query(
    "SELECT last_received_at,last_received_path FROM visitor_sessions",
  );
  await f.collect(f.batch, f.cookie, { now: older });
  const [[after]] = await f.pool.query(
    "SELECT last_received_at,last_received_path FROM visitor_sessions",
  );
  assert.deepEqual(after, before);
});
