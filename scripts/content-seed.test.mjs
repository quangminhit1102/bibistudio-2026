import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import { buildContentSeed } from "./build-content-seed.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), "bibi-seed-build-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function source() {
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": resolve("src") } },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  try {
    return (await server.ssrLoadModule("/src/data/blog.ts")).getAllBlogPosts();
  } finally {
    await server.close();
  }
}
test("seed captures all original journal fields and exact bundled image bytes", async (t) => {
  const output = await directory(t),
    original = await source(),
    result = await buildContentSeed({ outputDir: output });
  const bytes = await readFile(result.manifestFile),
    seed = JSON.parse(bytes);
  assert.equal(hash(bytes), result.sha256);
  assert.equal((await readFile(join(output, "seed.sha256"), "utf8")).trim(), result.sha256);
  assert.equal(seed.schemaVersion, 1);
  assert.equal(seed.posts.length, original.length);
  assert.equal(original.length, 10);
  const image = async (url) => {
    assert.match(url, /^\/src\/assets\/blog\/[a-z0-9-]+\.(?:jpg|png|webp)$/);
    const raw = await readFile(resolve(url.slice(1))),
      file = `images/${hash(raw)}${extname(url)}`;
    assert.deepEqual(await readFile(join(output, file)), raw);
    assert.ok(
      seed.images.some(
        (item) => item.file === file && item.sha256 === hash(raw) && item.bytes === raw.length,
      ),
    );
    return file;
  };
  for (const post of original) {
    const expected = {
      ...post,
      sourceKey: "blog:" + post.slug,
      coverImage: await image(post.coverImage),
      content: [],
    };
    for (const block of post.content)
      expected.content.push(
        block.type === "image" ? { ...block, src: await image(block.src) } : block,
      );
    assert.deepEqual(
      seed.posts.find((item) => item.sourceKey === expected.sourceKey),
      expected,
    );
  }
  assert.equal(new Set(seed.posts.map((post) => post.category)).size, 3);
});
test("independent seed builds produce the same versioned digest", async (t) => {
  const a = await buildContentSeed({ outputDir: await directory(t) }),
    b = await buildContentSeed({ outputDir: await directory(t) });
  assert.equal(a.sha256, b.sha256);
  assert.deepEqual(await readFile(a.manifestFile), await readFile(b.manifestFile));
});
