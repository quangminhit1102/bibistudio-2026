"use strict";
const { createHash } = require("node:crypto");
const { lstat, readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function validateVisitorContextMetadata(data) {
  if (
    !data ||
    Object.keys(data).sort().join() !==
      "compatibleMax,geoip,migrationChecksums,relaySha256,requiredMin" ||
    data.requiredMin !== 1 ||
    data.compatibleMax !== 1 ||
    !data.migrationChecksums ||
    Object.keys(data.migrationChecksums).join() !== "001_context.sql" ||
    !hex(data.migrationChecksums["001_context.sql"]) ||
    !hex(data.relaySha256) ||
    !data.geoip ||
    Object.keys(data.geoip).sort().join() !== "sha256,version" ||
    !hex(data.geoip.sha256) ||
    !/^dbip-country-lite-\d{4}-\d{2}$/.test(data.geoip.version)
  )
    throw new Error("Invalid visitor context release metadata");
  return {
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: { "001_context.sql": data.migrationChecksums["001_context.sql"] },
    relaySha256: data.relaySha256,
    geoip: { version: data.geoip.version, sha256: data.geoip.sha256 },
  };
}
async function regular(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Invalid visitor context asset");
  return readFile(file);
}
async function directory(backend, name, files) {
  const dir = join(backend, name),
    info = await lstat(dir);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (await readdir(dir)).sort().join() !== files.slice().sort().join()
  )
    throw new Error("Invalid visitor context directory");
  return dir;
}
async function createVisitorContextMetadata(backend) {
  const sql = await directory(backend, "visitor-context-migrations", ["001_context.sql"]);
  const relay = await directory(backend, "relay", ["collect.php", "context.php"]);
  const geo = await directory(backend, "geoip", ["country.mmdb", "country.lock.json"]);
  const lock = JSON.parse((await regular(join(geo, "country.lock.json"))).toString("utf8"));
  const mmdb = await regular(join(geo, "country.mmdb"));
  if (hash(mmdb) !== lock.mmdbSha256) throw new Error("Country dataset checksum mismatch");
  const relayHash = createHash("sha256");
  for (const name of ["collect.php", "context.php"])
    relayHash.update(name + "\n" + hash(await regular(join(relay, name))) + "\n");
  return validateVisitorContextMetadata({
    requiredMin: 1,
    compatibleMax: 1,
    migrationChecksums: { "001_context.sql": hash(await regular(join(sql, "001_context.sql"))) },
    relaySha256: relayHash.digest("hex"),
    geoip: { version: lock.version, sha256: hash(mmdb) },
  });
}
async function verifyVisitorContextAssets(backend, metadata) {
  if (
    JSON.stringify(await createVisitorContextMetadata(backend)) !==
    JSON.stringify(validateVisitorContextMetadata(metadata))
  )
    throw new Error("Visitor context asset checksum mismatch");
}
function checkVisitorContextCompatibility(metadata, status) {
  const expected = validateVisitorContextMetadata(metadata);
  if (
    status?.state !== "complete" ||
    status.version !== 1 ||
    JSON.stringify(status.migrationChecksums) !== JSON.stringify(expected.migrationChecksums)
  )
    throw new Error("Incompatible visitor context schema/checksum");
}
module.exports = {
  validateVisitorContextMetadata,
  createVisitorContextMetadata,
  verifyVisitorContextAssets,
  checkVisitorContextCompatibility,
};
