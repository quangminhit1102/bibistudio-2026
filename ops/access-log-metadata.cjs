"use strict";
const { createHash } = require("node:crypto");
const { readFile, readdir, lstat } = require("node:fs/promises");
const { join } = require("node:path");
function validateAccessLogMetadata(data) {
  if (
    !data ||
    data.requiredMin !== 2 ||
    data.compatibleMax !== 2 ||
    !data.migrationChecksums ||
    Object.keys(data).sort().join(",") !== "compatibleMax,migrationChecksums,requiredMin" ||
    Object.keys(data.migrationChecksums).sort().join(",") !==
      "001_access_logs.sql,002_current_cache.sql" ||
    !Object.values(data.migrationChecksums).every((hash) => /^[a-f0-9]{64}$/.test(hash))
  )
    throw new Error("Invalid access log release metadata");
  return {
    requiredMin: 2,
    compatibleMax: 2,
    migrationChecksums: {
      "001_access_logs.sql": data.migrationChecksums["001_access_logs.sql"],
      "002_current_cache.sql": data.migrationChecksums["002_current_cache.sql"],
    },
  };
}
async function createAccessLogMetadata(backend) {
  const directory = join(backend, "access-log-migrations");
  if (!(await lstat(directory)).isDirectory())
    throw new Error("Invalid access log migration directory");
  const names = (await readdir(directory)).sort();
  if (
    names.join(",") !== "001_access_logs.sql,002_current_cache.sql" ||
    !(
      await Promise.all(names.map(async (name) => (await lstat(join(directory, name))).isFile()))
    ).every(Boolean)
  )
    throw new Error("Invalid access log migration assets");
  return validateAccessLogMetadata({
    requiredMin: 2,
    compatibleMax: 2,
    migrationChecksums: Object.fromEntries(
      await Promise.all(
        names.map(async (name) => [
          name,
          createHash("sha256")
            .update(await readFile(join(directory, name)))
            .digest("hex"),
        ]),
      ),
    ),
  });
}
async function verifyAccessLogAssets(backend, metadata) {
  const expected = validateAccessLogMetadata(metadata),
    actual = await createAccessLogMetadata(backend);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Access log asset checksum mismatch");
}
function checkAccessLogCompatibility(metadata, status) {
  const expected = validateAccessLogMetadata(metadata);
  if (
    status?.state !== "complete" ||
    status.version !== 2 ||
    JSON.stringify(status.checksums) !== JSON.stringify(expected.migrationChecksums)
  )
    throw new Error("Incompatible access log schema/checksum");
}
module.exports = {
  validateAccessLogMetadata,
  createAccessLogMetadata,
  verifyAccessLogAssets,
  checkAccessLogCompatibility,
};
