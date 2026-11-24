import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STAGES, E2E_SUITES, assertSiteBuild, selectStages } from "./check.mjs";

test("no arguments selects every stage and every browser suite in order", () => {
  assert.deepEqual(STAGES, ["static", "admin", "blank-site", "backend", "e2e"]);
  assert.deepEqual(selectStages([]), { stages: STAGES, suites: E2E_SUITES });
});
test("a stage argument selects only that stage", () => {
  assert.deepEqual(selectStages(["admin"]), { stages: ["admin"], suites: E2E_SUITES });
  assert.deepEqual(selectStages(["e2e", "profile"]), { stages: ["e2e"], suites: ["profile"] });
});
test("unknown or misplaced arguments are rejected instead of running nothing", () => {
  for (const args of [["nope"], ["e2e", "nope"], ["admin", "auth"], ["e2e", "auth", "x"]])
    assert.throws(() => selectStages(args), /Usage/);
});
test("every browser spec belongs to a suite or to the bundle check", async () => {
  const specs = (await readdir(new URL("../tests/e2e/", import.meta.url)))
    .filter((name) => name.endsWith(".spec.mjs"))
    .map((name) => name.replace(".spec.mjs", ""))
    .filter((name) => name !== "visitor-context-bundle");
  assert.deepEqual([...E2E_SUITES].sort(), specs.sort());
});
test("a build is accepted only when it carries the values of its own site", async () => {
  const dir = await mkdtemp(join(tmpdir(), "site-build-"));
  try {
    await mkdir(join(dir, "assets"));
    await writeFile(join(dir, "index.html"), "<title>One</title>");
    await writeFile(join(dir, "assets/a.js"), 'const title = "One Admin";');
    const site = (name, title) => ({ name, admin: { title } });
    await assertSiteBuild(dir, site("One", "One Admin"));
    await assert.rejects(assertSiteBuild(dir, site("Two", "One Admin")), /site name "Two"/);
    await assert.rejects(assertSiteBuild(dir, site("One", "Two Admin")), /admin title "Two Admin"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
