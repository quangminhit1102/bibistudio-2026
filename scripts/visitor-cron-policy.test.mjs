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

test("fixed crontab child excludes the SSH receiver command without changing the receiver environment", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bibi-visitor-cron-env-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const previous = process.env.SSH_ORIGINAL_COMMAND;
  const command = "deploy " + "a".repeat(40) + "-123";
  process.env.SSH_ORIGINAL_COMMAND = command;
  t.after(() => {
    if (previous === undefined) delete process.env.SSH_ORIGINAL_COMMAND;
    else process.env.SSH_ORIGINAL_COMMAND = previous;
  });
  let calls = 0;
  const receipt = await retireVisitorCrons(
    { root },
    {
      execute: async (_command, args, options) => {
        const environment = options.env ?? process.env;
        // CageFS rejects its crontab proxy call when the receiver's command leaks into it.
        if (environment.SSH_ORIGINAL_COMMAND) {
          throw Object.assign(new Error("Invalid argument"), {
            code: 1,
            stderr: "Invalid argument\n",
          });
        }
        assert.deepEqual(
          environment,
          Object.fromEntries(
            Object.entries(process.env).filter(([key]) => key !== "SSH_ORIGINAL_COMMAND"),
          ),
        );
        assert.equal(process.env.SSH_ORIGINAL_COMMAND, command);
        calls += 1;
        assert.equal(args[0], "-l");
        return { stdout: "0 * * * * /safe/auth-cleanup\n" };
      },
    },
  );
  assert.equal(receipt.verified, true);
  assert.equal(calls, 2);
});
