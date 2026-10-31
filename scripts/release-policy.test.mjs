import assert from "node:assert/strict";
import { test } from "node:test";
import { assertArtifactChecksum, REQUIRE_STAGING_BEFORE_PRODUCTION } from "./release-policy.mjs";

test("temporary production-only policy still requires archive integrity", () => {
  assert.equal(REQUIRE_STAGING_BEFORE_PRODUCTION, false);
  const actual = "a".repeat(64);
  assertArtifactChecksum(actual, actual + "\n", { production: true });
  assertArtifactChecksum(actual, actual, { production: true, expectedChecksum: actual });
  assert.throws(
    () =>
      assertArtifactChecksum(actual, actual, {
        production: true,
        expectedChecksum: "b".repeat(64),
      }),
    /checksum/i,
  );
  for (const declared of ["", "b".repeat(64), "not-a-checksum"]) {
    assert.throws(
      () => assertArtifactChecksum(actual, declared, { production: true }),
      /checksum/i,
    );
  }
  assert.throws(
    () => assertArtifactChecksum("invalid", "invalid", { production: true }),
    /checksum/i,
  );
});
