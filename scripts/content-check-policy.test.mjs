import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
test("project check executes CMS source browser gate and lints public content while preserving existing gates", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bibi-check-policy-")),
    record = join(dir, "commands.jsonl");
  t.after(() => rm(dir, { recursive: true, force: true }));
  await promisify(execFile)(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve("tests/helpers/check-recorder.mjs")).href,
      "scripts/check.mjs",
    ],
    { env: { ...process.env, BIBI_CHECK_RECORD_FILE: record }, windowsHide: true },
  );
  const commands = (await readFile(record, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line).args);
  for (const file of [
    "scripts/auth-ui-check.mjs",
    "scripts/visitor-relay-ui-check.mjs",
    "scripts/content-ui-check.mjs",
  ])
    assert.ok(
      commands.some((args) => args[0] === file),
      "Missing browser gate: " + file,
    );
  const lint = commands.find((args) => args[0] === "node_modules/eslint/bin/eslint.js");
  for (const scope of [
    "src/features/admin",
    "backend/src",
    "ops",
    "scripts",
    "src/blog-client.ts",
    "src/lib/public-content.ts",
    "src/lib/blog-navigation.ts",
    "src/components/blog-document-adapter.tsx",
  ])
    assert.ok(lint.includes(scope), "Missing lint scope: " + scope);
  assert.ok(
    commands.some(
      (args) =>
        args[0] === "--test" &&
        args.includes("backend/test/content-backup.test.mjs") &&
        args.includes("scripts/content-release.test.mjs"),
    ),
  );
});
