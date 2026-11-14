import test from "node:test";
import assert from "node:assert/strict";
import { writeVisitorContext } from "../dist/visitors/context-write.js";
const at = new Date("2026-11-13T10:00:00Z"),
  now = new Date(+at + 1000);
const current = {
  ip_status: "observed",
  client_ip: "8.8.8.8",
  ip_source: "php_relay",
  ip_observed_at: "2026-11-13 10:00:00.000",
  country_code: "US",
  country_name: "United States",
  country_dataset: "pinned",
  country_resolved_at: "2026-11-13 10:00:00.000",
};
async function write(row, ip, lookup) {
  const writes = [];
  await writeVisitorContext(
    {
      execute: async (sql, args) => {
        writes.push({ sql, args });
        return [[], []];
      },
    },
    {
      sessionId: "session",
      current: row,
      observation: { ip, observedAt: now, requestId: "a".repeat(32), source: "php_relay" },
      verifiedAddress: null,
      countryLookup: { lookup, close() {} },
      now,
    },
  );
  return writes.at(-1).args;
}
test("same resolved IP preserves country snapshot and does not repeat lookup", async () => {
  let calls = 0;
  const args = await write(current, "8.8.8.8", () => {
    calls++;
    throw new Error("temporary lookup failure");
  });
  assert.equal(calls, 0);
  assert.deepEqual(args.slice(4, 8), [
    "US",
    "United States",
    "pinned",
    current.country_resolved_at,
  ]);
  assert.equal(args[3], now);
});
test("changed IP clears stale country on miss and unresolved same IP can resolve later", async () => {
  let calls = 0;
  const args = await write(current, "1.1.1.1", () => {
    calls++;
    return null;
  });
  assert.equal(calls, 1);
  assert.deepEqual(args.slice(4, 8), [null, null, null, null]);
  const resolved = await write(
    {
      ...current,
      client_ip: "1.1.1.1",
      country_code: null,
      country_name: null,
      country_dataset: null,
      country_resolved_at: null,
    },
    "1.1.1.1",
    () => ({ code: "AU", name: "Australia", dataset: "pinned" }),
  );
  assert.deepEqual(resolved.slice(4, 8), ["AU", "Australia", "pinned", now]);
});
