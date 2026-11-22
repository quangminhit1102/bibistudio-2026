import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { parse } from "yaml";
import {
  assertTrustedRun,
  assertStagingEvidence,
  validateRelease,
  latestReleaseId,
  isMainHead,
} from "./github-release.mjs";
import { STAGES, E2E_SUITES } from "./check.mjs";
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
      const concurrency =
        workflows[name].concurrency ?? Object.values(workflows[name].jobs)[0].concurrency;
      assert.deepEqual(concurrency, { group: "deploy-production", "cancel-in-progress": false });
      assert.ok(source.includes("github.ref == 'refs/heads/main'"));
    } else assert.ok(!source.includes("secrets."));
  }
  assert.ok(Object.hasOwn(workflows.ci.on, "pull_request"));
  assert.equal(workflows.ci.jobs.verify, undefined);
  const upload = workflows.ci.jobs.build.steps.find(
    (step) =>
      step.uses?.startsWith("actions/upload-artifact@") && step.with.name.startsWith("release-"),
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
  assert.deepEqual(Object.keys(workflows.production.on).sort(), [
    "workflow_dispatch",
    "workflow_run",
  ]);
  assert.equal(workflows.production.jobs.promote.environment, "production");
  assert.equal(workflows.rollback.jobs.rollback.environment, "production");
  assert.equal(workflows.rollback.concurrency.group, "deploy-production");
  assert.equal(workflows.rollback.on.workflow_dispatch.inputs.environment, undefined);
  assert.equal(workflows.rollback.jobs.rollback.steps.at(-1).env.DEPLOY_ENV, "production");
  assert.ok(!JSON.stringify(workflows.production).includes("npm run build"));
});
test("CI runs every check stage and every browser suite as its own job", async () => {
  const ci = parse(await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"));
  const commands = Object.values(ci.jobs).flatMap((job) => job.steps.map((step) => step.run ?? ""));
  for (const stage of STAGES)
    assert.ok(
      commands.some((command) => command.startsWith(`node scripts/check.mjs ${stage}`)),
      `no CI job runs the ${stage} stage`,
    );
  assert.deepEqual(ci.jobs.e2e.strategy.matrix.suite, E2E_SUITES);
  assert.equal(ci.jobs.e2e.strategy["fail-fast"], false);
  assert.ok(commands.includes("node scripts/check.mjs e2e ${{ matrix.suite }}"));
  const backend = ci.jobs.backend.steps.find(
    (step) => step.run === "node scripts/check.mjs backend",
  );
  assert.equal(backend.env.BIBI_TEST_DB_CONTAINER, "${{ job.services.mysql.id }}");
});
test("a manual deploy without a release ID takes the latest successful main CI run", async () => {
  const routes = [];
  const request = async (route) => {
    routes.push(route);
    return { workflow_runs: [{ id: 123, head_sha: sha }] };
  };
  assert.equal(await latestReleaseId({ request }), `${sha}-123`);
  assert.deepEqual(routes, [
    "actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=1",
  ]);
  await assert.rejects(
    latestReleaseId({ request: async () => ({ workflow_runs: [] }) }),
    /No successful main CI run/,
  );
});
test("production deploys automatically only after successful main push CI of this repository", async () => {
  const production = parse(
    await readFile(new URL("../.github/workflows/production.yml", import.meta.url), "utf8"),
  );
  assert.deepEqual(production.on.workflow_run, {
    workflows: ["CI"],
    types: ["completed"],
    branches: ["main"],
  });
  assert.equal(production.on.workflow_dispatch.inputs.release_id.required, false);
  const condition = production.jobs.promote.if.replace(/\s+/g, " ");
  for (const required of [
    "github.ref == 'refs/heads/main' && (",
    "github.event_name == 'workflow_dispatch' ||",
    "github.event.workflow_run.conclusion == 'success' &&",
    "github.event.workflow_run.event == 'push' &&",
    "github.event.workflow_run.head_branch == 'main' &&",
    "github.event.workflow_run.head_repository.full_name == github.repository &&",
    "vars.AUTO_DEPLOY != 'false' &&",
    "!contains(github.event.workflow_run.head_commit.message, '[skip deploy]')",
  ])
    assert.ok(condition.includes(required), `deploy condition lacks: ${required}`);
  assert.ok(!condition.includes("always()"));
  // Workflow-level concurrency would let a skipped run (failed CI) evict a queued rollback.
  assert.equal(production.concurrency, undefined);
  assert.ok(production.jobs.promote.concurrency);
  const deploy = production.jobs.promote.steps.find(
    (step) => step.run === "node scripts/deploy-client.mjs",
  );
  assert.equal(deploy.env.RELEASE_ID, "${{ steps.trusted.outputs.releaseId }}");
});
test("an automatic deploy is skipped when its commit is no longer the head of main", async () => {
  const request = async (route) => {
    assert.equal(route, "commits/main");
    return { sha };
  };
  assert.equal(await isMainHead(sha, { request }), true);
  assert.equal(await isMainHead("b".repeat(40), { request }), false);
  const production = parse(
    await readFile(new URL("../.github/workflows/production.yml", import.meta.url), "utf8"),
  );
  const steps = production.jobs.promote.steps;
  const trusted = steps.findIndex((step) => step.id === "trusted");
  assert.ok(trusted >= 0 && steps.length > trusted + 1);
  for (const step of steps.slice(trusted + 1))
    assert.equal(step.if, "steps.trusted.outputs.stale != 'true'");
});
