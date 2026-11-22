import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir } from "node:fs/promises";
import { STAGES, E2E_SUITES, selectStages } from "./check.mjs";

test("no arguments selects every stage and every browser suite in order", () => {
  assert.deepEqual(STAGES, ["static", "admin", "backend", "e2e"]);
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
