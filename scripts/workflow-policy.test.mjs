import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { assertTrustedRun, assertStagingEvidence } from "./github-release.mjs";
const sha = "a".repeat(40);
test("only successful same-repository main push CI can supply a release", () => {
  const run = {
    id: 123,
    head_sha: sha,
    head_branch: "main",
    event: "push",
    conclusion: "success",
    path: ".github/workflows/ci.yml",
    head_repository: { full_name: "owner/repo" },
  };
  assertTrustedRun(run, `${sha}-123`, "owner/repo");
  for (const override of [
    { event: "pull_request" },
    { head_branch: "feature" },
    { conclusion: "failure" },
    { head_sha: "b".repeat(40) },
    { path: ".github/workflows/fake.yml" },
    { head_repository: { full_name: "fork/repo" } },
  ])
    assert.throws(() => assertTrustedRun({ ...run, ...override }, `${sha}-123`, "owner/repo"));
});
test("promotion requires matching successful staging artifact evidence", () => {
  const expected = { releaseId: `${sha}-123`, checksum: "c".repeat(64), ciRunId: "123" };
  assertStagingEvidence(
    { environment: "staging", payload: expected },
    [{ state: "success" }],
    expected,
  );
  for (const payload of [
    { ...expected, checksum: "d".repeat(64) },
    { ...expected, releaseId: "other" },
  ])
    assert.throws(() =>
      assertStagingEvidence({ environment: "staging", payload }, [{ state: "success" }], expected),
    );
  assert.throws(() =>
    assertStagingEvidence(
      { environment: "staging", payload: expected },
      [{ state: "failure" }],
      expected,
    ),
  );
});
test("workflows pin actions and isolate deployment credentials from CI", async () => {
  const workflows = {};
  for (const name of ["ci", "staging", "production", "rollback"]) {
    const source = await readFile(
      new URL(`../.github/workflows/${name}.yml`, import.meta.url),
      "utf8",
    );
    workflows[name] = parse(source);
    assert.ok(!source.includes("pull_request_target"));
    for (const job of Object.values(workflows[name].jobs))
      for (const step of job.steps ?? []) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
    assert.equal(workflows[name].permissions.contents, "read");
    if (name !== "ci") {
      assert.equal(workflows[name].concurrency["cancel-in-progress"], false);
      assert.ok(source.includes("github.ref == 'refs/heads/main'"));
    } else assert.ok(!source.includes("secrets."));
  }
  assert.ok(Object.hasOwn(workflows.ci.on, "pull_request"));
  assert.ok(workflows.staging.on.workflow_run);
  assert.ok(workflows.production.on.workflow_dispatch);
  assert.ok(!JSON.stringify(workflows.production).includes("npm run build"));
});
