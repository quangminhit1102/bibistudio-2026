import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { setupLocalContent, startLocalContent } from "./local-content.mjs";
import { createContentMediaFixture, validDraft } from "../backend/test/helpers/content.mjs";
import { createContentEditing } from "../backend/dist/content/editing.js";
import { readActiveContent } from "../backend/dist/content/publication/active-read.js";
import { assertPortsFree } from "./process-group.mjs";
import { localEnvironmentText } from "./local-env.mjs";
import { parseEnv } from "node:util";
import { createContentE2eFixture } from "../tests/e2e/helpers/content-fixture.mjs";
test("local environment serialization preserves JSON paths and Windows backslashes", () => {
  const values = {
    MANAGED_ROOTS: JSON.stringify(["D:/Project/BiBi's/content"]),
    WINDOWS_PATH: "C:\\Users\\Admin\\local",
    SECRET: "synthetic#'quote",
    ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
  };
  assert.deepEqual({ ...parseEnv(localEnvironmentText(values)) }, values);
});
test(
  "explicit local content setup twice preserves drafts, keys, schema ledger and active generation",
  { timeout: 120000 },
  async (t) => {
    const f = await createContentMediaFixture(t),
      directory = join(f.paths.root, "local-cms"),
      env = {
        ANALYTICS_RELAY_SECRET: randomBytes(32).toString("base64url"),
        AUTH_ALLOWED_ORIGINS: "http://127.0.0.1:5173",
        AUTH_JWT_SECRET: randomBytes(32).toString("hex"),
      };
    const first = await setupLocalContent({ pool: f.pool, env, directory });
    const [[seeded]] = await f.pool.query("SELECT COUNT(*) n FROM content_seed_imports");
    assert.equal(Number(seeded.n), 10);
    assert.equal((await readActiveContent(first.paths)).snapshot.posts.length, 0);
    const media = (await import("../backend/dist/content/media/service.js")).createContentMedia({
        pool: f.pool,
        clock: f.clock,
        paths: first.paths,
      }),
      editing = createContentEditing({
        pool: f.pool,
        clock: f.clock,
        paths: first.paths,
        media,
        activeRead: async () => (await readActiveContent(first.paths))?.snapshot ?? null,
      });
    const draft = await editing.saveDraft(
        f.admin,
        null,
        validDraft({ title: "Giữ bản nháp" }),
        null,
      ),
      active = await readFile(first.paths.active, "utf8"),
      [[before]] = await f.pool.query("SELECT COUNT(*) n FROM content_schema_migrations");
    const second = await setupLocalContent({ pool: f.pool, env: first.env, directory });
    assert.equal(second.env.AUTH_JWT_SECRET, env.AUTH_JWT_SECRET);
    assert.equal(second.env.ANALYTICS_RELAY_SECRET, env.ANALYTICS_RELAY_SECRET);
    assert.equal((await editing.get(f.admin, draft.id)).title, "Giữ bản nháp");
    assert.equal(await readFile(second.paths.active, "utf8"), active);
    const [[after]] = await f.pool.query("SELECT COUNT(*) n FROM content_schema_migrations");
    assert.equal(after.n, before.n);
    const controller = new AbortController(),
      php = await startLocalContent({
        env: second.env,
        backendPort: 3001,
        frontendPort: 5173,
        contentRoot: second.paths.root,
        signal: controller.signal,
      });
    const port = Number(new URL(php.url).port);
    const response = await fetch(php.url + "/blog");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<h1/);
    controller.abort();
    await php.close();
    await assertPortsFree([port]);
    await writeFile(second.paths.active, "corrupt pointer");
    await assert.rejects(
      startLocalContent({
        env: second.env,
        backendPort: 3001,
        frontendPort: 5173,
        contentRoot: second.paths.root,
      }),
      /generation|pointer|content|nội dung/i,
    );
  },
);
test(
  "real dev uploads, saves and publishes through the source API with PHP and survives restart",
  { timeout: 120000 },
  async (t) => {
    const f = await createContentE2eFixture(t, { mode: "dev" }),
      token = await f.login(),
      prepared = await f.preparePost(),
      headers = {
        Origin: f.baseUrl,
        Authorization: "Bearer " + token,
        "X-Bibi-Request": "1",
        "Content-Type": "application/json",
      };
    const responses = await Promise.all([
      fetch(f.baseUrl + "/api/content/media", {
        method: "POST",
        headers,
        body: JSON.stringify({
          originalName: "source.png",
          mimeType: "image/png",
          data: prepared.bytes.toString("base64"),
        }),
      }),
      fetch(f.baseUrl + "/api/content/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: validDraft({
            slug: "source-api-post",
            title: "Bài từ dev",
            categoryId: prepared.category.id,
            coverMediaId: prepared.image.id,
            coverAlt: "Ảnh test",
          }),
        }),
      }),
    ]);
    assert.deepEqual(
      await Promise.all(
        responses.map(async (response) => ({
          status: response.status,
          ...(!response.ok ? { code: (await response.clone().json()).error?.code } : {}),
        })),
      ),
      [{ status: 201 }, { status: 201 }],
    );
    const post = await responses[1].json();
    const queued = await fetch(f.baseUrl + "/api/content/publications", {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "publish",
        targetId: post.id,
        expectedRevision: post.revision,
        idempotencyKey: randomUUID(),
      }),
    });
    assert.equal(queued.status, 202);
    const job = await queued.json();
    let status;
    for (let i = 0; i < 40; i++) {
      status = await (
        await fetch(f.baseUrl + "/api/content/publications/" + job.id, { headers })
      ).json();
      if (["succeeded", "failed"].includes(status.status)) break;
      await new Promise((done) => setTimeout(done, 250));
    }
    assert.equal(status.status, "succeeded");
    assert.match(await (await fetch(f.baseUrl + "/blog/source-api-post")).text(), /Bài từ dev/);
    const targets = await (await fetch(`http://127.0.0.1:${f.ownedPorts[2]}/json/list`)).json(),
      debuggerSocket = new WebSocket(targets[0].webSocketDebuggerUrl);
    await new Promise((done, reject) => {
      debuggerSocket.addEventListener("open", done, { once: true });
      debuggerSocket.addEventListener("error", reject, { once: true });
    });
    const evaluated = new Promise((done) =>
      debuggerSocket.addEventListener("message", (event) => {
        const response = JSON.parse(event.data);
        if (response.id === 1) done(response);
      }),
    );
    debuggerSocket.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression: "process.versions.node" },
      }),
    );
    assert.match((await evaluated).result.result.value, /^24\./);
    debuggerSocket.close();
    await new Promise((done) => debuggerSocket.addEventListener("close", done, { once: true }));
    await f.restart();
    assert.match(await (await fetch(f.baseUrl + "/blog/source-api-post")).text(), /Bài từ dev/);
    const ports = [...f.ownedPorts];
    await f.close();
    await assertPortsFree(ports);
  },
);
