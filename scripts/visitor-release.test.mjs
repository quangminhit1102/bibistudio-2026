import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { join } from "node:path";
import { mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const visitor = require("../ops/visitor-metadata.cjs");
const { makeManifest, validateManifest } = require("../ops/release.cjs");
test("manifest5 requires visitor schema metadata while accepting existing manifest4 unchanged", async () => {
  const backend = resolve("backend");
  const database = await require("../ops/database-metadata.cjs").createDatabaseMetadata(backend);
  const logs = await require("../ops/access-log-metadata.cjs").createAccessLogMetadata(backend);
  const profiles = await require("../ops/profile-metadata.cjs").createProfileMetadata(backend);
  const metadata = await visitor.createVisitorMetadata(backend);
  const old = makeManifest("a".repeat(40), "123", database, logs, profiles);
  const next = makeManifest("b".repeat(40), "124", database, logs, profiles, metadata);
  assert.equal(old.schemaVersion, 4);
  assert.equal(next.schemaVersion, 5);
  assert.deepEqual(validateManifest(old), old);
  assert.deepEqual(validateManifest(next), next);
  assert.throws(() => validateManifest({ ...next, visitorAnalytics: undefined }));
  assert.throws(() => validateManifest({ ...next, profiles: undefined }));
  await visitor.verifyVisitorAssets(backend, metadata);
  assert.throws(() =>
    visitor.checkVisitorCompatibility(metadata, {
      state: "dirty",
      version: 1,
      migrationChecksums: metadata.migrationChecksums,
    }),
  );
  visitor.checkVisitorCompatibility(metadata, {
    state: "complete",
    version: 1,
    migrationChecksums: metadata.migrationChecksums,
  });
  await assert.rejects(
    visitor.verifyVisitorAssets(backend, {
      ...metadata,
      migrationChecksums: { "001_history.sql": "f".repeat(64) },
    }),
  );
});

test("v5 preparation checks visitor state and migrates after backup without running the retired importer", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bibi-visitor-release-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of [
    "migrations",
    "profile-migrations",
    "access-log-migrations",
    "visitor-migrations",
    "dist/profile",
  ])
    await cp(join("backend", name), join(dir, "backend", name), { recursive: true });
  await cp("backend/analytics-catalogue.json", join(dir, "backend/analytics-catalogue.json"));
  const profile = require("../ops/profile-metadata.cjs");
  await writeFile(
    join(dir, "backend/profile-runtime.json"),
    JSON.stringify(await profile.createProfileRuntimeMetadata(join(dir, "backend"))),
  );
  const database = await require("../ops/database-metadata.cjs").createDatabaseMetadata(
    join(dir, "backend"),
  );
  const logs = await require("../ops/access-log-metadata.cjs").createAccessLogMetadata(
    join(dir, "backend"),
  );
  const profiles = await profile.createProfileMetadata(join(dir, "backend"));
  const metadata = await visitor.createVisitorMetadata(join(dir, "backend"));
  const manifest = makeManifest("a".repeat(40), "125", database, logs, profiles, metadata),
    release = { dir, manifest };
  const calls = [];
  let migrated = false;
  const run = async (_config, _dir, command) => {
    calls.push(command);
    if (command.startsWith("access-log-")) throw new Error("Retired importer must not run");
    if (command === "status")
      return { state: "complete", version: 4, migrationChecksums: database.migrationChecksums };
    if (command === "profile-status")
      return { state: "complete", version: 1, migrationChecksums: profiles.migrationChecksums };
    if (command === "visitor-migrate") migrated = true;
    if (command === "visitor-status")
      return {
        state: migrated ? "complete" : "empty",
        version: migrated ? 1 : 0,
        migrationChecksums: migrated ? metadata.migrationChecksums : {},
      };
    return { ok: true };
  };
  const { prepareDatabase } = require("../ops/database-lifecycle.cjs");
  const backup = { verified: true, profiles: true, sha256: "c".repeat(64), bytes: 100 };
  await prepareDatabase({ root: dir }, release, { run, backupReceipt: backup });
  assert.ok(calls.indexOf("visitor-status") < calls.indexOf("visitor-migrate"));
  assert.ok(calls.includes("profile-migrate"));
  assert.equal(
    calls.some((command) => command.startsWith("access-log-")),
    false,
  );
  await assert.rejects(
    prepareDatabase({ root: dir }, release, {
      run: async (...args) => (args[2] === "visitor-status" ? { state: "dirty" } : run(...args)),
      backupReceipt: backup,
    }),
    /dirty/i,
  );
  const { prepareVisitorLifecycle } = require("../ops/visitor-lifecycle.cjs");
  let retired = 0;
  await prepareVisitorLifecycle(
    { root: dir },
    release,
    { dir, manifest: { ...manifest, visitorAnalytics: undefined } },
    {
      run,
      backupReceipt: backup,
      retire: async () => {
        retired++;
        return { verified: true };
      },
    },
  );
  assert.equal(retired, 1, "old code rollback still enforces stable retention policy");
  await assert.rejects(prepareVisitorLifecycle({ root: dir }, null, release, { run }), /backup/i);
});
