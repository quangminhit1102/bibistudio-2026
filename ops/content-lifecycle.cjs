"use strict";
const { verifyContentAssets, checkContentCompatibility } = require("./content-metadata.cjs");
const { assertContentCompatible } = require("./content-compatibility.cjs");
async function prepareContent(config, current, candidate, { backupReceipt, run } = {}) {
  await assertContentCompatible(config, candidate);
  if (candidate?.manifest?.contentPublic)
    await verifyContentAssets(candidate.dir, candidate.manifest);
  const capable = [candidate, current].find((r) => r?.manifest?.content);
  if (!capable) return;
  if (
    backupReceipt?.verified !== true ||
    backupReceipt.profiles !== true ||
    backupReceipt.content !== true ||
    !/^[a-f0-9]{64}$/.test(backupReceipt.sha256 ?? "") ||
    !Number.isSafeInteger(backupReceipt.bytes) ||
    backupReceipt.bytes < 1
  )
    throw Error("Verified paired content backup required before migration");
  await verifyContentAssets(capable.dir, capable.manifest);
  const execute = run ?? require("./database-lifecycle.cjs").runDatabaseTool;
  let status = await execute(config, capable.dir, "content-status", capable.manifest);
  if (!["empty", "complete"].includes(status?.state)) throw Error("Unknown/dirty content schema");
  if (status.state === "complete") checkContentCompatibility(capable.manifest.content, status);
  if (candidate?.manifest?.content) {
    if (status.state === "empty")
      await execute(config, capable.dir, "content-migrate", capable.manifest);
    status = await execute(config, capable.dir, "content-status", capable.manifest);
    checkContentCompatibility(capable.manifest.content, status);
    await execute(config, capable.dir, "content-seed", capable.manifest);
    if (config.root)
      await require("./content-initial.cjs").initializeContent(config, current, candidate, {
        run: execute,
      });
  } else if (status.state !== "complete") throw Error("Content rollback requires complete schema");
  return status;
}
module.exports = { prepareContent };
