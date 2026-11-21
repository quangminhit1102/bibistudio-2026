import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import metadata from "../ops/visitor-controls-metadata.cjs";
import lifecycle from "../ops/visitor-controls-lifecycle.cjs";
import release from "../ops/release.cjs";
import database from "../ops/database-metadata.cjs";
import accessLogs from "../ops/access-log-metadata.cjs";
import profiles from "../ops/profile-metadata.cjs";
import visitors from "../ops/visitor-metadata.cjs";
import context from "../ops/visitor-context-metadata.cjs";
import { resolve } from "node:path";

test("manifest7 requires controls and keeps prior manifest compatibility", async () => {
  const backend = resolve("backend");
  const parts = await Promise.all([
    database.createDatabaseMetadata(backend),
    accessLogs.createAccessLogMetadata(backend),
    profiles.createProfileMetadata(backend),
    visitors.createVisitorMetadata(backend),
    context.createVisitorContextMetadata(backend),
    metadata.createVisitorControlsMetadata(backend),
  ]);
  const manifest = release.makeManifest("a".repeat(40), "123", ...parts);
  assert.equal(manifest.schemaVersion, 7);
  assert.deepEqual(release.validateManifest(manifest), manifest);
  assert.throws(() => release.validateManifest({ ...manifest, visitorControls: undefined }));
  assert.throws(() => release.validateManifest({ ...manifest, visitorContext: undefined }));
  assert.throws(() => release.validateManifest({ ...manifest, schemaVersion: 6 }));
});

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "bibi-controls-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "backend/visitor-controls-migrations"), { recursive: true });
  await writeFile(
    join(dir, "backend/visitor-controls-migrations/001_controls.sql"),
    "CREATE TABLE sample (id INT);",
  );
  const visitorControls = await metadata.createVisitorControlsMetadata(join(dir, "backend"));
  return { dir, manifest: { visitorControls } };
}
const backupReceipt = { verified: true, profiles: true, sha256: "a".repeat(64), bytes: 100 };
test("controls metadata pins assets and rejects altered SQL", async (t) => {
  const f = await fixture(t);
  await metadata.verifyVisitorControlsAssets(join(f.dir, "backend"), f.manifest.visitorControls);
  await writeFile(join(f.dir, "backend/visitor-controls-migrations/001_controls.sql"), "changed");
  await assert.rejects(
    metadata.verifyVisitorControlsAssets(join(f.dir, "backend"), f.manifest.visitorControls),
  );
});
test("controls prepare requires backup, migrates and verifies before activation", async (t) => {
  const f = await fixture(t),
    calls = [];
  let complete = false;
  const run = async (_c, _d, action) => {
    calls.push(action);
    if (action === "controls-migrate") complete = true;
    return {
      version: complete ? 1 : 0,
      state: complete ? "complete" : "empty",
      migrationChecksums: complete ? f.manifest.visitorControls.migrationChecksums : {},
    };
  };
  await assert.rejects(lifecycle.prepareVisitorControls({}, null, f, { run }));
  assert.equal(calls.length, 0);
  await lifecycle.prepareVisitorControls({}, null, f, { run, backupReceipt });
  assert.deepEqual(calls, ["controls-status", "controls-migrate", "controls-status"]);
});
test("rollback verifies controls with current tool without dropping settings", async (t) => {
  const f = await fixture(t),
    calls = [];
  await lifecycle.prepareVisitorControls(
    {},
    f,
    { manifest: {}, dir: "old" },
    {
      backupReceipt,
      run: async (_c, dir, action) => {
        assert.equal(dir, f.dir);
        calls.push(action);
        return {
          version: 1,
          state: "complete",
          migrationChecksums: f.manifest.visitorControls.migrationChecksums,
        };
      },
    },
  );
  assert.deepEqual(calls, ["controls-status"]);
});
