import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";

const id = "a".repeat(40) + "-123";
const previous = "b".repeat(40) + "-122";
const clientUrl = new URL("./deploy-client.mjs", import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === clientUrl) {
      const exports = {
        "node:child_process": ["spawn"],
        "./smoke.mjs": ["smoke"],
        "./browser-smoke.mjs": ["browserSmoke", "captureOpenClient"],
      }[specifier];
      if (exports)
        return {
          url:
            "data:text/javascript," +
            encodeURIComponent(
              exports
                .map(
                  (name) =>
                    `export const ${name} = (...args) => globalThis.__deployClientMocks.${name}(...args);`,
                )
                .join("\n"),
            ),
          shortCircuit: true,
        };
    }
    return nextResolve(specifier, context);
  },
});
const { deployClient } = await import("./deploy-client.mjs");
hooks.deregister();

async function fixture(t, { fail, githubFailure, action } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "deploy-client-test-"));
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    RELEASE_ID: id,
    DEPLOY_ENV: "production",
    DEPLOY_ACTION: action ?? "deploy",
    DEPLOY_SSH_KEY: "test-key-not-used-for-network",
    BASE_URL: "https://example.test",
    ARTIFACT_DIR: directory,
    ARTIFACT_ID: "456",
    GITHUB_REPOSITORY: "example/test",
    GITHUB_RUN_ID: "789",
    GITHUB_TOKEN: "test-token-not-used-for-network",
  };
  const archive = Buffer.from("test archive");
  const checksum = createHash("sha256").update(archive).digest("hex");
  process.env.EXPECTED_CHECKSUM = checksum;
  await writeFile(join(directory, `${id}.tgz`), archive);
  await writeFile(join(directory, `${id}.tgz.sha256`), `${checksum}\n`);
  t.after(async () => {
    process.env = originalEnv;
    delete globalThis.__deployClientMocks;
    await rm(directory, { recursive: true, force: true });
  });
  const events = [];
  const requests = [];
  const warnings = [];
  const fails = (name) => (Array.isArray(fail) ? fail.includes(name) : fail === name);
  t.mock.method(console, "warn", (message) => warnings.push(message));
  t.mock.method(process.stdout, "write", () => true);
  const step = async (name) => {
    events.push(name);
    if (fails(name)) throw new Error(`${name} failed`);
  };
  globalThis.__deployClientMocks = {
    spawn(_file, args) {
      const command = args.at(-1);
      const name = command.split(" ")[0];
      events.push(command);
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stdin = new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      });
      child.stdin.on("finish", () => {
        if (name === "deploy")
          child.stdout.write(
            JSON.stringify({ event: "deployed", releaseId: id, previousReleaseId: previous }) +
              "\n",
          );
        child.stdout.end();
        child.emit("exit", fails(name) ? 1 : 0);
      });
      return child;
    },
    smoke: () => step("smoke"),
    browserSmoke: () => step("browser"),
    captureOpenClient: async () => {
      await step("capture");
      return { verify: () => step("old-client"), close: () => step("close") };
    },
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const route = url.split("/repos/example/test/")[1];
    events.push(route);
    requests.push({ route, body: JSON.parse(options.body) });
    return requests.length === githubFailure
      ? new Response("GitHub incident", { status: 500 })
      : Response.json({ id: 42 });
  });
  return { events, requests, warnings, checksum };
}

test("publishes the deployment and success status only after all smoke checks", async (t) => {
  const { events, requests, warnings, checksum } = await fixture(t);
  await deployClient();
  assert.deepEqual(events.slice(-7), [
    `deploy ${id}`,
    "smoke",
    "browser",
    "old-client",
    "deployments",
    "deployments/42/statuses",
    "close",
  ]);
  assert.deepEqual(requests[0].body, {
    ref: id.split("-")[0],
    environment: "production",
    auto_merge: false,
    required_contexts: [],
    production_environment: true,
    payload: { releaseId: id, checksum, ciRunId: "123", artifactId: 456 },
  });
  assert.equal(requests[1].body.state, "success");
  assert.deepEqual(warnings, []);
});

for (const githubFailure of [1, 2])
  test(`GitHub record call ${githubFailure} HTTP 500 warns without failing the live release`, async (t) => {
    const { events, requests, warnings } = await fixture(t, { githubFailure });
    await assert.doesNotReject(deployClient());
    assert.equal(requests.length, githubFailure);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^::warning::.*release.*live/i);
    assert.ok(warnings[0].includes(id));
    assert.match(warnings[0], /GitHub .*HTTP 500/);
    assert.equal(events.at(-1), "close");
    assert.ok(!events.some((event) => event.startsWith("rollback ")));
  });

for (const fail of ["check", "upload", "capture", "deploy", "smoke", "browser", "old-client"])
  test(`${fail} failure still rejects and never publishes a GitHub record`, async (t) => {
    const { events, requests, warnings } = await fixture(t, { fail });
    await assert.rejects(deployClient(), /failed/);
    assert.deepEqual(requests, []);
    assert.deepEqual(warnings, []);
    assert.equal(
      events.includes(`rollback ${previous}`),
      ["smoke", "browser", "old-client"].includes(fail),
    );
  });

test("explicit rollback failure still rejects without a GitHub warning", async (t) => {
  const { requests, warnings } = await fixture(t, { action: "rollback", fail: "rollback" });
  await assert.rejects(deployClient(), /SSH rollback failed/);
  assert.deepEqual(requests, []);
  assert.deepEqual(warnings, []);
});

test("failed smoke recovery still reports ROLLBACK FAILED", async (t) => {
  const { requests, warnings } = await fixture(t, { fail: ["smoke", "rollback"] });
  await assert.rejects(
    deployClient(),
    /Smoke failed: smoke failed; ROLLBACK FAILED: SSH rollback failed/,
  );
  assert.deepEqual(requests, []);
  assert.deepEqual(warnings, []);
});

test("successful explicit rollback does not publish a deployment record", async (t) => {
  const { requests, warnings } = await fixture(t, { action: "rollback" });
  await deployClient();
  assert.deepEqual(requests, []);
  assert.deepEqual(warnings, []);
});
