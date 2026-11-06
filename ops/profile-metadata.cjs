"use strict";
const { createHash } = require("node:crypto");
const { readFile, readdir, lstat } = require("node:fs/promises");
const { join } = require("node:path");
function validateProfileMetadata(data) {
  if (
    !data ||
    data.assetFormatVersion !== 1 ||
    data.requiredMin !== 1 ||
    data.compatibleMax !== 1 ||
    !data.migrationChecksums ||
    Object.keys(data).sort().join(",") !==
      "assetFormatVersion,compatibleMax,migrationChecksums,requiredMin" ||
    Object.keys(data.migrationChecksums).sort().join(",") !== "001_profiles.sql" ||
    !Object.values(data.migrationChecksums).every((hash) => /^[a-f0-9]{64}$/.test(hash))
  )
    throw new Error("Invalid profile release metadata");
  return {
    assetFormatVersion: 1,
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: {
      "001_profiles.sql": data.migrationChecksums["001_profiles.sql"],
    },
  };
}
async function createProfileMetadata(backend) {
  const directory = join(backend, "profile-migrations");
  if (!(await lstat(directory)).isDirectory())
    throw new Error("Invalid profile migration directory");
  const names = (await readdir(directory)).sort();
  if (
    names.join(",") !== "001_profiles.sql" ||
    !(
      await Promise.all(names.map(async (name) => (await lstat(join(directory, name))).isFile()))
    ).every(Boolean)
  )
    throw new Error("Invalid profile migration assets");
  return validateProfileMetadata({
    assetFormatVersion: 1,
    requiredMin: 1,
    compatibleMax: 1,
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
async function createProfileRuntimeMetadata(backend) {
  const directory = join(backend, "dist/profile"),
    info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("Invalid profile runtime directory");
  const names = (await readdir(directory)).sort();
  if (
    names.length > 128 ||
    ![
      "cli.js",
      "backup-cli.js",
      "avatar-worker.js",
      "avatar-codec.js",
      "avatar-header.js",
      "avatar-store.js",
    ].every((name) => names.includes(name))
  )
    throw new Error("Missing profile runtime asset");
  const hashes = {};
  let total = 0;
  for (const name of names) {
    const file = join(directory, name),
      stat = await lstat(file);
    total += stat.size;
    if (
      !/^[a-z-]+\.js(?:\.map)?$/.test(name) ||
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      total > 20 * 1024 ** 2
    )
      throw new Error("Invalid profile runtime asset");
    hashes[name] = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  }
  return hashes;
}
async function verifyProfileAssets(backend, metadata) {
  const file = join(backend, "profile-runtime.json"),
    stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32768)
    throw new Error("Invalid profile runtime metadata");
  const recorded = JSON.parse(await readFile(file, "utf8")),
    runtime = await createProfileRuntimeMetadata(backend);
  if (JSON.stringify(recorded) !== JSON.stringify(runtime))
    throw new Error("Profile runtime checksum mismatch");
  const expected = validateProfileMetadata(metadata),
    actual = await createProfileMetadata(backend);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Profile asset checksum mismatch");
}
function checkProfileCompatibility(metadata, status) {
  const expected = validateProfileMetadata(metadata);
  if (
    status?.state !== "complete" ||
    status.version !== 1 ||
    JSON.stringify(status.migrationChecksums) !== JSON.stringify(expected.migrationChecksums)
  )
    throw new Error("Incompatible profile schema/checksum");
}
module.exports = {
  validateProfileMetadata,
  createProfileMetadata,
  createProfileRuntimeMetadata,
  verifyProfileAssets,
  checkProfileCompatibility,
};
