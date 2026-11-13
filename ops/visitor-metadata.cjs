"use strict";
const { createHash } = require("node:crypto");
const { readFile, readdir, lstat } = require("node:fs/promises");
const { join } = require("node:path");
function validateVisitorMetadata(data) {
  if (
    !data ||
    data.requiredMin !== 1 ||
    data.compatibleMax !== 1 ||
    Object.keys(data).sort().join() !== "compatibleMax,migrationChecksums,requiredMin" ||
    !data.migrationChecksums ||
    Object.keys(data.migrationChecksums).join() !== "001_history.sql" ||
    !/^[a-f0-9]{64}$/.test(data.migrationChecksums["001_history.sql"])
  )
    throw new Error("Invalid visitor history release metadata");
  return {
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: { "001_history.sql": data.migrationChecksums["001_history.sql"] },
  };
}
async function createVisitorMetadata(backend) {
  const directory = join(backend, "visitor-migrations"),
    info = await lstat(directory);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (await readdir(directory)).sort().join() !== "001_history.sql"
  )
    throw new Error("Invalid visitor migration assets");
  const file = join(directory, "001_history.sql"),
    stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Invalid visitor migration asset");
  return validateVisitorMetadata({
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: {
      "001_history.sql": createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    },
  });
}
async function verifyVisitorAssets(backend, metadata) {
  if (
    JSON.stringify(await createVisitorMetadata(backend)) !==
    JSON.stringify(validateVisitorMetadata(metadata))
  )
    throw new Error("Visitor history asset checksum mismatch");
}
function checkVisitorCompatibility(metadata, status) {
  const expected = validateVisitorMetadata(metadata);
  if (
    status?.state !== "complete" ||
    status.version !== 1 ||
    JSON.stringify(status.migrationChecksums) !== JSON.stringify(expected.migrationChecksums)
  )
    throw new Error("Incompatible visitor history schema/checksum");
}
module.exports = {
  validateVisitorMetadata,
  createVisitorMetadata,
  verifyVisitorAssets,
  checkVisitorCompatibility,
};
