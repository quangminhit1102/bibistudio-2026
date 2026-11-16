import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile, symlink, readlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { contentReleaseFixture, priorContentMetadata } from "../tests/helpers/content-release.mjs";
const require = createRequire(import.meta.url);
test("retention pins the verified bridge beyond the recent release window", async (t) => {
  const { pruneReleases } = require("../ops/deploy.cjs"),
    { makeManifest } = require("../ops/release.cjs"),
    f = await contentReleaseFixture(t),
    c = require("../ops/content-metadata.cjs"),
    prior = await priorContentMetadata(),
    sha = "a".repeat(40),
    bridgeId = sha + "-1";
  await mkdir(join(f.dir, "private"));
  for (let i = 1; i <= 8; i++) {
    const dir = join(f.dir, "releases", sha + "-" + i);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, ".successful"), new Date(2026, 0, i).toISOString());
  }
  await writeFile(
    join(f.dir, "releases", bridgeId, "manifest.json"),
    JSON.stringify(
      makeManifest(sha, "1", ...prior, {
        contentPublic: await c.createContentMetadata(f.dir, "bridge"),
      }),
    ),
  );
  await writeFile(join(f.dir, "private/content-bridge-release"), bridgeId);
  await pruneReleases({ root: f.dir }, { activeId: sha + "-8" });
  assert.equal(
    (await readFile(join(f.dir, "releases", bridgeId, "manifest.json"), "utf8")).includes(
      '"contentPublic"',
    ),
    true,
  );
  await rm(join(f.dir, "releases", bridgeId, "manifest.json"));
  await assert.rejects(pruneReleases({ root: f.dir }, { activeId: sha + "-8" }));
});
test("release budget preserves content and runtime headroom before extraction", async (t) => {
  const { assertStorage } = require("../ops/deploy.cjs"),
    f = await contentReleaseFixture(t);
  await assert.rejects(
    assertStorage({ root: f.dir, site: f.frontend, maxManagedBytes: 128 * 1024 ** 2 }, 0, {
      availableBytes: 1024 ** 3,
    }),
    /quota|headroom/i,
  );
});
test("native rollback refuses an unaware release before changing app, content or routing", async (t) => {
  const { rollbackRelease } = require("../ops/deploy.cjs"),
    f = await contentReleaseFixture(t),
    site = join(f.dir, "site"),
    oldId = "a".repeat(40) + "-1",
    currentId = "b".repeat(40) + "-2";
  await mkdir(site);
  await mkdir(join(f.dir, "private"));
  await mkdir(join(f.dir, "content"));
  for (const [id, sha, run] of [
    [oldId, "a", "1"],
    [currentId, "b", "2"],
  ]) {
    const dir = join(f.dir, "releases", id);
    await mkdir(join(dir, "frontend/assets"), { recursive: true });
    await writeFile(join(dir, "frontend/index.html"), "app fixture");
    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify({ schemaVersion: 1, releaseId: id, sourceSha: sha.repeat(40), ciRunId: run }),
    );
    await writeFile(join(dir, ".successful"), "2026-11-16");
  }
  await symlink(
    join(f.dir, "releases", currentId),
    join(f.dir, "current"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await writeFile(join(f.dir, "content/active"), "new content pointer");
  await writeFile(join(f.dir, "private/content-routing.json"), '{"schemaVersion":1}');
  await writeFile(join(site, ".htaccess"), "owned content routing");
  let restarted = false;
  await assert.rejects(
    rollbackRelease({ root: f.dir, site, environment: "staging" }, oldId, {
      restart: async () => {
        restarted = true;
      },
      verify: async () => {},
    }),
    /content.*compatib/i,
  );
  assert.equal(restarted, false);
  assert.equal(await readlink(join(f.dir, "current")), join(f.dir, "releases", currentId));
  assert.equal(await readFile(join(f.dir, "content/active"), "utf8"), "new content pointer");
  assert.equal(await readFile(join(site, ".htaccess"), "utf8"), "owned content routing");
});
test("content marker or active pointer rejects unaware apps before any mutation", async (t) => {
  const { assertContentCompatible } = require("../ops/content-compatibility.cjs"),
    f = await contentReleaseFixture(t),
    config = { root: f.dir };
  await assertContentCompatible(config, { manifest: {} });
  await mkdir(join(f.dir, "private"));
  await writeFile(join(f.dir, "private/content-routing.json"), '{"schemaVersion":1}');
  await assert.rejects(assertContentCompatible(config, { manifest: {} }), /content.*compatib/i);
  await assertContentCompatible(config, {
    manifest: { contentPublic: { readerVersion: 1, readModelVersion: 1 } },
  });
  await assert.rejects(
    assertContentCompatible(config, {
      manifest: { contentPublic: { readerVersion: 2, readModelVersion: 1 } },
    }),
    /content.*compatib/i,
  );
  assert.equal(
    await readFile(join(f.dir, "private/content-routing.json"), "utf8"),
    '{"schemaVersion":1}',
  );
});
test("owned content routing survives app routing refresh and detects modified stable reader", async (t) => {
  const { createHash } = await import("node:crypto"),
    { installContentRouting, verifyContentRouting } = require("../ops/content-routing.cjs"),
    { applyRouting } = require("../ops/deploy.cjs"),
    f = await contentReleaseFixture(t),
    site = join(f.dir, "site"),
    base = "RewriteEngine On\nRewriteRule ^existing$ /kept [L]\n";
  await mkdir(site);
  await mkdir(join(f.dir, "private"));
  await mkdir(join(f.dir, "current/frontend"), { recursive: true });
  await writeFile(join(site, ".htaccess"), base);
  await writeFile(
    join(f.dir, "private/content-reader.json"),
    JSON.stringify({
      schemaVersion: 1,
      environment: "local",
      canonicalOrigin: "http://127.0.0.1:7777",
      contentRoot: join(f.dir, "content"),
    }),
    { mode: 0o600 },
  );
  const config = {
    root: f.dir,
    site,
    expectedRootSha256: createHash("sha256").update(base).digest("hex"),
  };
  await installContentRouting(config);
  const expected =
    (await readFile(join(site, ".htaccess"), "utf8")) + "# external rule preserved\n";
  await writeFile(join(site, ".htaccess"), expected);
  await applyRouting(config, { contentPublic: { readerVersion: 1, readModelVersion: 1 } });
  assert.equal(await readFile(join(site, ".htaccess"), "utf8"), expected);
  await verifyContentRouting(config);
  await writeFile(join(f.dir, "public-reader/content-reader.php"), "changed reader");
  await assert.rejects(
    applyRouting(config, { contentPublic: { readerVersion: 1, readModelVersion: 1 } }),
    /reader|checksum|content/i,
  );
  assert.equal(await readFile(join(site, ".htaccess"), "utf8"), expected);
});
