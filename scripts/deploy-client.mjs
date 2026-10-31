import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { github } from "./github-release.mjs";
import { smoke } from "./smoke.mjs";
import { browserSmoke, captureOpenClient } from "./browser-smoke.mjs";
import { isMain } from "./runtime.mjs";
import { assertArtifactChecksum } from "./release-policy.mjs";
export async function deployClient() {
  const { RELEASE_ID: id, DEPLOY_ENV: environment, BASE_URL: baseUrl } = process.env;
  if (
    !["staging", "production"].includes(environment) ||
    !/^(?:[a-f0-9]{40}-[1-9][0-9]*|baseline)$/.test(id ?? "")
  )
    throw new Error("Invalid deploy request");
  const directory = await mkdtemp(join(tmpdir(), "bibi-ssh-"));
  let oldClient;
  try {
    const key = join(directory, "key"),
      known = join(directory, "known_hosts");
    if (!process.env.DEPLOY_SSH_KEY) throw new Error("Deploy SSH key missing");
    await writeFile(key, process.env.DEPLOY_SSH_KEY.trim() + "\n", { mode: 0o600 });
    await writeFile(
      known,
      "h217103.tino.org ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOOODcmrQBW2RohXKSQTVOo4xRjswYoom5QVmVMlYEBU\n",
      { mode: 0o600 },
    );
    const ssh = (command, input) =>
      new Promise((resolve, reject) => {
        const child = spawn(
          "ssh",
          [
            "-i",
            key,
            "-o",
            "IdentitiesOnly=yes",
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=yes",
            "-o",
            `UserKnownHostsFile=${known}`,
            "-o",
            "ConnectTimeout=20",
            "vhplasti@h217103.tino.org",
            command,
          ],
          { stdio: ["pipe", "pipe", "inherit"] },
        );
        let output = "";
        child.stdout.on("data", (chunk) => {
          output += chunk;
          process.stdout.write(chunk);
        });
        child.once("error", reject);
        child.once("exit", (code) =>
          code === 0
            ? resolve(output)
            : reject(new Error(`SSH ${command.split(" ")[0]} failed (${code})`)),
        );
        if (input) pipeline(createReadStream(input), child.stdin).catch(reject);
        else child.stdin.end();
      });
    await ssh("check");
    if (process.env.DEPLOY_ACTION === "rollback") {
      await ssh(`rollback ${id}`);
      return;
    }
    if (id === "baseline") throw new Error("Baseline cannot be deployed");
    const artifactDir = process.env.ARTIFACT_DIR ?? ".release-download";
    const names = await readdir(artifactDir);
    if (names.some((n) => ![`${id}.tgz`, `${id}.tgz.sha256`].includes(n)) || names.length !== 2)
      throw new Error("Unexpected artifact files");
    const archive = join(artifactDir, `${id}.tgz`);
    const checksum = createHash("sha256")
      .update(await readFile(archive))
      .digest("hex");
    assertArtifactChecksum(checksum, await readFile(archive + ".sha256", "utf8"), {
      production: environment === "production",
      expectedChecksum: process.env.EXPECTED_CHECKSUM,
    });
    await ssh(`upload ${id} ${checksum}`, archive);
    oldClient = await captureOpenClient(baseUrl);
    const output = await ssh(`deploy ${id}`);
    const result = output
      .trim()
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return {};
        }
      })
      .find((e) => e.event === "deployed" && e.releaseId === id);
    if (!result) throw new Error("Missing deploy receipt");
    try {
      await smoke({ baseUrl, expectedRelease: id, expectedSha: id.split("-")[0] });
      await browserSmoke(baseUrl);
      await oldClient.verify();
    } catch (error) {
      if (!result.previousReleaseId)
        throw new Error(`Smoke failed: ${error.message}; no previous release available`);
      try {
        await ssh(`rollback ${result.previousReleaseId}`);
        if (result.previousReleaseId !== "baseline")
          await smoke({
            baseUrl,
            expectedRelease: result.previousReleaseId,
            expectedSha: result.previousReleaseId.split("-")[0],
          });
      } catch (rollback) {
        throw new Error(`Smoke failed: ${error.message}; ROLLBACK FAILED: ${rollback.message}`);
      }
      throw new Error(`Smoke failed: ${error.message}; previous release restored and verified`);
    }
    const deployment = await github("deployments", {
      ref: id.split("-")[0],
      environment,
      auto_merge: false,
      required_contexts: [],
      production_environment: environment === "production",
      payload: {
        releaseId: id,
        checksum,
        ciRunId: id.split("-")[1],
        artifactId: Number(process.env.ARTIFACT_ID),
      },
    });
    await github(`deployments/${deployment.id}/statuses`, {
      state: "success",
      environment_url: baseUrl,
      auto_inactive: false,
      log_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    });
  } finally {
    await oldClient?.close();
    await rm(directory, { recursive: true, force: true });
  }
}
if (isMain(import.meta.url))
  deployClient().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
