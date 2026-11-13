"use strict";
const { join } = require("node:path");
const {
  verifyVisitorContextAssets,
  checkVisitorContextCompatibility,
} = require("./visitor-context-metadata.cjs");
async function prepareVisitorContext(config, current, candidate, { backupReceipt, run } = {}) {
  const capable = [candidate, current].find((r) => r?.manifest?.visitorContext);
  if (!capable) {
    if (config.root) {
      try {
        await require("node:fs/promises").access(
          join(config.root, "private/analytics-relay-routing.json"),
        );
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
      throw new Error("No compatible visitor context tool in current/candidate release");
    }
    return;
  }
  if (
    backupReceipt?.verified !== true ||
    backupReceipt.profiles !== true ||
    !/^[a-f0-9]{64}$/.test(backupReceipt.sha256 ?? "") ||
    !Number.isSafeInteger(backupReceipt.bytes) ||
    backupReceipt.bytes < 1
  )
    throw new Error("Verified paired backup required before context migration");
  await verifyVisitorContextAssets(join(capable.dir, "backend"), capable.manifest.visitorContext);
  const execute = run ?? require("./database-lifecycle.cjs").runDatabaseTool;
  let status = await execute(config, capable.dir, "context-status", capable.manifest);
  if (!["empty", "complete"].includes(status?.state))
    throw new Error("Unknown/dirty visitor context schema");
  if (status.state === "complete")
    checkVisitorContextCompatibility(capable.manifest.visitorContext, status);
  if (candidate?.manifest?.visitorContext) {
    if (status.state === "empty")
      await execute(config, capable.dir, "context-migrate", capable.manifest);
    status = await execute(config, capable.dir, "context-status", capable.manifest);
    checkVisitorContextCompatibility(capable.manifest.visitorContext, status);
  } else if (status.state !== "complete")
    throw new Error("Context rollback requires complete schema");
  return status;
}
module.exports = { prepareVisitorContext };
