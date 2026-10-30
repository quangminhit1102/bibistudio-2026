"use strict";
function makeManifest(sourceSha, ciRunId = null) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("Invalid source SHA");
  if (ciRunId !== null && !/^[1-9][0-9]*$/.test(String(ciRunId)))
    throw new Error("Invalid CI run ID");
  return {
    schemaVersion: 1,
    releaseId: ciRunId ? `${sourceSha}-${ciRunId}` : `local-${sourceSha}`,
    sourceSha,
    ciRunId: ciRunId ? String(ciRunId) : null,
  };
}
function validateManifest(data, { requireCI = false } = {}) {
  if (!data || data.schemaVersion !== 1) throw new Error("Invalid release manifest");
  const expected = makeManifest(data.sourceSha, data.ciRunId);
  if (data.releaseId !== expected.releaseId) throw new Error("Invalid release identity");
  if (requireCI && !data.ciRunId) throw new Error("CI release is required");
  return expected;
}
module.exports = { makeManifest, validateManifest };
