"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const execute = promisify(execFile);
const policyFile = (config) => path.join(config.root, "private/visitor-history-retention.json");
async function visitorHistoryEnabled(config) {
  try {
    const stat = await fs.lstat(policyFile(config));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Unsafe visitor history policy");
    const data = JSON.parse(await fs.readFile(policyFile(config), "utf8"));
    if (data.version !== 1 || data.realHistoryRetention !== "indefinite")
      throw new Error("Unknown visitor retention policy");
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
/** Stable ops tool, outside current. Caller holds deploy.lock throughout the operation. */
async function retireVisitorCrons(config, { execute: run = execute } = {}) {
  if (!path.isAbsolute(config.root)) throw new Error("Absolute managed root required");
  // CageFS proxies crontab internally. The already-validated receiver command
  // belongs to the receiver, not this fixed child operation.
  const cronEnvironment = { ...process.env };
  delete cronEnvironment.SSH_ORIGINAL_COMMAND;
  const cronOptions = { encoding: "utf8", env: cronEnvironment };
  let original;
  try {
    original = (await run("crontab", ["-l"], cronOptions)).stdout;
  } catch (error) {
    if (error.code !== 1 || !/no crontab/i.test(error.stderr ?? ""))
      throw new Error("Cannot inspect existing crontab");
    original = "";
  }
  const marker =
    "# BIBI_ACCESS_LOG_SYNC_" + createHash("sha256").update(config.root).digest("hex").slice(0, 12);
  const lines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  // No retention cron is guessed from a substring: unrecognized jobs require host inspection.
  if (lines.some((line) => !line.trimStart().startsWith("#") && /analytics:cleanup/.test(line)))
    throw new Error("Unrecognized retention cron; inspect exact host command before activation");
  const next = lines.filter((line) => !line.trimEnd().endsWith(marker)).join("");
  const privateDir = path.join(config.root, "private");
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
  const info = await fs.lstat(privateDir);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("Unsafe visitor private directory");
  const suffix = randomUUID(),
    backup = path.join(privateDir, `crontab-before-visitor-${suffix}.txt`),
    pending = path.join(privateDir, `crontab-next-visitor-${suffix}.txt`);
  await fs.writeFile(backup, original, { flag: "wx", mode: 0o600 });
  if (next !== original) {
    try {
      await fs.writeFile(pending, next, { flag: "wx", mode: 0o600 });
      await run("crontab", [pending], cronOptions);
    } finally {
      await fs.rm(pending, { force: true });
    }
  }
  let actual;
  try {
    actual = (await run("crontab", ["-l"], cronOptions)).stdout;
  } catch (error) {
    if (next || error.code !== 1 || !/no crontab/i.test(error.stderr ?? "")) throw error;
    actual = "";
  }
  if (actual !== next) throw new Error("Crontab verification failed; backup retained");
  const receipt = {
    version: 1,
    realHistoryRetention: "indefinite",
    verified: true,
    backup,
    beforeSha256: createHash("sha256").update(original).digest("hex"),
    afterSha256: createHash("sha256").update(next).digest("hex"),
  };
  const receiptPending = path.join(privateDir, `visitor-history-policy-${suffix}.next`);
  await fs.writeFile(receiptPending, JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 });
  await fs.rename(receiptPending, policyFile(config));
  return receipt;
}
module.exports = { retireVisitorCrons, visitorHistoryEnabled };
