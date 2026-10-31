import { appendFile } from "node:fs/promises";
import { isMain } from "./runtime.mjs";
import { REQUIRE_STAGING_BEFORE_PRODUCTION } from "./release-policy.mjs";
export function assertTrustedRun(run, releaseId, repository) {
  if (
    !/^[a-f0-9]{40}-[1-9][0-9]*$/.test(releaseId) ||
    run.head_branch !== "main" ||
    run.event !== "push" ||
    run.conclusion !== "success" ||
    run.path !== ".github/workflows/ci.yml" ||
    run.head_repository?.full_name !== repository ||
    `${run.head_sha}-${run.id}` !== releaseId
  )
    throw new Error("Release is not from trusted successful main CI");
}
export function assertStagingEvidence(deployment, statuses, expected) {
  const payload =
    typeof deployment.payload === "string" ? JSON.parse(deployment.payload) : deployment.payload;
  if (
    deployment.environment !== "staging" ||
    statuses[0]?.state !== "success" ||
    ["releaseId", "checksum", "ciRunId"].some((k) => String(payload?.[k]) !== String(expected[k]))
  )
    throw new Error("Matching successful staging evidence required");
}
export async function github(route, body) {
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${route}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) throw new Error(`GitHub ${route}: HTTP ${response.status}`);
  return response.json();
}
export async function validateRelease(
  releaseId,
  { production = false, request = github, repository = process.env.GITHUB_REPOSITORY } = {},
) {
  if (!/^[a-f0-9]{40}-[1-9][0-9]*$/.test(releaseId)) throw new Error("Invalid release ID");
  const ciRunId = releaseId.split("-")[1];
  const run = await request(`actions/runs/${ciRunId}`);
  assertTrustedRun(run, releaseId, repository);
  const { artifacts } = await request(`actions/runs/${ciRunId}/artifacts?per_page=100`);
  const artifact = artifacts.find((a) => a.name === `release-${releaseId}` && !a.expired);
  if (!artifact) throw new Error("Trusted artifact missing or expired");
  let evidence;
  if (production && REQUIRE_STAGING_BEFORE_PRODUCTION) {
    const deployments = await request(
      `deployments?environment=staging&sha=${run.head_sha}&per_page=100`,
    );
    for (const d of deployments) {
      try {
        const payload = typeof d.payload === "string" ? JSON.parse(d.payload) : d.payload;
        assertStagingEvidence(d, await request(`deployments/${d.id}/statuses`), {
          releaseId,
          ciRunId,
          checksum: payload?.checksum,
        });
        if (!/^[a-f0-9]{64}$/.test(payload.checksum ?? "") || payload.artifactId !== artifact.id)
          continue;
        evidence = payload;
        break;
      } catch {
        /* another deployment is not matching evidence */
      }
    }
    if (!evidence) throw new Error("No successful staging evidence for exact artifact");
  }
  return {
    releaseId,
    ciRunId,
    sourceSha: run.head_sha,
    artifactId: artifact.id,
    checksum: evidence?.checksum ?? "",
  };
}
if (isMain(import.meta.url)) {
  try {
    const result = await validateRelease(process.env.RELEASE_ID, {
      production: process.env.DEPLOY_ENV === "production",
    });
    for (const [key, value] of Object.entries(result))
      await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
