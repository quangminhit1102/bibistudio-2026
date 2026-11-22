"use strict";
const { createHash } = require("node:crypto");
const { lstat, readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");
const MIGRATION_FILES = ["001_content.sql", "002_content_v9.sql"];
const knownFiles = (names) =>
  names.join(",") === MIGRATION_FILES[0] || names.join(",") === MIGRATION_FILES.join(",");
function validateContentMetadata(data) {
  if (
    !data ||
    data.requiredMin !== 8 ||
    data.compatibleMax !== 8 ||
    Object.keys(data).sort().join(",") !== "compatibleMax,migrationChecksums,requiredMin" ||
    !data.migrationChecksums ||
    !knownFiles(Object.keys(data.migrationChecksums).sort()) ||
    !Object.values(data.migrationChecksums).every((hash) => /^[a-f0-9]{64}$/.test(hash))
  )
    throw new Error(
      "Invalid content metadata: keys=" +
        JSON.stringify(Object.keys(data ?? {})) +
        " checksumKeys=" +
        JSON.stringify(Object.keys(data?.migrationChecksums ?? {})),
    );
  return {
    requiredMin: 8,
    compatibleMax: 8,
    migrationChecksums: Object.fromEntries(
      Object.keys(data.migrationChecksums)
        .sort()
        .map((name) => [name, data.migrationChecksums[name]]),
    ),
  };
}
async function createContentMetadata(backend) {
  const dir = join(backend, "content-migrations"),
    info = await lstat(dir);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("Invalid content migration directory");
  const names = (await readdir(dir)).sort();
  if (
    !knownFiles(names) ||
    !(
      await Promise.all(
        names.map(async (name) => {
          const entry = await lstat(join(dir, name));
          return entry.isFile() && !entry.isSymbolicLink();
        }),
      )
    ).every(Boolean)
  )
    throw new Error("Invalid content migration assets");
  return validateContentMetadata({
    requiredMin: 8,
    compatibleMax: 8,
    migrationChecksums: Object.fromEntries(
      await Promise.all(
        names.map(async (name) => [
          name,
          createHash("sha256")
            .update(await readFile(join(dir, name)))
            .digest("hex"),
        ]),
      ),
    ),
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
