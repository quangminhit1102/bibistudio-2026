"use strict";
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { verifyDatabaseAssets, checkDatabaseCompatibility } = require("./database-metadata.cjs");
const execute = promisify(execFile);
const { verifyProfileAssets, checkProfileCompatibility } = require("./profile-metadata.cjs");
const { verifyAccessLogAssets, checkAccessLogCompatibility } = require("./access-log-metadata.cjs");
const { verifyVisitorAssets, checkVisitorCompatibility } = require("./visitor-metadata.cjs");

/** Fixed host-only commands. No SQL, password or arbitrary executable from SSH input. */
async function runDatabaseTool(config, dir, command, manifest) {
  if (
    ![
      "backup",
      "profile-backup",
      "profile-status",
      "profile-migrate",
      "profile-cleanup",
      "context-status",
      "context-migrate",
      "controls-status",
      "controls-migrate",
      "content-status",
      "content-migrate",
      "content-seed",
      "visitor-status",
      "visitor-migrate",
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
  const contextAction = command.startsWith("context-") ? command.slice(8) : null;
  const controlsAction = command.startsWith("controls-") ? command.slice(9) : null;
  const contentAction = command.startsWith("content-") ? command.slice(8) : null;
  const profileCommand = command.startsWith("profile-");
  const visitorAction = command.startsWith("visitor-") ? command.slice(8) : null;
  const profileAction = profileCommand ? command.slice(8) : null;
  const logCommand = command.startsWith("access-log-");
  const logAction = logCommand ? command.slice("access-log-".length) : null;
  const privateFile = path.join(
    config.root,
    logAction === "sync" || logAction === "status"
      ? "private/runtime.env"
      : "private/maintenance.env",
  );
  const backup = command === "backup" || profileAction === "backup";
  const probe = command === "probe";
  const args = contentAction
    ? [path.join(dir, "backend/dist/content/cli.js"), contentAction]
    : controlsAction
      ? [path.join(dir, "backend/dist/visitors/controls-cli.js"), controlsAction]
      : contextAction
        ? [path.join(dir, "backend/dist/visitors/context-cli.js"), contextAction]
      : visitorAction
        ? [path.join(dir, "backend/dist/visitors/cli.js"), visitorAction]
        : profileCommand
          ? profileAction === "backup"
            ? [path.join(dir, "backend/dist/profile/backup-cli.js"), manifest.releaseId]
            : [path.join(dir, "backend/dist/profile/cli.js"), profileAction]
          : logCommand
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
  if (manifest.profiles) {
    await verifyProfileAssets(path.join(dir, "backend"), manifest.profiles);
    checkProfileCompatibility(
      manifest.profiles,
      await run(config, dir, "profile-status", manifest),
    );
  }
  if (manifest.visitorAnalytics) {
    await verifyVisitorAssets(path.join(dir, "backend"), manifest.visitorAnalytics);
    checkVisitorCompatibility(
      manifest.visitorAnalytics,
      await run(config, dir, "visitor-status", manifest),
    );
  }
  if (manifest.visitorContext) {
    const context = require("./visitor-context-metadata.cjs");
    await context.verifyVisitorContextAssets(path.join(dir, "backend"), manifest.visitorContext);
    context.checkVisitorContextCompatibility(
      manifest.visitorContext,
      await run(config, dir, "context-status", manifest),
    );
  }
  if (manifest.accessLogs && !manifest.visitorAnalytics) {
    // Historical access-log releases remain supported.
    await verifyAccessLogAssets(path.join(dir, "backend"), manifest.accessLogs);
    const logs = await run(config, dir, "access-log-probe", manifest);
    if (logs?.ok !== true || logs.accessLogs !== true || logs.releaseId !== manifest.releaseId)
      throw new Error("Access log release probe failed");
    return { ...receipt, accessLogs: true };
  }
  if (manifest.visitorControls) {
    const controls = require("./visitor-controls-metadata.cjs");
    await controls.verifyVisitorControlsAssets(path.join(dir, "backend"), manifest.visitorControls);
    controls.checkVisitorControlsCompatibility(
      manifest.visitorControls,
      await run(config, dir, "controls-status", manifest),
    );
  }
  if (manifest.content) {
    const content = require("./content-metadata.cjs");
    await content.verifyContentAssets(path.join(dir, "backend"), manifest.content);
    content.checkContentCompatibility(
      manifest.content,
      await run(config, dir, "content-status", manifest),
    );
  }
  return receipt;
}
function assertRollbackCompatible(manifest, schema, options = {}) {
  if (!manifest.database && options.allowPreAuth === true) return { degradedAdmin: true };
  checkDatabaseCompatibility(manifest, schema);
  return { degradedAdmin: false };
}
async function prepareDatabase(config, release, { run = runDatabaseTool, backupReceipt } = {}) {
  const { dir, manifest } = release;
  await verifyDatabaseAssets(path.join(dir, "backend"), manifest.database);
  if (manifest.accessLogs)
    await verifyAccessLogAssets(path.join(dir, "backend"), manifest.accessLogs);
  const before = await run(config, dir, "status", manifest);
  if (manifest.visitorAnalytics) {
    await verifyVisitorAssets(path.join(dir, "backend"), manifest.visitorAnalytics);
    const history = await run(config, dir, "visitor-status", manifest);
    if (!["empty", "complete"].includes(history?.state))
      throw new Error("Unknown/dirty visitor history schema");
    if (history.state === "complete") checkVisitorCompatibility(manifest.visitorAnalytics, history);
  }
  if (!["empty", "complete"].includes(before.state))
    throw new Error("Dirty or unknown schema; inspect before deployment");
  if (before.version > manifest.database.compatibleMax)
    throw new Error("Newer schema cannot be migrated by this release");
  if (manifest.accessLogs && !manifest.visitorAnalytics) {
    const feature = await run(config, dir, "access-log-status", manifest);
    if (!["empty", "complete"].includes(feature?.state) || feature.version > 2)
      throw new Error("Dirty or unknown access log schema");
    if (feature.state === "complete") checkAccessLogCompatibility(manifest.accessLogs, feature);
  }
  if (manifest.profiles && !backupReceipt)
    throw new Error("Paired profile backup is required before migration");
  const backup = backupReceipt ?? (await run(config, dir, "backup", manifest));
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
  if (manifest.accessLogs && !manifest.visitorAnalytics) {
    await run(config, dir, "access-log-migrate", manifest);
    checkAccessLogCompatibility(
      manifest.accessLogs,
      await run(config, dir, "access-log-status", manifest),
    );
    accessLogs = await run(config, dir, "access-log-sync", manifest);
    if (accessLogs?.state !== "complete" || accessLogs.current?.state !== "complete")
      throw new Error("Access log bootstrap must complete before activation");
  }
  if (manifest.profiles) {
    await verifyProfileAssets(path.join(dir, "backend"), manifest.profiles);
    await run(config, dir, "profile-migrate", manifest);
    checkProfileCompatibility(
      manifest.profiles,
      await run(config, dir, "profile-status", manifest),
    );
  }
  if (manifest.visitorAnalytics) {
    await run(config, dir, "visitor-migrate", manifest);
    checkVisitorCompatibility(
      manifest.visitorAnalytics,
      await run(config, dir, "visitor-status", manifest),
    );
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
