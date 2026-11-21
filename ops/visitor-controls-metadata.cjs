"use strict";
const { createHash } = require("node:crypto");
const { lstat, readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");
function validateVisitorControlsMetadata(data) {
  if (
    !data ||
    Object.keys(data).sort().join() !== "compatibleMax,migrationChecksums,requiredMin" ||
    data.requiredMin !== 1 ||
    data.compatibleMax !== 1 ||
    !data.migrationChecksums ||
    Object.keys(data.migrationChecksums).join() !== "001_controls.sql" ||
    !/^[a-f0-9]{64}$/.test(data.migrationChecksums["001_controls.sql"] ?? "")
  )
    throw new Error("Invalid visitor controls metadata");
  return {
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: { "001_controls.sql": data.migrationChecksums["001_controls.sql"] },
  };
}
async function createVisitorControlsMetadata(backend) {
  const dir = join(backend, "visitor-controls-migrations"),
    info = await lstat(dir);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (await readdir(dir)).join() !== "001_controls.sql"
  )
    throw new Error("Invalid visitor controls migration directory");
  const file = join(dir, "001_controls.sql"),
    entry = await lstat(file);
  if (!entry.isFile() || entry.isSymbolicLink())
    throw new Error("Invalid controls migration asset");
  return validateVisitorControlsMetadata({
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: {
      "001_controls.sql": createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    },
  });
}
async function verifyVisitorControlsAssets(backend, metadata) {
  if (
    JSON.stringify(await createVisitorControlsMetadata(backend)) !==
    JSON.stringify(validateVisitorControlsMetadata(metadata))
  )
    throw new Error("Visitor controls asset checksum mismatch");
}
function checkVisitorControlsCompatibility(metadata, status) {
  const expected = validateVisitorControlsMetadata(metadata);
  if (
    status?.state !== "complete" ||
    status.version !== 1 ||
    JSON.stringify(status.migrationChecksums) !== JSON.stringify(expected.migrationChecksums)
  )
    throw new Error("Incompatible visitor controls schema/checksum");
}
module.exports = {
  validateVisitorControlsMetadata,
  createVisitorControlsMetadata,
  verifyVisitorControlsAssets,
  checkVisitorControlsCompatibility,
};
