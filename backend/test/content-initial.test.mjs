import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:http";
import { createContentE2eFixture } from "../../tests/e2e/helpers/content-fixture.mjs";
import { buildContentSeed } from "../../scripts/build-content-seed.mjs";
import { importContentSeed, verifyContentSeed } from "../dist/content/seed.js";
import { createContentMedia } from "../dist/content/media/service.js";
import { readActiveContent } from "../dist/content/publication/active-read.js";
import { createGenerationStore } from "../dist/content/publication/store.js";
import { withContentEnvironmentLock } from "../dist/content/environment-lock.js";
import { postInput } from "./helpers/content-publication.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { localEnvironmentText } from "../../scripts/local-env.mjs";

async function initialFixture(t, createInitialContent) {
  const f = await createContentE2eFixture(t, { mode: "bridge" }),
    clock = { now: () => new Date() },
    seedDirectory = join(f.paths.root, "original-seed");
  const assets = JSON.parse(await readFile(f.env.BIBI_CONTENT_ASSETS_FILE, "utf8")),
    store = createGenerationStore(f.paths, f.env.BIBI_CONTENT_ASSET_ROOT);
  await withContentEnvironmentLock(f.paths, async (lease) => {
    const active = await readActiveContent(f.paths);
    await store.restore(active.manifest.id, null, lease);
  });
  await buildContentSeed({ outputDir: seedDirectory });
  const source = await verifyContentSeed(seedDirectory),
    media = createContentMedia({ pool: f.pool, clock, paths: f.paths });
  await importContentSeed({ pool: f.pool, clock, media, seedDirectory });
  const options = {
    pool: f.pool,
    clock,
    paths: f.paths,
    media,
    assets,
    assetRoot: f.env.BIBI_CONTENT_ASSET_ROOT,
    seedDirectory,
    origin: f.baseUrl,
  };
  return { ...f, source, options, initial: createInitialContent(options), store };
}
test(
  "fixed compiled initial commands recover the same generation across processes",
  { timeout: 180000 },
  async (t) => {
    const { createInitialContent } = await import("../dist/content/initial.js"),
      f = await initialFixture(t, createInitialContent),
      privateDir = join(f.paths.root, "cli-private"),
      file = join(privateDir, "runtime.env");
    await mkdir(privateDir, { mode: 0o700 });
    await writeFile(
      file,
      localEnvironmentText({
        ...f.env,
        BIBI_CONTENT_ORIGIN: f.baseUrl,
        BIBI_CONTENT_SEED_DIRECTORY: f.options.seedDirectory,
      }),
      { mode: 0o600 },
    );
    const invoke = async (action) =>
      JSON.parse(
        (
          await promisify(execFile)(
            process.execPath,
            [resolve("backend/dist/content/cli.js"), "initial-" + action],
            {
              env: {
                ...process.env,
                NODE_ENV: "development",
                BIBI_PRIVATE_ENV_FILE: file,
                BIBI_RELEASE_MANIFEST: f.env.BIBI_RELEASE_MANIFEST,
              },
              windowsHide: true,
              timeout: 60000,
            },
          )
        ).stdout.trim(),
      );
    assert.equal((await invoke("status")).state, "absent");
    const prepared = await invoke("prepare");
    assert.equal(await readActiveContent(f.paths), null);
    assert.equal((await invoke("activate")).generationId, prepared.generationId);
    assert.equal((await invoke("verify")).committed, true);
    assert.equal((await invoke("status")).activeGenerationId, prepared.generationId);
  },
);
test(
  "first cutover publishes immutable original candidates and preserves edited working drafts",
  { timeout: 180000 },
  async (t) => {
    const { createInitialContent } = await import("../dist/content/initial.js"),
      f = await initialFixture(t, createInitialContent),
      original = f.source.posts[0];
    const [[row]] = await f.pool.execute("SELECT id FROM content_posts WHERE normalized_slug=?", [
        original.slug,
      ]),
      draft = await f.editing.get(f.actor, row.id);
    await f.editing.saveDraft(
      f.actor,
      draft.id,
      postInput(draft, { title: "PRIVATE WORKING DRAFT", slug: "private-working-draft" }),
      draft.revision,
    );
    const category = await f.editing.getCategory(f.actor, draft.categoryId);
    await f.editing.saveCategory(
      f.actor,
      category.id,
      {
        name: "PRIVATE CATEGORY",
        slug: "private-category",
        description: "",
        parentId: null,
        position: 0,
        active: true,
        seoTitle: "",
        seoDescription: "",
      },
      category.revision,
    );
    let prepared;
    await withContentEnvironmentLock(f.paths, async (lease) => {
      prepared = await f.initial.prepare(lease);
      assert.equal(await readActiveContent(f.paths), null);
      await f.initial.activate(lease);
      // A fresh instance must recover from persisted state, with another real canary.
      const recovered = createInitialContent(f.options);
      assert.equal((await recovered.prepare(lease)).generationId, prepared.generationId);
      await recovered.verify(lease);
    });
    const active = await readActiveContent(f.paths);
    assert.equal(active.snapshot.posts.length, 10);
    assert.equal(active.snapshot.categories.length, 3);
    assert.equal(active.snapshot.posts.find((p) => p.id === draft.id).title, original.title);
    assert.equal(active.snapshot.posts.find((p) => p.id === draft.id).publishedAt, original.date);
    assert.ok(active.snapshot.categories.every((c) => c.name !== "PRIVATE CATEGORY"));
    assert.equal((await f.editing.get(f.actor, draft.id)).title, "PRIVATE WORKING DRAFT");
    const publicResponse = await fetch(f.baseUrl + "/blog/" + original.slug);
    assert.equal(publicResponse.status, 200);
    await publicResponse.arrayBuffer();
    const privateResponse = await fetch(f.baseUrl + "/blog/private-working-draft");
    assert.equal(privateResponse.status, 404);
    await privateResponse.arrayBuffer();
    const [[generation]] = await f.pool.execute(
      "SELECT state,job_id FROM content_generations WHERE id=?",
      [prepared.generationId],
    );
    assert.equal(generation.state, "committed");
    assert.equal(generation.job_id, null);
    await withContentEnvironmentLock(f.paths, async (lease) =>
      assert.equal((await f.initial.prepare(lease)).generationId, prepared.generationId),
    );
    await withContentEnvironmentLock(f.paths, async (lease) => {
      await f.store.restore(prepared.generationId, null, lease);
      await assert.rejects(f.initial.prepare(lease), /missing|committed|generation/i);
    });
  },
);
test(
  "first cutover cannot commit against stale public HTML and restore removes only its own pointer",
  { timeout: 180000 },
  async (t) => {
    const { createInitialContent } = await import("../dist/content/initial.js"),
      f = await initialFixture(t, createInitialContent);
    const stale = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      res.end('<html><div id="root">old page</div></html>');
    });
    await new Promise((done) => stale.listen(0, "127.0.0.1", done));
    t.after(() => new Promise((done) => stale.close(done)));
    const initial = createInitialContent({
      ...f.options,
      origin: "http://127.0.0.1:" + stale.address().port,
    });
    await withContentEnvironmentLock(f.paths, async (lease) => {
      const prepared = await initial.prepare(lease);
      await initial.activate(lease);
      await assert.rejects(initial.verify(lease), /canary|document|bytes/i);
      await initial.restore(lease);
      assert.equal(await readActiveContent(f.paths), null);
      const [[row]] = await f.pool.execute("SELECT state FROM content_generations WHERE id=?", [
        prepared.generationId,
      ]);
      assert.equal(row.state, "failed");
      const [[drafts]] = await f.pool.query("SELECT COUNT(*) n FROM content_posts");
      assert.equal(drafts.n, 10);
    });
  },
);
