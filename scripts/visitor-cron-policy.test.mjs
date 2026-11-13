import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { retireVisitorCrons } = require("../ops/visitor-cron-policy.cjs");
test("durable cron retirement preserves unrelated bytes/auth jobs, backs up and is idempotent", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bibi-visitor-cron-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = { root, runtimeBin: join(root, "nodebin") };
  const marker =
    "# BIBI_ACCESS_LOG_SYNC_" + createHash("sha256").update(root).digest("hex").slice(0, 12);
  const preserved =
    "MAILTO=owner@example.test\r\n0 * * * * /safe/auth-cleanup\n# unchanged comment\n";
  const original = preserved + `*/15 * * * * /safe/access-log-cron.cjs ${marker}\n`;
  let crontab = original;
  const execute = async (command, args) => {
    assert.equal(command, "crontab");
    if (args[0] === "-l") return { stdout: crontab };
    crontab = await readFile(args[0], "utf8");
    return { stdout: "" };
  };
  const receipt = await retireVisitorCrons(config, { execute });
  assert.equal(crontab, preserved);
  assert.equal(await readFile(receipt.backup, "utf8"), original);
  assert.equal(
    JSON.parse(await readFile(join(root, "private/visitor-history-retention.json"), "utf8"))
      .realHistoryRetention,
    "indefinite",
  );
  await retireVisitorCrons(config, { execute });
  assert.equal(crontab, preserved);
  const { installAccessLogCron, runCurrentSync } = require("../ops/access-log-cron.cjs");
  await assert.rejects(
    installAccessLogCron(config, join(root, "config.json"), { execute }),
    /retired/i,
  );
  assert.equal(
    (
      await runCurrentSync(config, {
        run: async () => {
          throw new Error("Old sync must not run");
        },
      })
    ).state,
    "skipped",
  );
});
test("unrecognized history-deleting cron fails closed instead of removing unrelated jobs", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bibi-visitor-cron-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    retireVisitorCrons(
      { root, runtimeBin: join(root, "nodebin") },
      { execute: async () => ({ stdout: "0 0 * * * custom-wrapper analytics:cleanup\n" }) },
    ),
    /inspect|unrecognized/i,
  );
});
