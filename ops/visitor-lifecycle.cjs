"use strict";
const path = require("node:path");
const { verifyVisitorAssets, checkVisitorCompatibility } = require("./visitor-metadata.cjs");
const { retireVisitorCrons, visitorHistoryEnabled } = require("./visitor-cron-policy.cjs");
async function prepareVisitorLifecycle(
  config,
  current,
  candidate,
  { run, retire = retireVisitorCrons, backupReceipt } = {},
) {
  const capable = [candidate, current].find((release) => release?.manifest?.visitorAnalytics);
  if (!capable) {
    if (await visitorHistoryEnabled(config))
      throw new Error("Visitor history exists but no compatible tool; activation forbidden");
    return undefined;
  }
  if (backupReceipt?.verified !== true || backupReceipt.profiles !== true)
    throw new Error("Verified paired backup required before visitor history activation");
  await verifyVisitorAssets(path.join(capable.dir, "backend"), capable.manifest.visitorAnalytics);
  const execute = run ?? require("./database-lifecycle.cjs").runDatabaseTool;
  const status = await execute(config, capable.dir, "visitor-status", capable.manifest);
  if (!["empty", "complete"].includes(status?.state))
    throw new Error("Unknown/dirty visitor history schema");
  if (status.state === "complete")
    checkVisitorCompatibility(capable.manifest.visitorAnalytics, status);
  return retire(config);
}
module.exports = { prepareVisitorLifecycle };
