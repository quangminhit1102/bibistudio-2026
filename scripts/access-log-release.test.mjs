import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, writeFile, readFile, rm, symlink } from "node:fs/promises";
import vm from "node:vm";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { makeManifest, validateManifest } from "./release-manifest.mjs";
import { validateBundle } from "./build.mjs";
const require = createRequire(import.meta.url);
test("manifest3 carries independently hashed log assets and retains1/2 compatibility", async (t) => {
  const logs = require("../ops/access-log-metadata.cjs"),
    db = require("../ops/database-metadata.cjs");
  const dir = await mkdtemp(join(tmpdir(), "bibi-log-release-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp("backend/access-log-migrations", join(dir, "access-log-migrations"), {
    recursive: true,
  });
  const metadata = await logs.createAccessLogMetadata(dir),
    database = await db.createDatabaseMetadata("backend");
  const m = makeManifest("a".repeat(40), "123", database, metadata);
  const baseline = { exports: {} };
  vm.runInNewContext(await readFile("backend/test/fixtures/pre-log-release.cjs.txt", "utf8"), {
    module: baseline,
    exports: baseline.exports,
    require: (name) => {
      assert.equal(name, "./database-metadata.cjs");
      return db;
    },
  });
  assert.throws(() => baseline.exports.validateManifest(m), /Invalid release manifest/);
  assert.equal(m.schemaVersion, 3);
  assert.equal(validateManifest(m).accessLogs.requiredMin, 1);
  assert.equal(validateManifest(makeManifest("a".repeat(40), "123", database)).schemaVersion, 2);
  assert.equal(validateManifest(makeManifest("a".repeat(40), "123")).schemaVersion, 1);
  for (const patch of [
    { schemaVersion: 2 },
    { accessLogs: null },
    { accessLogs: { ...metadata, compatibleMax: 0 } },
    { accessLogs: { ...metadata, migrationChecksums: { "../x.sql": "a".repeat(64) } } },
  ])
    assert.throws(() => validateManifest({ ...m, ...patch }));
  await logs.verifyAccessLogAssets(dir, metadata);
  await writeFile(join(dir, "access-log-migrations/001_access_logs.sql"), "changed");
  await assert.rejects(logs.verifyAccessLogAssets(dir, metadata), /checksum/i);
});
test("bundle3 requires compiled feature tools and rejects private files and symlink SQL", async (t) => {
  const logs = require("../ops/access-log-metadata.cjs"),
    db = require("../ops/database-metadata.cjs");
  const dir = await mkdtemp(join(tmpdir(), "bibi-log-bundle-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "frontend/assets"), { recursive: true });
  await mkdir(join(dir, "backend/dist/access-logs"), { recursive: true });
  for (const name of ["migrations", "access-log-migrations"])
    await cp("backend/" + name, join(dir, "backend", name), { recursive: true });
  await cp("backend/analytics-catalogue.json", join(dir, "backend/analytics-catalogue.json"));
  for (const name of [
    "frontend/index.html",
    "backend/dist/server.js",
    "backend/dist/runtime.js",
    "backend/package.json",
    "backend/package-lock.json",
  ])
    await writeFile(join(dir, name), "{}");
  const m = makeManifest(
    "a".repeat(40),
    "123",
    await db.createDatabaseMetadata(join(dir, "backend")),
    await logs.createAccessLogMetadata(join(dir, "backend")),
  );
  await writeFile(join(dir, "manifest.json"), JSON.stringify(m));
  await writeFile(
    join(dir, "frontend/version.json"),
    JSON.stringify(makeManifest("a".repeat(40), "123")),
  );
  await assert.rejects(validateBundle(dir));
  for (const name of ["cli.js", "probe-cli.js"])
    await writeFile(join(dir, "backend/dist/access-logs", name), "");
  await validateBundle(dir);
  await mkdir(join(dir, "backend/private"));
  await writeFile(join(dir, "backend/private/runtime.env"), "fixture-secret");
  await assert.rejects(validateBundle(dir), /Forbidden/);
  await rm(join(dir, "backend/private/runtime.env"));
  await rm(join(dir, "backend/private"), { recursive: true });
  await t.test(
    "symlink SQL rejected",
    { skip: process.platform === "win32" ? "Symlink privilege checked on Linux CI" : false },
    async () => {
      const sql = join(dir, "backend/access-log-migrations/001_access_logs.sql");
      await rm(sql);
      await symlink(resolve("backend/access-log-migrations/001_access_logs.sql"), sql);
      await assert.rejects(validateBundle(dir), /Invalid|Forbidden/);
    },
  );
});
test("feature preparation requires verified backup and complete bootstrap before activation; probes required", async (t) => {
  const { prepareDatabase, verifyReleaseProbe } = require("../ops/database-lifecycle.cjs");
  const db = require("../ops/database-metadata.cjs"),
    logs = require("../ops/access-log-metadata.cjs");
  const dir = await mkdtemp(join(tmpdir(), "bibi-log-lifecycle-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ["migrations", "access-log-migrations"])
    await cp("backend/" + name, join(dir, "backend", name), { recursive: true });
  await cp("backend/analytics-catalogue.json", join(dir, "backend/analytics-catalogue.json"));
  const database = await db.createDatabaseMetadata(join(dir, "backend")),
    accessLogs = await logs.createAccessLogMetadata(join(dir, "backend"));
  const manifest = makeManifest("a".repeat(40), "123", database, accessLogs),
    release = { dir, manifest },
    calls = [];
  const run = async (_c, _d, command) => {
    calls.push(command);
    if (command === "backup") return { verified: true, sha256: "a".repeat(64), bytes: 200 };
    if (command === "status")
      return { state: "complete", version: 4, migrationChecksums: database.migrationChecksums };
    if (command === "access-log-status")
      return { state: "complete", version: 1, checksums: accessLogs.migrationChecksums };
    if (command === "access-log-sync") return { state: "complete", inserted: 10 };
    if (command === "probe")
      return { ok: true, releaseId: manifest.releaseId, auth: true, rbac: true, analytics: true };
    if (command === "access-log-probe")
      return { ok: true, accessLogs: true, releaseId: manifest.releaseId };
    return { ok: true };
  };
  await prepareDatabase({ root: dir }, release, { run });
  assert.deepEqual(calls, [
    "status",
    "access-log-status",
    "backup",
    "migrate",
    "seed",
    "status",
    "access-log-migrate",
    "access-log-status",
    "access-log-sync",
  ]);
  await assert.rejects(
    prepareDatabase({ root: dir }, release, {
      run: async (...args) =>
        args[2] === "access-log-status" ? { state: "dirty", version: 1 } : run(...args),
    }),
    /dirty/i,
  );
  await assert.rejects(
    prepareDatabase({ root: dir }, release, {
      run: async (...args) => (args[2] === "access-log-sync" ? { state: "pending" } : run(...args)),
    }),
    /bootstrap|complete/i,
  );
  assert.equal((await verifyReleaseProbe({ root: dir }, release, { run })).accessLogs, true);
  await assert.rejects(
    verifyReleaseProbe({ root: dir }, release, {
      run: async (...args) => (args[2] === "access-log-probe" ? { ok: false } : run(...args)),
    }),
    /access.log/i,
  );
});
