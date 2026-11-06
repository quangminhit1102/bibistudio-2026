import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, writeFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { makeManifest, validateManifest } = require("../ops/release.cjs");
test("profile manifest4 is strict and old manifests remain valid", async () => {
  const {
    createProfileMetadata,
    verifyProfileAssets,
    createProfileRuntimeMetadata,
  } = require("../ops/profile-metadata.cjs");
  const dir = await mkdtemp(join(tmpdir(), "bibi-profile-release-"));
  try {
    await mkdir(join(dir, "profile-migrations"));
    await cp(
      resolve("backend/profile-migrations/001_profiles.sql"),
      join(dir, "profile-migrations/001_profiles.sql"),
    );
    await mkdir(join(dir, "dist/profile"), { recursive: true });
    for (const name of [
      "cli.js",
      "backup-cli.js",
      "avatar-worker.js",
      "avatar-codec.js",
      "avatar-header.js",
      "avatar-store.js",
    ])
      await writeFile(join(dir, "dist/profile", name), "test");
    await writeFile(
      join(dir, "profile-runtime.json"),
      JSON.stringify(await createProfileRuntimeMetadata(dir)),
    );
    const metadata = await createProfileMetadata(dir);
    const database = require("../ops/database-metadata.cjs");
    const logs = require("../ops/access-log-metadata.cjs");
    const db = await database.createDatabaseMetadata(resolve("backend")),
      access = await logs.createAccessLogMetadata(resolve("backend"));
    const manifest = makeManifest("a".repeat(40), "123", db, access, metadata);
    assert.equal(manifest.schemaVersion, 4);
    assert.deepEqual(validateManifest(manifest), manifest);
    for (const old of [
      makeManifest("a".repeat(40)),
      makeManifest("a".repeat(40), null, db),
      makeManifest("a".repeat(40), null, db, access),
    ])
      assert.deepEqual(validateManifest(old), old);
    assert.throws(() => validateManifest({ ...manifest, profiles: undefined }));
    assert.throws(() => validateManifest({ ...manifest, schemaVersion: 3 }));
    await verifyProfileAssets(dir, metadata);
    await writeFile(join(dir, "dist/profile/avatar-worker.js"), "tampered worker");
    await assert.rejects(verifyProfileAssets(dir, metadata), /checksum/i);
    await writeFile(join(dir, "dist/profile/avatar-worker.js"), "test");

    await writeFile(join(dir, "profile-migrations/001_profiles.sql"), "tamper");
    await assert.rejects(verifyProfileAssets(dir, metadata), /checksum/i);
    await cp(
      resolve("backend/profile-migrations/001_profiles.sql"),
      join(dir, "profile-migrations/001_profiles.sql"),
    );
    await unlink(join(dir, "dist/profile/avatar-worker.js"));
    await assert.rejects(verifyProfileAssets(dir, metadata));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("old receiver rejects manifest4 instead of ignoring profile requirements", async () => {
  const { execFileSync } = await import("node:child_process");
  const { runInNewContext } = await import("node:vm");
  const code = execFileSync(
    "git",
    ["show", "e27102cd49575ec06215b0842dd90c732d70d0b0:ops/release.cjs"],
    { encoding: "utf8" },
  );
  const module = { exports: {} };
  const oldRequire = (id) => require("../ops/" + id.replace(/^\.\//, ""));
  runInNewContext(code, { module, exports: module.exports, require: oldRequire });
  assert.throws(
    () =>
      module.exports.validateManifest({
        schemaVersion: 4,
        sourceSha: "a".repeat(40),
        ciRunId: "1",
        releaseId: "a".repeat(40) + "-1",
      }),
    /manifest/i,
  );
});
