import test from "node:test";
import assert from "node:assert/strict";
import { createVisitorFixture } from "./helpers/visitors.mjs";
import { migrateVisitorHistory } from "../dist/visitors/schema.js";
import { resolve } from "node:path";

test("session metadata follows cookie identity, keeps verified IP and exact inactivity boundary", async (t) => {
  const f = await createVisitorFixture(t);
  await migrateVisitorHistory(f.pool, resolve("backend/visitor-migrations"));
  const verified = {
    peer: "127.0.0.1",
    sourceVerified: true,
    trustedCidrs: ["127.0.0.1/32"],
    ip: "8.8.8.8",
  };
  await f.collect(f.batch, f.cookie, verified);
  f.clock.advance(30 * 60000);
  await Promise.all([
    f.collect(f.batch, f.cookie, { ip: "127.0.0.1" }),
    f.collect(f.batch, f.cookie, { ip: "127.0.0.1" }),
  ]);
  const [[same]] = await f.pool.query("SELECT * FROM visitor_sessions");
  assert.equal(same.client_ip, "8.8.8.8");
  assert.equal(same.ip_status, "verified");
  assert.equal(same.page_count, 1);
  assert.equal(same.product_count, 1);
  f.clock.advance(30 * 60000 + 1);
  await f.collect(f.batch, f.cookie, {
    ...verified,
    ip: "1.1.1.1",
    userAgent: "Windows Edge/123.0",
  });
  const [sessions] = await f.pool.query("SELECT * FROM visitor_sessions ORDER BY started_at");
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].client_ip, "8.8.8.8");
  assert.equal(sessions[1].client_ip, "1.1.1.1");
  assert.equal(sessions[1].operating_system, "Windows");
  const other = await f.collect(f.batch, undefined, verified);
  await f.collect(f.batch, other.cookie.value, verified);
  const [[visitors]] = await f.pool.query("SELECT COUNT(*) n FROM visitors");
  assert.equal(visitors.n, 2);
});
