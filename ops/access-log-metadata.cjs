"use strict";
const { createHash } = require("node:crypto");
const { readFile, readdir, lstat } = require("node:fs/promises");
const { join } = require("node:path");
function validateAccessLogMetadata(data) {
  if (
    !data ||
    data.requiredMin !== 1 ||
    data.compatibleMax !== 1 ||
    !data.migrationChecksums ||
    Object.keys(data).sort().join(",") !== "compatibleMax,migrationChecksums,requiredMin" ||
    Object.keys(data.migrationChecksums).join(",") !== "001_access_logs.sql" ||
    !/^[a-f0-9]{64}$/.test(data.migrationChecksums["001_access_logs.sql"])
  )
    throw new Error("Invalid access log release metadata");
  return {
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: { "001_access_logs.sql": data.migrationChecksums["001_access_logs.sql"] },
  };
}
async function createAccessLogMetadata(backend) {
  const directory = join(backend, "access-log-migrations");
  if (!(await lstat(directory)).isDirectory())
    throw new Error("Invalid access log migration directory");
  const names = await readdir(directory);
  if (
    names.length !== 1 ||
    names[0] !== "001_access_logs.sql" ||
    !(await lstat(join(directory, names[0]))).isFile()
  )
    throw new Error("Invalid access log migration assets");
  return validateAccessLogMetadata({
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: {
      [names[0]]: createHash("sha256")
        .update(await readFile(join(directory, names[0])))
        .digest("hex"),
    },
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
    status.version !== 1 ||
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
