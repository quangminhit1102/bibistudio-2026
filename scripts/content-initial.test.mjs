import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, lstat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { contentReleaseFixture } from "../tests/helpers/content-release.mjs";
const require = createRequire(import.meta.url);
for (const mode of ["fresh", "recovered", "committed"])
  test("initial cutover handles failed canary safely: " + mode, async (t) => {
    const { initializeContent } = require("../ops/content-initial.cjs"),
      f = await contentReleaseFixture(t),
      site = join(f.dir, "site"),
      base = "RewriteEngine On\nRewriteRule ^kept$ /existing [L]\n";
    await mkdir(site);
    await mkdir(join(f.dir, "private"));
    await mkdir(join(f.dir, "content"));
    await writeFile(join(site, ".htaccess"), base);
    for (const name of ["runtime.env", "maintenance.env"])
      await writeFile(
        join(f.dir, "private", name),
        "BIBI_CONTENT_ROOT=" + join(f.dir, "content") + "\nBIBI_CONTENT_ASSET_ROOT=" + site + "\n",
        { mode: 0o600 },
      );
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
        contentRoutingBaseSha256: createHash("sha256").update(base).digest("hex"),
      },
      content = await require("../ops/content-metadata.cjs").createContentMetadata(f.dir, "cms"),
      candidate = { dir: f.dir, manifest: { content } },
      current = { manifest: { contentPublic: { readerVersion: 1, readModelVersion: 1 } } },
      generationId = randomUUID();
    let phase = "absent",
      backupVerified = false,
      prepared = false,
      committed = false;
    const run = async (_config, _dir, action) => {
      if (action === "content-initial-status")
        return {
          state: phase,
          activeGenerationId: ["activated", "committed"].includes(phase) ? generationId : null,
          committed,
          initialized: false,
        };
      if (action === "content-backup") {
        backupVerified = true;
        return {
          verified: true,
          profiles: true,
          content: true,
          bytes: 100,
          sha256: "a".repeat(64),
          contentManifestSha256: "b".repeat(64),
        };
      }
      if (action === "content-initial-prepare") {
        assert.equal(backupVerified, true);
        prepared = true;
        phase = "prepared";
        return { generationId, manifestSha256: "c".repeat(64) };
      }
      if (action === "content-initial-activate") {
        assert.equal(prepared, true);
        await writeFile(join(f.dir, "content/active"), generationId);
        phase = "activated";
        return { generationId };
      }
      if (action === "content-initial-verify") {
        assert.match(await readFile(join(site, ".htaccess"), "utf8"), /BIBI CONTENT BEGIN/);
        if (mode === "committed") {
          phase = "committed";
          committed = true;
        }
        throw Error("controlled public canary failed");
      }
      if (action === "content-initial-restore") {
        await unlink(join(f.dir, "content/active"));
        phase = "failed";
        return { restored: true, generationId };
      }
      throw Error("Unexpected fixed initial action " + action);
    };
    if (mode === "recovered") {
      await require("../ops/content-routing.cjs").installContentRouting({
        ...config,
        expectedRootSha256: config.contentRoutingBaseSha256,
      });
      phase = "activated";
      await writeFile(join(f.dir, "content/active"), generationId);
    }
    await assert.rejects(
      initializeContent(config, current, candidate, { run }),
      /canary|cutover|committed/i,
    );
    if (mode === "committed") {
      assert.match(await readFile(join(site, ".htaccess"), "utf8"), /BIBI CONTENT BEGIN/);
      assert.equal(await readFile(join(f.dir, "content/active"), "utf8"), generationId);
      return;
    }
    assert.equal(await readFile(join(site, ".htaccess"), "utf8"), base);
    await assert.rejects(lstat(join(f.dir, "content/active")), { code: "ENOENT" });
    await assert.rejects(lstat(join(f.dir, "private/content-routing.json")), { code: "ENOENT" });
    assert.equal(phase, "failed");
  });
