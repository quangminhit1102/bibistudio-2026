import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { contentReleaseFixture, priorContentMetadata } from "../tests/helpers/content-release.mjs";
const require = createRequire(import.meta.url);
test("alternate-mode acceptance builder rejects CI identities and promotion before building", async () => {
  const { buildContentAcceptanceBundle } = await import("./build.mjs");
  for (const args of [
    { ciRunId: "1" },
    { upload: true },
    { promote: true },
    { outputDir: ".releases" },
  ])
    await assert.rejects(
      buildContentAcceptanceBundle({
        sourceSha: "a".repeat(40),
        mode: "cms",
        outputDir: ".superpowers/test-content-acceptance",
        ...args,
      }),
      /local|acceptance|promotion|separate/i,
    );
});
test("static sitemap excludes Blog and private routes and never invents dates", async (t) => {
  const { writeStaticContentSitemap } = await import("./build-content-assets.mjs"),
    f = await contentReleaseFixture(t);
  await writeStaticContentSitemap(f.frontend, [
    { path: "/" },
    { path: "/about" },
    { path: "/blog/private" },
    { path: "/admin/posts" },
    { path: "/api/test" },
    { path: "/preview" },
  ]);
  const xml = await readFile(join(f.frontend, "sitemaps/site.xml"), "utf8");
  assert.match(xml, /<loc>https:\/\/bibistudio.vn\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/bibistudio.vn\/about<\/loc>/);
  assert.doesNotMatch(xml, /blog|admin|api|preview|lastmod/);
  assert.match(
    await readFile(join(f.frontend, "robots.txt"), "utf8"),
    /Sitemap: https:\/\/bibistudio.vn\/sitemap.xml/,
  );
});
test("manifest7 is explicit, bridge6 is read-only, and manifests1 to6 remain valid", async (t) => {
  const { makeManifest, validateManifest } = require("../ops/release.cjs"),
    c = require("../ops/content-metadata.cjs"),
    f = await contentReleaseFixture(t),
    prior = await priorContentMetadata(),
    sha = "a".repeat(40);
  for (let n = 0; n <= 5; n++) {
    const m = makeManifest(sha, "12", ...prior.slice(0, n));
    assert.equal(m.schemaVersion, n + 1);
    assert.deepEqual(validateManifest(m), m);
  }
  const feature = await c.createContentMetadata(f.dir, "cms"),
    bridge = await c.createContentMetadata(f.dir, "bridge"),
    m = makeManifest(sha, "13", ...prior, { content: feature }),
    b = makeManifest(sha, "14", ...prior, { contentPublic: bridge });
  assert.equal(m.schemaVersion, 7);
  assert.equal(m.content.mode, "cms");
  assert.equal(b.schemaVersion, 6);
  assert.equal(b.content, undefined);
  assert.equal(b.contentPublic.readModelVersion, 1);
  assert.deepEqual(validateManifest(m), m);
  assert.deepEqual(validateManifest(b), b);
  for (const invalid of [
    { ...m, content: undefined },
    { ...m, schemaVersion: 6 },
    { ...b, content: feature },
    { ...m, contentPublic: bridge },
  ])
    assert.throws(() => validateManifest(invalid), /content|manifest/i);
  const code = execFileSync(
      "git",
      ["show", "6eb57c3f46017785f31490e02168f202969ee0ce:ops/release.cjs"],
      { encoding: "utf8" },
    ),
    module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (id) => require("../ops/" + id.replace(/^\.\//, "")),
  });
  assert.throws(() => module.exports.validateManifest(m), /manifest/i);
});
test("content preparation rejects altered SQL, seed image, PHP, renderer and public asset bytes", async (t) => {
  const c = require("../ops/content-metadata.cjs"),
    f = await contentReleaseFixture(t),
    m = await c.createContentMetadata(f.dir, "cms"),
    b = await c.createContentMetadata(f.dir, "bridge");
  await c.verifyContentAssets(f.dir, { content: m });
  for (const name of [
    "backend/content-migrations/001_content.sql",
    "backend/content-seed/images/original.png",
    "backend/content-public/content-reader.php",
    "backend/dist/content/render/document.js",
    "backend/content-assets.json",
    "frontend/assets/blog-abc123.js",
    "frontend/assets/blog-abc123.css",
  ]) {
    const path = join(f.dir, name),
      original = await readFile(path);
    await writeFile(path, "tampered");
    await assert.rejects(c.verifyContentAssets(f.dir, { content: m }));
    await assert.rejects(c.verifyContentAssets(f.dir, { contentPublic: b }));
    await writeFile(path, original);
  }
});
test("content lifecycle requires paired content restore before migration and refuses dirty schemas", async (t) => {
  const { prepareContent } = require("../ops/content-lifecycle.cjs"),
    c = require("../ops/content-metadata.cjs"),
    f = await contentReleaseFixture(t),
    content = await c.createContentMetadata(f.dir, "cms"),
    candidate = { dir: f.dir, manifest: { content } },
    calls = [];
  let complete = false;
  const run = async (_config, _dir, action) => {
    calls.push(action);
    if (action === "content-migrate") complete = true;
    return {
      state: complete ? "complete" : "empty",
      version: 1,
      migrationChecksums: complete ? content.migrationChecksums : {},
    };
  };
  await assert.rejects(prepareContent({}, null, candidate, { run }), /backup/i);
  await prepareContent({}, null, candidate, {
    run,
    backupReceipt: {
      verified: true,
      profiles: true,
      content: true,
      sha256: "b".repeat(64),
      bytes: 1,
    },
  });
  assert.deepEqual(calls, ["content-status", "content-migrate", "content-status", "content-seed"]);
  await assert.rejects(
    prepareContent({}, null, candidate, {
      run: async () => ({ state: "dirty" }),
      backupReceipt: {
        verified: true,
        profiles: true,
        content: true,
        sha256: "b".repeat(64),
        bytes: 1,
      },
    }),
    /dirty|unknown/i,
  );
});
