import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import metadata from "../ops/content-metadata.cjs";
import lifecycle from "../ops/content-lifecycle.cjs";
import release from "../ops/release.cjs";
import database from "../ops/database-metadata.cjs";
import accessLogs from "../ops/access-log-metadata.cjs";
import profiles from "../ops/profile-metadata.cjs";
import visitors from "../ops/visitor-metadata.cjs";
import context from "../ops/visitor-context-metadata.cjs";
import controls from "../ops/visitor-controls-metadata.cjs";

test("manifest8 requires content and keeps prior manifest compatibility", async () => {
  const backend = resolve("backend");
  const parts = await Promise.all([
    database.createDatabaseMetadata(backend),
    accessLogs.createAccessLogMetadata(backend),
    profiles.createProfileMetadata(backend),
    visitors.createVisitorMetadata(backend),
    context.createVisitorContextMetadata(backend),
    controls.createVisitorControlsMetadata(backend),
    metadata.createContentMetadata(backend),
  ]);
  const manifest = release.makeManifest("a".repeat(40), "123", ...parts);
  assert.equal(manifest.schemaVersion, 8);
  assert.deepEqual(release.validateManifest(manifest), manifest);
  assert.throws(() => release.validateManifest({ ...manifest, content: undefined }));
  assert.throws(() => release.validateManifest({ ...manifest, schemaVersion: 7 }));
});

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "bibi-content-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "backend/content-migrations"), { recursive: true });
  await writeFile(
    join(dir, "backend/content-migrations/001_content.sql"),
    "CREATE TABLE sample (id INT);",
  );
  await writeFile(
    join(dir, "backend/content-migrations/002_content_v9.sql"),
    "ALTER TABLE sample ADD COLUMN name VARCHAR(10) NULL;\nCREATE TABLE media (id VARCHAR(36) PRIMARY KEY) ENGINE=InnoDB;",
  );
  const content = await metadata.createContentMetadata(join(dir, "backend"));
  return { dir, manifest: { content } };
}
const backupReceipt = { verified: true, profiles: true, sha256: "a".repeat(64), bytes: 100 };

test("previous one-file content release remains inspectable with exact checksums", async (t) => {
  const f = await fixture(t);
  await rm(join(f.dir, "backend/content-migrations/002_content_v9.sql"));
  const old = await metadata.createContentMetadata(join(f.dir, "backend"));
  assert.deepEqual(Object.keys(old.migrationChecksums), ["001_content.sql"]);
  await metadata.verifyContentAssets(join(f.dir, "backend"), old);
  assert.throws(() =>
    metadata.validateContentMetadata({
      ...old,
      migrationChecksums: { "002_content_v9.sql": "a".repeat(64) },
    }),
  );
  assert.throws(() =>
    metadata.validateContentMetadata({
      ...old,
      migrationChecksums: { ...old.migrationChecksums, "003_unknown.sql": "a".repeat(64) },
    }),
  );
  await assert.rejects(metadata.verifyContentAssets(join(f.dir, "backend"), f.manifest.content));
});

test("content metadata accepts the third migration only as 003_content_catalogue.sql", async (t) => {
  const f = await fixture(t);
  const two = f.manifest.content;
  const withThird = (name, base = two.migrationChecksums) => ({
    ...two,
    migrationChecksums: { ...base, [name]: "a".repeat(64) },
  });
  assert.deepEqual(
    Object.keys(
      metadata.validateContentMetadata(withThird("003_content_catalogue.sql")).migrationChecksums,
    ),
    ["001_content.sql", "002_content_v9.sql", "003_content_catalogue.sql"],
  );
  assert.throws(() => metadata.validateContentMetadata(withThird("003_other.sql")));
  assert.throws(() =>
    metadata.validateContentMetadata(
      withThird("003_content_catalogue.sql", {
        "001_content.sql": two.migrationChecksums["001_content.sql"],
      }),
    ),
  );
  await writeFile(join(f.dir, "backend/content-migrations/003_content_catalogue.sql"), "SELECT 1;");
  const three = await metadata.createContentMetadata(join(f.dir, "backend"));
  assert.equal(Object.keys(three.migrationChecksums).length, 3);
  await metadata.verifyContentAssets(join(f.dir, "backend"), three);
  await assert.rejects(metadata.verifyContentAssets(join(f.dir, "backend"), two));
});

test("content metadata accepts four migrations but rejects a gap or a wrong fourth name", async (t) => {
  const f = await fixture(t);
  const three = {
    ...f.manifest.content,
    migrationChecksums: {
      ...f.manifest.content.migrationChecksums,
      "003_content_catalogue.sql": "a".repeat(64),
    },
  };
  const four = {
    ...three,
    migrationChecksums: {
      ...three.migrationChecksums,
      "004_customers_inventory.sql": "b".repeat(64),
    },
  };
  assert.deepEqual(metadata.validateContentMetadata(four), four);
  for (const migrationChecksums of [
    { ...three.migrationChecksums, "004_wrong.sql": "b".repeat(64) },
    { ...f.manifest.content.migrationChecksums, "004_customers_inventory.sql": "b".repeat(64) },
  ]) assert.throws(() => metadata.validateContentMetadata({ ...four, migrationChecksums }));
  await writeFile(join(f.dir, "backend/content-migrations/003_content_catalogue.sql"), "SELECT 1;");
  await writeFile(join(f.dir, "backend/content-migrations/004_customers_inventory.sql"), "SELECT 2;");
  const actual = await metadata.createContentMetadata(join(f.dir, "backend"));
  assert.equal(Object.keys(actual.migrationChecksums).length, 4);
  await metadata.verifyContentAssets(join(f.dir, "backend"), actual);
  await assert.rejects(metadata.verifyContentAssets(join(f.dir, "backend"), three));
});

test("content metadata pins assets and rejects altered SQL", async (t) => {
  const f = await fixture(t);
  await metadata.verifyContentAssets(join(f.dir, "backend"), f.manifest.content);
  await writeFile(join(f.dir, "backend/content-migrations/001_content.sql"), "changed");
  await assert.rejects(metadata.verifyContentAssets(join(f.dir, "backend"), f.manifest.content));
});

test("content prepare requires backup, migrates, seeds and verifies before activation", async (t) => {
  const f = await fixture(t),
    calls = [];
  let complete = false;
  const run = async (_c, _d, action) => {
    calls.push(action);
    if (action === "content-migrate") complete = true;
    if (action === "content-seed") return { ok: true, inserted: 1 };
    return {
      version: complete ? 8 : 0,
      state: complete ? "complete" : "empty",
      migrationChecksums: complete ? f.manifest.content.migrationChecksums : {},
    };
  };
  await assert.rejects(lifecycle.prepareContent({}, null, f, { run }));
  assert.equal(calls.length, 0);
  await lifecycle.prepareContent({}, null, f, { run, backupReceipt });
  assert.deepEqual(calls, ["content-status", "content-migrate", "content-status", "content-seed"]);
});

test("rollback verifies content with current tool without re-seeding", async (t) => {
  const f = await fixture(t),
    calls = [];
  await lifecycle.prepareContent(
    {},
    f,
    { manifest: {}, dir: "old" },
    {
      backupReceipt,
      run: async (_c, dir, action) => {
        assert.equal(dir, f.dir);
        calls.push(action);
        return {
          version: 8,
          state: "complete",
          migrationChecksums: f.manifest.content.migrationChecksums,
        };
      },
    },
  );
  assert.deepEqual(calls, ["content-status"]);
});
