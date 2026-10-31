import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { parse } from "yaml";
import { assertTrustedRun, assertStagingEvidence, validateRelease } from "./github-release.mjs";
const sha = "a".repeat(40);
test("production accepts a trusted CI artifact without querying staging", async () => {
  const id = `${sha}-123`;
  const calls = [];
  const request = async (route) => {
    calls.push(route);
    if (route === "actions/runs/123")
      return {
        id: 123,
        head_sha: sha,
        head_branch: "main",
        event: "push",
        conclusion: "success",
        path: ".github/workflows/ci.yml",
        head_repository: { full_name: "owner/repo" },
      };
    if (route === "actions/runs/123/artifacts?per_page=100")
      return {
        artifacts: [{ id: 456, name: `release-${id}`, expired: false }],
      };
    throw new Error(`Unexpected dependency: ${route}`);
  };
  const result = await validateRelease(id, { production: true, request, repository: "owner/repo" });
  assert.equal(result.artifactId, 456);
  assert.equal(result.ciRunId, "123");
  assert.equal(result.checksum, "");
  assert.equal(calls.length, 2);
});
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
test("production rejects expired or missing named CI artifact without staging fallback", async () => {
  const id = `${sha}-123`;
  for (const artifacts of [
    [],
    [{ id: 456, name: `release-${id}`, expired: true }],
    [{ id: 456, name: "other", expired: false }],
  ]) {
    await assert.rejects(
      validateRelease(id, {
        production: true,
        repository: "owner/repo",
        request: async (route) =>
          route === "actions/runs/123"
            ? {
                id: 123,
                head_sha: sha,
                head_branch: "main",
                event: "push",
                conclusion: "success",
                path: ".github/workflows/ci.yml",
                head_repository: { full_name: "owner/repo" },
              }
            : { artifacts },
      }),
      /missing or expired/i,
    );
  }
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
  for (const name of ["ci", "production", "rollback"]) {
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
  const upload = workflows.ci.jobs.verify.steps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  assert.equal(
    upload.with["include-hidden-files"],
    true,
    "hidden .releases directory must be included in artifact upload",
  );
  assert.deepEqual((await readdir(new URL("../.github/workflows/", import.meta.url))).sort(), [
    "ci.yml",
    "production.yml",
    "rollback.yml",
  ]);
  const archived = parse(
    await readFile(new URL("../.github/workflows-disabled/staging.yml", import.meta.url), "utf8"),
  );
  assert.ok(archived.on.workflow_run);
  assert.ok(workflows.production.on.workflow_dispatch);
  assert.deepEqual(Object.keys(workflows.production.on), ["workflow_dispatch"]);
  assert.equal(workflows.production.jobs.promote.environment, "production");
  assert.equal(workflows.rollback.jobs.rollback.environment, "production");
  assert.equal(workflows.rollback.concurrency.group, "deploy-production");
  assert.equal(workflows.rollback.on.workflow_dispatch.inputs.environment, undefined);
  assert.equal(workflows.rollback.jobs.rollback.steps.at(-1).env.DEPLOY_ENV, "production");
  assert.ok(!JSON.stringify(workflows.production).includes("npm run build"));
});
