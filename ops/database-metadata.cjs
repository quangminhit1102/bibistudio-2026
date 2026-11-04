"use strict";
const { createHash } = require("node:crypto");
const { readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
function validateDatabaseMetadata(data) {
  const invalid = () => new Error("Invalid database release metadata");
  if (
    !data ||
    !Number.isInteger(data.requiredMin) ||
    data.requiredMin < 1 ||
    !Number.isInteger(data.compatibleMax) ||
    data.compatibleMax < data.requiredMin ||
    data.compatibleMax > 10000 ||
    !/^[a-f0-9]{64}$/.test(data.catalogueChecksum ?? "") ||
    !data.migrationChecksums ||
    typeof data.migrationChecksums !== "object" ||
    Array.isArray(data.migrationChecksums)
  )
    throw invalid();
  const names = Object.keys(data.migrationChecksums).sort();
  if (!names.length || names.length < data.requiredMin || names.length > data.compatibleMax)
    throw invalid();
  for (let i = 0; i < names.length; i++)
    if (
      !/^\d{3}_[a-z_]+\.sql$/.test(names[i]) ||
      Number(names[i].slice(0, 3)) !== i + 1 ||
      !/^[a-f0-9]{64}$/.test(data.migrationChecksums[names[i]])
    )
      throw invalid();
  return {
    requiredMin: data.requiredMin,
    compatibleMax: data.compatibleMax,
    migrationChecksums: Object.fromEntries(
      names.map((name) => [name, data.migrationChecksums[name]]),
    ),
    catalogueChecksum: data.catalogueChecksum,
  };
}
async function createDatabaseMetadata(backend) {
  const names = (await readdir(join(backend, "migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const migrationChecksums = {};
  for (const name of names)
    migrationChecksums[name] = checksum(await readFile(join(backend, "migrations", name)));
  return validateDatabaseMetadata({
    requiredMin: names.length,
    compatibleMax: names.length,
    migrationChecksums,
    catalogueChecksum: checksum(await readFile(join(backend, "analytics-catalogue.json"))),
  });
}
async function verifyDatabaseAssets(backend, metadata) {
  const expected = validateDatabaseMetadata(metadata);
  let actual;
  try {
    actual = await createDatabaseMetadata(backend);
  } catch {
    throw new Error("Database migration/catalogue assets missing or invalid");
  }
  if (
    JSON.stringify(actual.migrationChecksums) !== JSON.stringify(expected.migrationChecksums) ||
    actual.catalogueChecksum !== expected.catalogueChecksum
  )
    throw new Error("Database asset checksum mismatch");
}
function checkDatabaseCompatibility(release, schema) {
  if (!release.database)
    throw new Error("Pre-auth release requires explicit degraded-admin rollback handling");
  const database = validateDatabaseMetadata(release.database);
  if (
    !schema ||
    schema.state !== "complete" ||
    !Number.isInteger(schema.version) ||
    schema.version < database.requiredMin ||
    schema.version > database.compatibleMax
  )
    throw new Error("Incompatible database schema");
  for (const [name, hash] of Object.entries(database.migrationChecksums))
    if (schema.migrationChecksums?.[name] !== hash)
      throw new Error("Database history checksum mismatch");
}
module.exports = {
  createDatabaseMetadata,
  validateDatabaseMetadata,
  verifyDatabaseAssets,
  checkDatabaseCompatibility,
};
