"use strict";
const { join } = require("node:path");
const { verifyContentAssets, checkContentCompatibility } = require("./content-metadata.cjs");
async function prepareContent(config, current, candidate, { backupReceipt, run } = {}) {
  const capable = [candidate, current].find((r) => r?.manifest?.content);
  if (!capable) return;
  if (
    backupReceipt?.verified !== true ||
    backupReceipt.profiles !== true ||
    !/^[a-f0-9]{64}$/.test(backupReceipt.sha256 ?? "") ||
    !Number.isSafeInteger(backupReceipt.bytes) ||
    backupReceipt.bytes < 1
  )
    throw new Error("Verified paired backup required before content migration");
  await verifyContentAssets(join(capable.dir, "backend"), capable.manifest.content);
  const execute = run ?? require("./database-lifecycle.cjs").runDatabaseTool;
  let status = await execute(config, capable.dir, "content-status", capable.manifest);
  if (!["empty", "dirty", "complete"].includes(status?.state))
    throw new Error("Unknown content schema");
  if (status.state === "complete") checkContentCompatibility(capable.manifest.content, status);
  if (candidate?.manifest?.content) {
    if (status.state !== "complete")
      await execute(config, capable.dir, "content-migrate", capable.manifest);
    status = await execute(config, capable.dir, "content-status", capable.manifest);
    checkContentCompatibility(capable.manifest.content, status);
    await execute(config, capable.dir, "content-seed", capable.manifest);
  } else if (status.state !== "complete")
    throw new Error("Content rollback requires complete schema");
  return status;
}
module.exports = { prepareContent };
