import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
const require = createRequire(import.meta.url);
test(
  "actual flock holds deployment lock throughout child sync and releases it afterwards",
  { skip: process.platform === "win32" ? "Native flock exercised on Linux CI" : false },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), "bibi-log-flock-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const { makeManifest } = require("../ops/release.cjs"),
      { createDatabaseMetadata } = require("../ops/database-metadata.cjs"),
      { createAccessLogMetadata } = require("../ops/access-log-metadata.cjs");
    const m = makeManifest(
      "a".repeat(40),
      "123",
      await createDatabaseMetadata("backend"),
      await createAccessLogMetadata("backend"),
    );
    const dir = join(root, "releases", m.releaseId);
    await mkdir(join(dir, "backend/dist/access-logs"), { recursive: true });
    await writeFile(join(dir, "manifest.json"), JSON.stringify(m));
    const entered = join(root, "sync-entered");
    await writeFile(
      join(dir, "backend/dist/access-logs/cli.js"),
      `require('node:fs').writeFileSync(${JSON.stringify(entered)},'held');setTimeout(()=>console.log(JSON.stringify({state:'complete'})),1500);`,
    );
    await symlink(dir, join(root, "current"), "dir");
    const configFile = join(root, "production.json");
    await writeFile(
      configFile,
      JSON.stringify({
        root,
        environment: "production",
        runtimeBin: process.execPath.slice(0, process.execPath.lastIndexOf("/")),
      }),
    );
    const child = spawn(
      process.execPath,
      [new URL("../ops/access-log-cron.cjs", import.meta.url).pathname, configFile],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    t.after(() => {
      if (child.exitCode === null) child.kill();
    });
    const finished = once(child, "exit");
    let ready = false;
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      try {
        await readFile(entered);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    assert.equal(ready, true);
    await assert.rejects(
      promisify(execFile)("flock", ["-n", join(root, "deploy.lock"), "true"]),
      (error) => error.code === 1,
    );
    assert.deepEqual(await finished, [0, null]);
    await promisify(execFile)("flock", ["-n", join(root, "deploy.lock"), "true"]);
  },
);
test("cron preserves unrelated jobs byte-for-byte, backs up and replaces only one own15minute entry", async (t) => {
  const { installAccessLogCron, intervalSchedule } = require("../ops/access-log-cron.cjs");
  const root = await mkdtemp(join(tmpdir(), "bibi-cron-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = { root, runtimeBin: "/opt/node24/bin" },
    configFile = "/home/site/tools/production.json";
  let text = 'MAILTO="owner@example.test"\n0 3 * * * /usr/bin/true\n',
    original = text;
  const execute = async (cmd, args) => {
    assert.equal(cmd, "crontab");
    if (args[0] === "-l") return { stdout: text };
    text = await readFile(args[0], "utf8");
    return { stdout: "" };
  };
  const first = await installAccessLogCron(config, configFile, { execute });
  await installAccessLogCron(config, configFile, { execute });
  assert.ok(text.startsWith(original));
  assert.equal(text.match(/BIBI_ACCESS_LOG_SYNC/g).length, 1);
  assert.ok(text.includes("*/15 * * * *"));
  assert.equal(await readFile(first.backup, "utf8"), original);
  assert.equal(intervalSchedule(), "*/15 * * * *");
  assert.ok(!text.includes("PASSWORD"));
  assert.ok(text.includes("access-log-cron.cjs"));
});
test("daily job selects immutable current under deploy lock and safely skips old release", async (t) => {
  const { runCurrentSync, lockArguments } = require("../ops/access-log-cron.cjs");
  const root = await mkdtemp(join(tmpdir(), "bibi-job-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, "releases", "a".repeat(40) + "-123");
  await mkdir(join(dir, "backend/dist/access-logs"), { recursive: true });
  await symlink(dir, join(root, "current"), process.platform === "win32" ? "junction" : "dir");
  const { createDatabaseMetadata } = require("../ops/database-metadata.cjs"),
    { createAccessLogMetadata } = require("../ops/access-log-metadata.cjs"),
    { makeManifest } = require("../ops/release.cjs");
  const database = await createDatabaseMetadata("backend"),
    metadata = await createAccessLogMetadata("backend");
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify(makeManifest("a".repeat(40), "123", database)),
  );
  let called = false;
  const run = async (_c, actual, command) => {
    called = true;
    assert.equal(actual, dir);
    assert.equal(command, "access-log-sync");
    return { state: "complete" };
  };
  assert.equal((await runCurrentSync({ root }, { run })).state, "skipped");
  assert.equal(called, false);
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify(makeManifest("a".repeat(40), "123", database, metadata)),
  );
  await writeFile(join(dir, "backend/dist/access-logs/cli.js"), "");
  assert.equal((await runCurrentSync({ root }, { run })).state, "complete");
  const args = lockArguments({ root }, "/home/site/tools/production.json");
  assert.equal(args[3], join(root, "deploy.lock"));
  assert.ok(args.includes("--locked"));
});
