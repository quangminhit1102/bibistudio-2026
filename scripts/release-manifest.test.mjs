import assert from "node:assert/strict";
import { test } from "node:test";
import { makeManifest, validateManifest } from "./release-manifest.mjs";
test("CI release identity is bound to source SHA and run ID", () => {
  const sha = "a".repeat(40);
  assert.deepEqual(makeManifest(sha, "123"), {
    schemaVersion: 1,
    releaseId: sha + "-123",
    sourceSha: sha,
    ciRunId: "123",
  });
  assert.throws(() => makeManifest("main", "123"), /SHA/);
  assert.throws(
    () => validateManifest({ ...makeManifest(sha, "123"), releaseId: "../outside" }),
    /release/i,
  );
});
test("local artifacts cannot impersonate CI releases", () => {
  const m = makeManifest("b".repeat(40));
  assert.equal(m.ciRunId, null);
  assert.match(m.releaseId, /^local-/);
  assert.throws(() => validateManifest(m, { requireCI: true }), /CI/);
});
