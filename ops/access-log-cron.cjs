"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { execFile, spawnSync } = require("node:child_process");
const { promisify } = require("node:util");
const { inspectRelease } = require("./deploy.cjs");
const { runDatabaseTool } = require("./database-lifecycle.cjs");
const execute = promisify(execFile);
const shellQuote = (value) => "'" + String(value).replace(/'/g, "'\\''") + "'";
function lockArguments(config, configFile, install = false) {
  return [
    "-x",
    "-w",
    "5",
    path.join(config.root, "deploy.lock"),
    process.execPath,
    __filename,
    configFile,
    "--locked",
    ...(install ? ["--install"] : []),
  ];
}
function intervalSchedule() {
  return "*/15 * * * *";
}
async function installAccessLogCron(config, configFile, { execute: run = execute } = {}) {
  if (
    !path.isAbsolute(config.root) ||
    !path.isAbsolute(config.runtimeBin) ||
    !path.isAbsolute(configFile)
  )
    throw new Error("Absolute host paths required");
  if (
    [config.root, config.runtimeBin, configFile, __filename].some((value) =>
      /[\r\n%\0]/.test(value),
    )
  )
    throw new Error("Unsafe cron path");
  let original;
  try {
    original = (await run("crontab", ["-l"], { encoding: "utf8" })).stdout;
  } catch (error) {
    if (error.code !== 1) throw new Error("Cannot read existing crontab");
    original = "";
  }
  const marker =
    "# BIBI_ACCESS_LOG_SYNC_" + createHash("sha256").update(config.root).digest("hex").slice(0, 12);
  // Split preserving terminators so unrelated lines retain their exact bytes.
  const lines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const kept = lines.filter((line) => !line.trimEnd().endsWith(marker)).join("");
  const entry =
    intervalSchedule() +
    " umask 077; " +
    [path.join(config.runtimeBin, "node"), __filename, configFile].map(shellQuote).join(" ") +
    " > " +
    shellQuote(path.join(config.root, "private/access-log-last-job.json")) +
    " 2>&1 " +
    marker +
    "\n";
  const next = kept + (kept && !kept.endsWith("\n") ? "\n" : "") + entry;
  const privateDir = path.join(config.root, "private");
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
  const suffix = Date.now() + "-" + randomUUID(),
    backup = path.join(privateDir, "crontab-before-" + suffix + ".txt"),
    pending = path.join(privateDir, "crontab-next-" + suffix + ".txt");
  await fs.writeFile(backup, original, { flag: "wx", mode: 0o600 });
  try {
    await fs.writeFile(pending, next, { flag: "wx", mode: 0o600 });
    await run("crontab", [pending]);
  } finally {
    await fs.rm(pending, { force: true });
  }
  const actual = (await run("crontab", ["-l"], { encoding: "utf8" })).stdout;
  if (actual !== next) throw new Error("Crontab verification failed; original backup retained");
  return { ok: true, intervalMinutes: 15, backup };
}
/** Caller holds deploy.lock until this promise settles, including all source reads. */
async function runCurrentSync(config, { run = runDatabaseTool } = {}) {
  const current = await fs.realpath(path.join(config.root, "current"));
  const release = await inspectRelease(config, path.basename(current));
  if (release.dir !== current) throw new Error("Current release outside managed releases");
  if (!release.manifest.accessLogs)
    return { state: "skipped", reason: "Release has no access log capability" };
  await fs.access(path.join(current, "backend/dist/access-logs/cli.js"));
  return run(config, current, "access-log-sync", release.manifest);
}
async function main() {
  const args = process.argv.slice(2),
    configFile = args[0],
    locked = args.includes("--locked"),
    install = args.includes("--install");
  if (
    !configFile ||
    !path.isAbsolute(configFile) ||
    args.slice(1).some((value) => !["--locked", "--install"].includes(value)) ||
    new Set(args).size !== args.length
  )
    throw new Error("Invalid job arguments");
  const config = JSON.parse(await fs.readFile(configFile, "utf8"));
  if (
    config.environment !== "production" ||
    !path.isAbsolute(config.root) ||
    !path.isAbsolute(config.runtimeBin)
  )
    throw new Error("Invalid production job configuration");
  if (!locked) {
    const child = spawnSync("flock", lockArguments(config, configFile, install), {
      stdio: "inherit",
      timeout: 150000,
      windowsHide: true,
    });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
    return;
  }
  const receipt = install
    ? await installAccessLogCron(config, configFile)
    : await runCurrentSync(config);
  console.log(JSON.stringify(receipt));
  process.exitCode = receipt.state === "pending" ? 2 : receipt.state === "error" ? 1 : 0;
}
module.exports = { installAccessLogCron, intervalSchedule, runCurrentSync, lockArguments };
if (require.main === module)
  void main().catch(() => {
    console.error(
      JSON.stringify({
        state: "error",
        error: "Access log scheduled operation failed; inspect private job state",
      }),
    );
    process.exitCode = 1;
  });
