import test from "node:test";
import assert from "node:assert/strict";
test("exclusion rules canonicalize addresses and match safe wildcard patterns", async () => {
  const { normalizeExclusionRules: n, isExcludedIp: m } =
    await import("../dist/visitors/exclusions.js");
  assert.deepEqual(n([" ::ffff:192.0.2.1 ", "192.0.2.1", "2001:0db8::1", "192.000.2.*"]), [
    "192.0.2.1",
    "2001:db8::1",
    "192.0.2.*",
  ]);
  assert.equal(m("::ffff:192.0.2.42", ["192.0.2.*"]), true);
  assert.equal(m(null, ["192.0.2.*"]), false);
  assert.equal(m("192.0.3.42", ["192.0.2.*"]), false);
  for (const rule of [
    "*.*.*.*",
    "192.0.*",
    "256.0.0.*",
    "1.2.3.-1",
    "2001::*",
    "127.1",
    "0x7f000001",
    "::1%eth0",
    "1.2.3.4/32",
  ])
    assert.throws(() => n([rule]), { status: 400 });
  assert.throws(() => n(Array(201).fill("1.2.3.4")), { status: 400 });
});
