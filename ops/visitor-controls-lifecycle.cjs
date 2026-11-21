"use strict";
const { join } = require("node:path");
const {
  verifyVisitorControlsAssets,
  checkVisitorControlsCompatibility,
} = require("./visitor-controls-metadata.cjs");
async function prepareVisitorControls(config, current, candidate, { backupReceipt, run } = {}) {
  const capable = [candidate, current].find((r) => r?.manifest?.visitorControls);
  if (!capable) return;
  if (
    backupReceipt?.verified !== true ||
    backupReceipt.profiles !== true ||
    !/^[a-f0-9]{64}$/.test(backupReceipt.sha256 ?? "") ||
    !Number.isSafeInteger(backupReceipt.bytes) ||
    backupReceipt.bytes < 1
  )
    throw new Error("Verified paired backup required before controls migration");
  await verifyVisitorControlsAssets(join(capable.dir, "backend"), capable.manifest.visitorControls);
  const execute = run ?? require("./database-lifecycle.cjs").runDatabaseTool;
  let status = await execute(config, capable.dir, "controls-status", capable.manifest);
  if (!["empty", "complete"].includes(status?.state))
    throw new Error("Unknown/dirty visitor controls schema");
  if (status.state === "complete")
    checkVisitorControlsCompatibility(capable.manifest.visitorControls, status);
  if (candidate?.manifest?.visitorControls) {
    if (status.state === "empty")
      await execute(config, capable.dir, "controls-migrate", capable.manifest);
    status = await execute(config, capable.dir, "controls-status", capable.manifest);
    checkVisitorControlsCompatibility(capable.manifest.visitorControls, status);
  } else if (status.state !== "complete")
    throw new Error("Controls rollback requires complete schema");
  return status;
}
module.exports = { prepareVisitorControls };
