"use strict";
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { verifyDatabaseAssets, checkDatabaseCompatibility } = require("./database-metadata.cjs");
const execute = promisify(execFile);

/** Fixed host-only commands. No SQL, password or arbitrary executable from SSH input. */
async function runDatabaseTool(config, dir, command, manifest) {
  if (!["backup", "migrate", "seed", "status"].includes(command))
    throw new Error("Unsupported database operation");
  const privateFile = path.join(config.root, "private/maintenance.env");
  const backup = command === "backup";
  const args = backup
    ? [path.join(dir, "backend/dist/db/backup-cli.js"), manifest.releaseId]
    : [path.join(dir, "backend/dist/db/cli.js"), command];
  try {
    const { stdout } = await execute(path.join(config.runtimeBin, "node"), args, {
      cwd: path.join(dir, "backend"),
      env: {
        PATH: config.runtimeBin + path.delimiter + "/usr/bin:/bin",
        NODE_ENV: "production",
        [backup ? "BIBI_MAINTENANCE_ENV_FILE" : "BIBI_PRIVATE_ENV_FILE"]: privateFile,
      },
      timeout: backup ? 300000 : 120000,
      maxBuffer: 65536,
      windowsHide: true,
    });
    return JSON.parse(stdout.trim());
  } catch {
    throw new Error(`Private database ${command} failed; activation forbidden`);
  }
}
function assertRollbackCompatible(manifest, schema, options = {}) {
  if (!manifest.database && options.allowPreAuth === true) return { degradedAdmin: true };
  checkDatabaseCompatibility(manifest, schema);
  return { degradedAdmin: false };
}
async function prepareDatabase(config, release, { run = runDatabaseTool } = {}) {
  const { dir, manifest } = release;
  await verifyDatabaseAssets(path.join(dir, "backend"), manifest.database);
  const before = await run(config, dir, "status", manifest);
  if (!["empty", "complete"].includes(before.state))
    throw new Error("Dirty or unknown schema; inspect before deployment");
  if (before.version > manifest.database.compatibleMax)
    throw new Error("Newer schema cannot be migrated by this release");
  const backup = await run(config, dir, "backup", manifest);
  if (
    backup?.verified !== true ||
    !/^[a-f0-9]{64}$/.test(backup.sha256 ?? "") ||
    !Number.isSafeInteger(backup.bytes) ||
    backup.bytes < 1
  )
    throw new Error("Verified backup/restore receipt required");
  await run(config, dir, "migrate", manifest);
  await run(config, dir, "seed", manifest);
  const schema = await run(config, dir, "status", manifest);
  checkDatabaseCompatibility(manifest, schema);
  return {
    verified: true,
    sha256: backup.sha256,
    bytes: backup.bytes,
    schemaVersion: schema.version,
  };
}
module.exports = { prepareDatabase, assertRollbackCompatible, runDatabaseTool };
