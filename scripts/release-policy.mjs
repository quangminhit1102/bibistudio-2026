// Restore the archived staging workflow before changing this back to true.
export const REQUIRE_STAGING_BEFORE_PRODUCTION = false;

export function assertArtifactChecksum(
  actual,
  declared,
  { production = false, expectedChecksum } = {},
) {
  if (
    !/^[a-f0-9]{64}$/.test(actual) ||
    declared.trim() !== actual ||
    (production &&
      (REQUIRE_STAGING_BEFORE_PRODUCTION || expectedChecksum) &&
      expectedChecksum !== actual)
  )
    throw new Error("Artifact checksum mismatch");
}
