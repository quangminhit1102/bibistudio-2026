import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveVisitorWindow,
  selectVisitorBucket,
  visitorBuckets,
} from "../dist/visitors/date-window.js";

const now = new Date("2026-11-13T03:00:00.000Z");
const custom = (from, to = from) => resolveVisitorWindow({ from, to }, now);

test("date-only range includes both Vietnam calendar days and preserves asOf", () => {
  assert.deepEqual(custom("2026-11-01", "2026-11-13"), {
    fromDate: "2026-11-01",
    toDate: "2026-11-13",
    startUtc: "2026-10-31T17:00:00.000Z",
    endUtcExclusive: "2026-11-13T17:00:00.000Z",
    asOf: now.toISOString(),
  });
  const same = custom("2026-11-13");
  assert.equal(Date.parse(same.endUtcExclusive) - Date.parse(same.startUtc), 86400000);
  assert.equal(custom("9999-12-31").endUtcExclusive, "9999-12-31T17:00:00.000Z");
});

test("rejects invalid, partial, reversed or ambiguous date input", () => {
  for (const input of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-11-01" },
    { to: "2026-11-13" },
    { from: "2026-11-14", to: "2026-11-13" },
    { preset: "1m", from: "2026-11-01", to: "2026-11-13" },
    { from: "1969-12-31", to: "2026-11-13" },
    { preset: "7d" },
    { from: "2026-1-01", to: "2026-11-13" },
    { from: "", to: "" },
  ])
    assert.throws(() => resolveVisitorWindow(input, now), { status: 400 });
  assert.throws(() => resolveVisitorWindow({}, new Date("invalid")), { status: 400 });
});

test("rolling presets use calendar boundaries, leap-year clamps and Vietnam clock", () => {
  assert.equal(resolveVisitorWindow({}, now).fromDate, "2026-10-14");
  assert.equal(resolveVisitorWindow({ preset: "6m" }, now).fromDate, "2026-05-14");
  assert.equal(resolveVisitorWindow({ preset: "1y" }, now).fromDate, "2025-11-14");
  assert.equal(
    resolveVisitorWindow({ preset: "1m" }, new Date("2024-03-30T12:00Z")).fromDate,
    "2024-02-29",
  );
  assert.equal(resolveVisitorWindow({}, new Date("2026-11-13T18:00Z")).toDate, "2026-11-14");
  assert.equal(custom("2028-02-29").fromDate, "2028-02-29");
  assert.equal(custom("2030-01-01").toDate, "2030-01-01");
});

test("adaptive zero-filled buckets are contiguous, bounded and Monday aligned", () => {
  for (const [end, unit] of [
    ["2026-11-02", "hour"],
    ["2026-12-01", "day"],
    ["2027-11-01", "week"],
    ["2030-11-01", "month"],
    ["2100-11-01", "year"],
  ]) {
    const window = custom("2026-11-01", end);
    assert.equal(selectVisitorBucket(window), unit);
    const buckets = visitorBuckets(window);
    assert.equal(buckets[0].startUtc, window.startUtc);
    assert.equal(buckets.at(-1).endUtcExclusive, window.endUtcExclusive);
    assert.ok(buckets.length <= 2160);
    for (let i = 0; i < buckets.length; i++) {
      assert.equal(buckets[i].sessions, 0);
      assert.ok(Date.parse(buckets[i].startUtc) < Date.parse(buckets[i].endUtcExclusive));
      if (i) assert.equal(buckets[i - 1].endUtcExclusive, buckets[i].startUtc);
    }
    if (unit === "week") assert.equal(buckets[1].startUtc, "2026-11-01T17:00:00.000Z");
  }
});
