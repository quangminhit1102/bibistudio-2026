import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fork } from "node:child_process";
import { once } from "node:events";
import { createPublicationFixture, publicationRequest } from "./helpers/content-publication.mjs";
import { readActiveContent } from "../dist/content/publication/active-read.js";
import { runNextPublication } from "../dist/content/publication/worker.js";
import { withContentEnvironmentLock } from "../dist/content/environment-lock.js";

test("actual killed workers recover prepared, post-pointer and pre-finalize jobs through canary", async (t) => {
  for (const phase of ["prepared", "pointer", "finalize"]) {
    await t.test(phase, async (t) => {
      const f = await createPublicationFixture(t),
        post = await f.makePost("crash-post"),
        job = await f.publication.request(f.admin, publicationRequest(post)),
        config = join(f.paths.root, "worker.json");
      await writeFile(
        config,
        JSON.stringify({
          database: f.database,
          paths: f.paths,
          assetRoot: f.assetRoot,
          assets: f.assets,
          now: f.clock.now().toISOString(),
        }),
        { mode: 0o600 },
      );
      const child = fork(
        new URL("./helpers/content-worker.mjs", import.meta.url),
        [config, phase],
        { stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true },
      );
      let error = "";
      child.stderr.on("data", (chunk) => {
        error += chunk;
      });
      t.after(() => {
        if (child.exitCode === null) child.kill();
      });
      const signal = await Promise.race([
        once(child, "message").then(([value]) => value),
        once(child, "exit").then(() => {
          throw Error("worker exited before boundary: " + error);
        }),
      ]);
      assert.equal(signal, phase);
      child.kill("SIGKILL");
      await once(child, "exit");
      const before = await readActiveContent(f.paths);
      assert.equal(before.manifest.id === f.previousId, phase === "prepared");
      await f.publication.reconcile();
      assert.equal((await f.publication.status(f.admin, job.id)).status, "succeeded");
      assert.ok(f.canaries.length >= 1);
      const [[audit]] = await f.pool.query(
        "SELECT COUNT(*) n FROM audit_logs WHERE action='content.publication.success' AND target_id=?",
        [job.id],
      );
      assert.equal(Number(audit.n), 1);
    });
  }
});
test("post-pointer recovery canary failure restores previous and never reports success", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("first"),
    job = await f.publication.request(f.admin, publicationRequest(post)),
    activate = f.context.store.activate;
  f.context.store = {
    ...f.context.store,
    activate: async (...args) => {
      await activate(...args);
      throw Error("activation outcome unknown");
    },
  };
  f.context.canary = async (active) => {
    if (active.manifest.id !== f.previousId) throw Error("canary failed");
  };
  await runNextPublication(f.context);
  await f.publication.reconcile();
  assert.equal((await f.publication.status(f.admin, job.id)).status, "failed");
  assert.equal((await readActiveContent(f.paths)).manifest.id, f.previousId);
});
test("rollback failure stays recoverable and is reported distinctly", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("restore-failure"),
    job = await f.publication.request(f.admin, publicationRequest(post)),
    store = f.context.store;
  f.context.canary = async (active) => {
    if (active?.manifest.id !== f.previousId) throw Error("canary");
  };
  f.context.store = {
    ...store,
    restore: async () => {
      throw Error("restore failed");
    },
  };
  await assert.rejects(
    runNextPublication(f.context),
    (error) => error.code === "PUBLICATION_RECOVERY_REQUIRED",
  );
  const pending = await f.publication.status(f.admin, job.id);
  assert.equal(pending.status, "verifying");
  assert.equal(pending.error.code, "PUBLICATION_RECOVERY_REQUIRED");
  f.context.store = store;
  await f.publication.reconcile();
  assert.equal((await f.publication.status(f.admin, job.id)).status, "failed");
  assert.equal((await readActiveContent(f.paths)).manifest.id, f.previousId);
});

test("atomic pointer readers only observe whole generations; corrupt bytes fail closed", async (t) => {
  const f = await createPublicationFixture(t),
    post = await f.makePost("first");
  await f.publication.request(f.admin, publicationRequest(post));
  let running = true;
  const observed = [];
  const reader = (async () => {
    while (running) {
      const active = await readActiveContent(f.paths);
      observed.push([active.manifest.id, active.snapshot.posts.length]);
    }
  })();
  try {
    await runNextPublication(f.context);
  } finally {
    running = false;
    await reader;
  }
  const active = await readActiveContent(f.paths);
  assert.ok(observed.length > 0);
  for (const [id, count] of observed) assert.equal(count, id === f.previousId ? 0 : 1);
  await assert.rejects(
    withContentEnvironmentLock(f.paths, (lease) =>
      f.context.store.restore(f.previousId, null, lease),
    ),
    /pointer|active|conflict/i,
  );
  const file = join(f.paths.generations, active.manifest.id, active.manifest.publicDataFile),
    bytes = await readFile(file);
  await writeFile(file, Buffer.concat([bytes, Buffer.from("x")]));
  await assert.rejects(readActiveContent(f.paths), /hash|corrupt|integrity/i);
});
