"use strict";
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { verifyDatabaseAssets, checkDatabaseCompatibility } = require("./database-metadata.cjs");
const execute = promisify(execFile);
const { verifyAccessLogAssets, checkAccessLogCompatibility } = require("./access-log-metadata.cjs");

/** Fixed host-only commands. No SQL, password or arbitrary executable from SSH input. */
async function runDatabaseTool(config, dir, command, manifest) {
  if (
    ![
      "backup",
      "migrate",
      "seed",
      "status",
      "probe",
      "access-log-migrate",
      "access-log-status",
      "access-log-sync",
      "access-log-probe",
    ].includes(command)
  )
    throw new Error("Unsupported database operation");
  const logCommand = command.startsWith("access-log-");
  const logAction = logCommand ? command.slice("access-log-".length) : null;
  const privateFile = path.join(
    config.root,
    logAction === "sync" || logAction === "status"
      ? "private/runtime.env"
      : "private/maintenance.env",
  );
  const backup = command === "backup";
  const probe = command === "probe";
  const args = logCommand
    ? logAction === "probe"
      ? [
          path.join(dir, "backend/dist/access-logs/probe-cli.js"),
          manifest.releaseId,
          manifest.sourceSha,
          config.baseUrl,
        ]
      : [path.join(dir, "backend/dist/access-logs/cli.js"), logAction]
    : probe
      ? [
          path.join(dir, "backend/dist/db/probe-cli.js"),
          manifest.releaseId,
          manifest.sourceSha,
          config.baseUrl,
        ]
      : backup
        ? [path.join(dir, "backend/dist/db/backup-cli.js"), manifest.releaseId]
        : [path.join(dir, "backend/dist/db/cli.js"), command];
  try {
    const { stdout } = await execute(path.join(config.runtimeBin, "node"), args, {
      cwd: path.join(dir, "backend"),
      env: {
        PATH: config.runtimeBin + path.delimiter + "/usr/bin:/bin",
        NODE_ENV: "production",
        [backup || probe || logAction === "probe"
          ? "BIBI_MAINTENANCE_ENV_FILE"
          : "BIBI_PRIVATE_ENV_FILE"]: privateFile,
      },
      timeout: backup ? 300000 : 120000,
      maxBuffer: 65536,
      windowsHide: true,
    });
    return JSON.parse(stdout.trim());
  } catch (error) {
    if (logAction === "sync" && error.code === 2) {
      try {
        const receipt = JSON.parse(error.stdout.trim());
        if (receipt.state === "pending") return receipt;
      } catch {
        /* Safe generic failure below. */
      }
    }
    throw new Error(`Private database ${command} failed; activation forbidden`);
  }
}
async function verifyReleaseProbe(config, { dir, manifest }, { run = runDatabaseTool } = {}) {
  await verifyDatabaseAssets(path.join(dir, "backend"), manifest.database);
  const receipt = await run(config, dir, "probe", manifest);
  if (
    receipt?.ok !== true ||
    receipt.releaseId !== manifest.releaseId ||
    receipt.auth !== true ||
    receipt.rbac !== true ||
    receipt.analytics !== true
  )
    throw new Error("Release DB/auth/analytics acceptance failed");
  if (manifest.accessLogs) {
    await verifyAccessLogAssets(path.join(dir, "backend"), manifest.accessLogs);
    const logs = await run(config, dir, "access-log-probe", manifest);
    if (logs?.ok !== true || logs.accessLogs !== true || logs.releaseId !== manifest.releaseId)
      throw new Error("Access log release probe failed");
    return { ...receipt, accessLogs: true };
  }
  return receipt;
}
function assertRollbackCompatible(manifest, schema, options = {}) {
  if (!manifest.database && options.allowPreAuth === true) return { degradedAdmin: true };
  checkDatabaseCompatibility(manifest, schema);
  return { degradedAdmin: false };
}
async function prepareDatabase(config, release, { run = runDatabaseTool } = {}) {
  const { dir, manifest } = release;
  await verifyDatabaseAssets(path.join(dir, "backend"), manifest.database);
  if (manifest.accessLogs)
    await verifyAccessLogAssets(path.join(dir, "backend"), manifest.accessLogs);
  const before = await run(config, dir, "status", manifest);
  if (!["empty", "complete"].includes(before.state))
    throw new Error("Dirty or unknown schema; inspect before deployment");
  if (before.version > manifest.database.compatibleMax)
    throw new Error("Newer schema cannot be migrated by this release");
  if (manifest.accessLogs) {
    const feature = await run(config, dir, "access-log-status", manifest);
    if (!["empty", "complete"].includes(feature?.state) || feature.version > 2)
      throw new Error("Dirty or unknown access log schema");
    if (feature.state === "complete") checkAccessLogCompatibility(manifest.accessLogs, feature);
  }
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
  let accessLogs;
  if (manifest.accessLogs) {
    await run(config, dir, "access-log-migrate", manifest);
    checkAccessLogCompatibility(
      manifest.accessLogs,
      await run(config, dir, "access-log-status", manifest),
    );
    accessLogs = await run(config, dir, "access-log-sync", manifest);
    if (accessLogs?.state !== "complete" || accessLogs.current?.state !== "complete")
      throw new Error("Access log bootstrap must complete before activation");
  }
  return {
    verified: true,
    sha256: backup.sha256,
    bytes: backup.bytes,
    schemaVersion: schema.version,
    ...(accessLogs ? { accessLogs } : {}),
  };
}
module.exports = { prepareDatabase, assertRollbackCompatible, runDatabaseTool, verifyReleaseProbe };
