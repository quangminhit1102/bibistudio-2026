import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
test("database preparation verifies assets, backup/restore, migration, seed and status in order", async (t) => {
  const { prepareDatabase, assertRollbackCompatible } = require("../ops/database-lifecycle.cjs");
  const { createDatabaseMetadata } = require("../ops/database-metadata.cjs");
  const root = await mkdtemp(join(tmpdir(), "bibi-db-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, "release");
  await cp("backend/migrations", join(dir, "backend/migrations"), { recursive: true });
  await cp("backend/analytics-catalogue.json", join(dir, "backend/analytics-catalogue.json"));
  const database = await createDatabaseMetadata(join(dir, "backend"));
  const release = { dir, manifest: { releaseId: "a".repeat(40) + "-123", database } };
  const config = { root, runtimeBin: "/opt/alt/alt-nodejs24/root/usr/bin" };
  const complete = {
    version: 4,
    state: "complete",
    ready: true,
    migrationChecksums: database.migrationChecksums,
  };
  const calls = [];
  const run = async (_config, _dir, command) => {
    calls.push(command);
    if (command === "backup")
      return { verified: true, sha256: "a".repeat(64), bytes: 1234, tableCount: 0 };
    if (command === "status")
      return calls.includes("migrate") ? complete : { version: 0, state: "empty", ready: false };
    return { ok: true };
  };
  const receipt = await prepareDatabase(config, release, { run });
  assert.equal(receipt.verified, true);
  assert.deepEqual(calls, ["status", "backup", "migrate", "seed", "status"]);
  calls.length = 0;
  await assert.rejects(
    prepareDatabase(config, release, { run: async () => ({ state: "dirty", version: 4 }) }),
    /dirty/i,
  );
  await assert.rejects(
    prepareDatabase(config, release, {
      run: async (_c, _d, command) => (command === "status" ? complete : { verified: false }),
    }),
    /backup/i,
  );
  assert.doesNotThrow(() => assertRollbackCompatible(release.manifest, complete));
  assert.throws(() => assertRollbackCompatible(release.manifest, { ...complete, version: 5 }));
  assert.throws(() => assertRollbackCompatible({}, complete), /degraded/i);
  assert.deepEqual(assertRollbackCompatible({}, complete, { allowPreAuth: true }), {
    degradedAdmin: true,
  });
  await writeFile(join(dir, "backend/migrations/001_identity.sql"), "tampered");
  await assert.rejects(prepareDatabase(config, release, { run }), /checksum/i);
  assert.equal(calls.length, 0, "tampered SQL must never reach database tools");
});
