import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createVisitorFixture } from "./helpers/visitors.mjs";
import { migrateVisitorContext } from "../dist/visitors/context-schema.js";
import { createVisitorService } from "../dist/visitors/service.js";
const lookup = {
  lookup(ip) {
    return ip === "8.8.8.8" ? { code: "US", name: "United States", dataset: "test-country" } : null;
  },
  close() {},
};
async function fixture(t) {
  const f = await createVisitorFixture(t);
  await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
  return f;
}
const observation = (f, ip = "8.8.8.8", when = f.clock.now()) => ({
  ip,
  observedAt: when,
  requestId: randomBytes(16).toString("hex"),
  source: "php_relay",
});
const context = (f, ip) => ({
  contextEnabled: true,
  countryLookup: lookup,
  relayObservation: observation(f, ip),
});
const session = async (f) =>
  (await f.pool.query("SELECT * FROM visitor_sessions ORDER BY started_at DESC"))[0][0];
test("observed IP/country snapshot follows time and session, unsigned never forges or erases it", async (t) => {
  const f = await fixture(t);
  const initial = observation(f);
  assert.equal(
    (await f.collect(f.batch, undefined, { ...context(f), relayObservation: initial })).status,
    202,
  );
  assert.equal(
    (await f.collect(f.batch, undefined, { ...context(f), relayObservation: initial })).status,
    202,
  );
  for (const table of ["visitors", "visitor_sessions", "analytics_relay_receipts"])
    assert.equal((await f.pool.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n, 0);
  await f.collect(f.batch, f.cookie, context(f));
  let row = await session(f);
  assert.equal(row.client_ip, "8.8.8.8");
  assert.equal(row.ip_status, "observed");
  assert.equal(row.ip_source, "php_relay");
  assert.equal(row.country_code, "US");
  assert.equal(row.country_dataset, "test-country");
  const old = observation(f);
  f.clock.advance(5000);
  await f.collect(f.batch, f.cookie, context(f, "1.1.1.1"));
  row = await session(f);
  assert.equal(row.client_ip, "1.1.1.1");
  assert.equal(row.country_code, null);
  assert.equal(row.country_name, null);
  await f.collect(f.batch, f.cookie, { ...context(f), relayObservation: old });
  assert.equal((await session(f)).client_ip, "1.1.1.1");
  await f.collect(f.batch, f.cookie, { contextEnabled: true, countryLookup: lookup });
  assert.equal((await session(f)).ip_status, "observed");
  // A retained v5 collector may overwrite only the old status column during rollback.
  await f.pool.query("UPDATE visitor_sessions SET ip_status='unavailable'");
  const service = createVisitorService(f.pool, f.catalogue, f.clock, true);
  assert.equal(
    (await service.list({ page: 1, pageSize: 10, search: "1.1.1.1" })).total,
    1,
    "search retains versioned snapshot before the visitor returns",
  );
  await f.collect(f.batch, f.cookie, { contextEnabled: true, countryLookup: lookup });
  assert.equal(
    (await session(f)).client_ip,
    "1.1.1.1",
    "preserve versioned snapshot across a legacy status write",
  );
  let list = await service.list({ page: 1, pageSize: 10, search: "1.1.1.1" });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].ipStatus, "observed");
  assert.equal(list.items[0].country, null);
  f.clock.advance(31 * 60000);
  await f.collect(f.batch, f.cookie, { contextEnabled: true, countryLookup: lookup });
  row = await session(f);
  assert.equal(row.client_ip, null);
  assert.equal(row.ip_status, "unavailable");
  assert.equal(row.country_code, null);
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitor_sessions"))[0][0].n, 2);
});
test("verified observation cannot be downgraded by observed or legacy batches", async (t) => {
  const f = await fixture(t);
  await f.collect(f.batch, f.cookie, {
    contextEnabled: true,
    countryLookup: lookup,
    ip: "8.8.8.8",
    peer: "127.0.0.1",
    sourceVerified: true,
    trustedCidrs: ["127.0.0.1/32"],
  });
  f.clock.advance(1000);
  await f.collect(f.batch, f.cookie, context(f, "1.1.1.1"));
  assert.equal((await session(f)).client_ip, "8.8.8.8");
  assert.equal((await session(f)).ip_status, "verified");
});
test("concurrent replay inserts one receipt/session and rolls back receipt if associations fail", async (t) => {
  const f = await fixture(t);
  const extra = context(f);
  const results = await Promise.allSettled([
    f.collect(f.batch, f.cookie, extra),
    f.collect(f.batch, f.cookie, extra),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
  for (const table of [
    "visitors",
    "visitor_sessions",
    "visitor_session_pages",
    "visitor_viewed_products",
    "analytics_relay_receipts",
  ])
    assert.equal((await f.pool.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n, 1);
  const [[r]] = await f.pool.query("SELECT expires_at FROM analytics_relay_receipts");
  assert.equal(new Date(r.expires_at + "Z").getTime(), f.clock.now().getTime() + 60000);
  await f.pool.query("INSERT INTO analytics_relay_receipts(request_id,expires_at) VALUES(?,?)", [
    Buffer.from(randomBytes(16)),
    new Date(+f.clock.now() - 1000),
  ]);
  const [rows] = await f.pool.query("SELECT request_id FROM analytics_relay_receipts");
  assert.equal(rows.length, 2);
  const batch = { paths: ["/contact"], products: [], lastPath: "/contact" };
  await f.pool.query("ALTER TABLE visitor_session_pages RENAME TO visitor_session_pages_hidden");
  const pending = context(f);
  await assert.rejects(f.collect(batch, f.cookie, pending));
  await f.pool.query("ALTER TABLE visitor_session_pages_hidden RENAME TO visitor_session_pages");
  assert.equal(
    (
      await f.pool.query("SELECT COUNT(*) n FROM analytics_relay_receipts WHERE request_id=?", [
        Buffer.from(pending.relayObservation.requestId, "hex"),
      ])
    )[0][0].n,
    0,
  );
});
test("privacy writes nothing; expired receipt cleanup bounded to 100 and history never deleted", async (t) => {
  const f = await fixture(t);
  const extra = {
    ...context(f),
    doNotTrack: true,
    countryLookup: {
      lookup() {
        throw new Error("privacy lookup");
      },
      close() {},
    },
  };
  await f.collect(f.batch, f.cookie, extra);
  for (const table of ["visitors", "visitor_sessions", "analytics_relay_receipts"])
    assert.equal((await f.pool.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n, 0);
  const values = Array.from({ length: 150 }, () => [
    randomBytes(16),
    new Date(+f.clock.now() - 1000),
  ]);
  await f.pool.query("INSERT INTO analytics_relay_receipts(request_id,expires_at) VALUES ?", [
    values,
  ]);
  await f.collect(f.batch, f.cookie, context(f));
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM analytics_relay_receipts"))[0][0].n, 51);
  assert.equal((await session(f)).page_count, 1);
});

test("collector preserves the resolved country/time for unchanged IP during lookup failure", async (t) => {
  const f = await fixture(t);
  await f.collect(f.batch, f.cookie, context(f));
  const before = await session(f);
  f.clock.advance(1000);
  let calls = 0;
  await f.collect(f.batch, f.cookie, {
    ...context(f),
    countryLookup: {
      lookup() {
        calls++;
        throw new Error("temporary fixture lookup failure");
      },
      close() {},
    },
  });
  const after = await session(f);
  assert.equal(calls, 0);
  for (const field of [
    "client_ip",
    "country_code",
    "country_name",
    "country_dataset",
    "country_resolved_at",
  ])
    assert.equal(after[field], before[field], field);
  assert.ok(new Date(after.ip_observed_at) > new Date(before.ip_observed_at));
});
