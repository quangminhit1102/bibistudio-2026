"use strict";
const { createHash } = require("node:crypto");
const { lstat, readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");
function validateContentMetadata(data) {
  if (
    !data ||
    Object.keys(data).sort().join() !== "compatibleMax,migrationChecksums,requiredMin" ||
    data.requiredMin !== 8 ||
    data.compatibleMax !== 8 ||
    !data.migrationChecksums ||
    Object.keys(data.migrationChecksums).join() !== "001_content.sql" ||
    !/^[a-f0-9]{64}$/.test(data.migrationChecksums["001_content.sql"] ?? "")
  )
    throw new Error("Invalid content metadata");
  return {
    requiredMin: 8,
    compatibleMax: 8,
    migrationChecksums: { "001_content.sql": data.migrationChecksums["001_content.sql"] },
  };
}
async function createContentMetadata(backend) {
  const dir = join(backend, "content-migrations"),
    info = await lstat(dir);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (await readdir(dir)).join() !== "001_content.sql"
  )
    throw new Error("Invalid content migration directory");
  const file = join(dir, "001_content.sql"),
    entry = await lstat(file);
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Invalid content migration asset");
  return validateContentMetadata({
    requiredMin: 8,
    compatibleMax: 8,
    migrationChecksums: {
      "001_content.sql": createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    },
  });
}
async function verifyContentAssets(backend, metadata) {
  if (
    JSON.stringify(await createContentMetadata(backend)) !==
    JSON.stringify(validateContentMetadata(metadata))
  )
    throw new Error("Content asset checksum mismatch");
}
function checkContentCompatibility(metadata, status) {
  const expected = validateContentMetadata(metadata);
  if (
    status?.state !== "complete" ||
    status.version !== 8 ||
    JSON.stringify(status.migrationChecksums) !== JSON.stringify(expected.migrationChecksums)
  )
    throw new Error("Incompatible content schema/checksum");
}
module.exports = {
  validateContentMetadata,
  createContentMetadata,
  verifyContentAssets,
  checkContentCompatibility,
};
