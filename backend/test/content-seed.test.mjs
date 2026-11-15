import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { createContentEditingFixture } from "./helpers/content.mjs";
import { buildContentSeed } from "../../scripts/build-content-seed.mjs";
import { verifyContentSeed } from "../dist/content/seed.js";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "bibi-seed-import-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await buildContentSeed({ outputDir: directory });
  return directory;
}
test("seed validation verifies every local image before allowing import", async (t) => {
  const directory = await fixture(t),
    seed = await verifyContentSeed(directory);
  assert.equal(seed.posts.length, 10);
  await writeFile(join(directory, seed.images[0].file), "corrupted source image");
  await assert.rejects(verifyContentSeed(directory), /digest|image|ảnh/i);
});
test("seed digest and contained image paths fail closed", async (t) => {
  const directory = await fixture(t),
    manifest = join(directory, "seed.json"),
    bytes = await readFile(manifest);
  await writeFile(join(directory, "seed.sha256"), "0".repeat(64));
  await assert.rejects(verifyContentSeed(directory), /digest/i);
  const seed = JSON.parse(bytes);
  seed.images[0].file = "../outside.jpg";
  const unsafe = JSON.stringify(seed);
  await writeFile(manifest, unsafe);
  await writeFile(join(directory, "seed.sha256"), hash(unsafe));
  await assert.rejects(verifyContentSeed(directory), /invalid|path|seed/i);
});

test("second seed never overwrites an edited imported article", async (t) => {
  const f = await createContentEditingFixture(t),
    directory = await fixture(t),
    source = await verifyContentSeed(directory),
    { importContentSeed } = await import("../dist/content/seed.js"),
    options = { pool: f.pool, media: f.media, seedDirectory: directory, clock: f.clock };
  assert.deepEqual(await importContentSeed(options), { created: source.posts.length, skipped: 0 });
  const [[count]] = await f.pool.query(
    "SELECT (SELECT COUNT(*) FROM content_categories) categories,(SELECT COUNT(*) FROM content_published_snapshots) snapshots,(SELECT COUNT(*) FROM content_media) images",
  );
  assert.equal(count.categories, 3);
  assert.equal(count.snapshots, source.posts.length);
  assert.equal(count.images, source.images.length);
  for (const original of source.posts) {
    const [[row]] = await f.pool.execute(
        "SELECT p.id,s.snapshot_json FROM content_posts p JOIN content_published_snapshots s ON s.post_id=p.id WHERE p.normalized_slug=?",
        [original.slug],
      ),
      candidate =
        typeof row.snapshot_json === "string" ? JSON.parse(row.snapshot_json) : row.snapshot_json;
    assert.equal(candidate.slug, original.slug);
    assert.equal(candidate.publishedAt, original.date);
    assert.equal(candidate.author.kind, "brand");
    assert.equal(candidate.author.name, "BiBi Studio");
    const dom = new JSDOM(candidate.html);
    try {
      const doc = dom.window.document;
      for (const block of original.content.filter((block) => block.type === "image")) {
        assert.ok([...doc.images].some((image) => image.alt === block.alt));
        if (block.caption) assert.ok(doc.body.textContent.includes(block.caption));
      }
    } finally {
      dom.window.close();
    }
  }
  const [[row]] = await f.pool.execute(
    "SELECT p.id FROM content_posts p JOIN content_seed_imports i ON i.id=? WHERE p.normalized_slug=?",
    [source.posts[0].sourceKey, source.posts[0].slug],
  );
  const before = await f.editing.get(f.admin, row.id),
    { id, revision, trashedAt, updatedAt, public: published, ...input } = before;
  assert.equal(published, null);
  assert.equal(trashedAt, null);
  assert.ok(updatedAt);
  const edited = await f.editing.saveDraft(
    f.admin,
    id,
    { ...input, title: "Đã biên tập", slug: "da-bien-tap" },
    revision,
  );
  assert.deepEqual(await importContentSeed(options), { created: 0, skipped: source.posts.length });
  const after = await f.editing.get(f.admin, id);
  assert.equal(after.title, "Đã biên tập");
  assert.equal(after.slug, "da-bien-tap");
  assert.equal(after.revision, edited.revision);
  assert.equal(
    (await f.editing.list(f.admin, { page: 1, pageSize: 100 })).total,
    source.posts.length,
  );
  assert.equal(
    (await f.editing.list(f.admin, { page: 1, pageSize: 100, status: "published" })).total,
    0,
  );
  assert.equal(await f.activeRead(), null);
  await assert.rejects(stat(f.paths.active), (error) => error.code === "ENOENT");
  const [[images]] = await f.pool.query("SELECT COUNT(*) n FROM content_media");
  assert.equal(images.n, source.images.length);
});

test("tampered final image aborts seed before any metadata is imported", async (t) => {
  const f = await createContentEditingFixture(t),
    directory = await fixture(t),
    source = await verifyContentSeed(directory),
    { importContentSeed } = await import("../dist/content/seed.js");
  await writeFile(join(directory, source.images.at(-1).file), "tampered");
  await assert.rejects(
    () =>
      importContentSeed({ pool: f.pool, media: f.media, seedDirectory: directory, clock: f.clock }),
    /Seed image digest mismatch/,
  );
  const [[count]] = await f.pool.query(
    "SELECT (SELECT COUNT(*) FROM content_posts) posts,(SELECT COUNT(*) FROM content_media) images,(SELECT COUNT(*) FROM content_seed_imports) markers",
  );
  assert.deepEqual({ ...count }, { posts: 0, images: 0, markers: 0 });
  assert.equal(await f.activeRead(), null);
});

test(
  "explicit seed CLI imports candidates and leaves the public pointer absent",
  { timeout: 300000 },
  async (t) => {
    const f = await createContentEditingFixture(t),
      directory = await fixture(t),
      base = join(f.paths.root, "cli"),
      root = join(base, "content"),
      privateDirectory = join(base, "private"),
      file = join(privateDirectory, "local.env");
    for (const path of [join(root, "media"), join(root, "generations"), privateDirectory])
      await mkdir(path, { recursive: true, mode: 0o700 });
    const values = {
      DB_HOST: f.dbConfig.host,
      DB_PORT: String(f.dbConfig.port),
      DB_USER: f.dbConfig.user,
      DB_PASSWORD: f.dbConfig.password,
      DB_NAME: f.dbConfig.database,
      BIBI_CONTENT_ROOT: root.replace(/\\/g, "/"),
      BIBI_CONTENT_SEED_DIRECTORY: directory.replace(/\\/g, "/"),
    };
    await writeFile(
      file,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") + "\n",
      { mode: 0o600, flag: "wx" },
    );
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [fileURLToPath(new URL("../dist/content/cli.js", import.meta.url)), "seed"],
      {
        env: { ...process.env, NODE_ENV: "development", BIBI_PRIVATE_ENV_FILE: file },
        windowsHide: true,
        timeout: 240000,
        maxBuffer: 1024 * 1024,
      },
    );
    const receipt = JSON.parse(stdout.trim());
    assert.equal(receipt.created, 10);
    assert.equal(receipt.skipped, 0);
    assert.equal((await f.editing.list(f.admin, { page: 1, pageSize: 100 })).total, 10);
    await assert.rejects(stat(join(root, "active")), (error) => error.code === "ENOENT");
  },
);
