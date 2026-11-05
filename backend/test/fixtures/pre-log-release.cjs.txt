"use strict";
const { validateDatabaseMetadata } = require("./database-metadata.cjs");
function makeManifest(sourceSha, ciRunId = null, database) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("Invalid source SHA");
  if (ciRunId !== null && !/^[1-9][0-9]*$/.test(String(ciRunId)))
    throw new Error("Invalid CI run ID");
  return {
    schemaVersion: database ? 2 : 1,
    releaseId: ciRunId ? `${sourceSha}-${ciRunId}` : `local-${sourceSha}`,
    sourceSha,
    ciRunId: ciRunId ? String(ciRunId) : null,
    ...(database ? { database: validateDatabaseMetadata(database) } : {}),
  };
}
function validateManifest(data, { requireCI = false } = {}) {
  if (
    !data ||
    ![1, 2].includes(data.schemaVersion) ||
    (data.schemaVersion === 1 && Object.hasOwn(data, "database")) ||
    (data.schemaVersion === 2 && !data.database)
  )
    throw new Error("Invalid release manifest");
  const expected = makeManifest(data.sourceSha, data.ciRunId, data.database);
  if (data.releaseId !== expected.releaseId) throw new Error("Invalid release identity");
  if (requireCI && !data.ciRunId) throw new Error("CI release is required");
  return expected;
}
module.exports = { makeManifest, validateManifest };
