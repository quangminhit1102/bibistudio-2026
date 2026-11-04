import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { makeManifest, validateManifest } from "./release-manifest.mjs";
import { validateBundle } from "./build.mjs";
const require = createRequire(import.meta.url);

test("database manifests reject invalid ranges/checksums and preserve pre-auth compatibility", async (t) => {
  const {
    createDatabaseMetadata,
    checkDatabaseCompatibility,
  } = require("../ops/database-metadata.cjs");
  const database = await createDatabaseMetadata(join(process.cwd(), "backend"));
  assert.equal(
    makeManifest("a".repeat(40), null, database).schemaVersion,
    2,
    "Old receivers must refuse auth artifacts rather than skip DB preparation",
  );
  const manifest = makeManifest("a".repeat(40), null, database);
  assert.deepEqual(validateManifest(manifest).database, database);
  assert.equal(validateManifest(makeManifest("b".repeat(40))).database, undefined);
  const schema = { version: 4, state: "complete", migrationChecksums: database.migrationChecksums };
  assert.doesNotThrow(() => checkDatabaseCompatibility(manifest, schema));
  for (const patch of [
    { version: 5 },
    { version: 3 },
    { state: "dirty" },
    { migrationChecksums: {} },
  ])
    assert.throws(() => checkDatabaseCompatibility(manifest, { ...schema, ...patch }));
  for (const patch of [
    { requiredMin: 5 },
    { compatibleMax: 0 },
    { migrationChecksums: { "../outside.sql": "a".repeat(64) } },
    { catalogueChecksum: "not-a-checksum" },
  ])
    assert.throws(() => validateManifest({ ...manifest, database: { ...database, ...patch } }));
});

test("auth bundle requires exact migration/catalogue assets and rejects tampering", async (t) => {
  const { createDatabaseMetadata } = require("../ops/database-metadata.cjs");
  const dir = await mkdtemp(join(tmpdir(), "bibi-auth-release-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "frontend/assets"), { recursive: true });
  await mkdir(join(dir, "backend/dist"), { recursive: true });
  const database = await createDatabaseMetadata(join(process.cwd(), "backend"));
  const manifest = makeManifest("a".repeat(40), null, database);
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
  await writeFile(join(dir, "frontend/version.json"), JSON.stringify(makeManifest("a".repeat(40))));
  for (const name of [
    "frontend/index.html",
    "backend/dist/server.js",
    "backend/dist/runtime.js",
    "backend/package.json",
    "backend/package-lock.json",
  ])
    await writeFile(join(dir, name), "{}");
  await assert.rejects(validateBundle(dir), /database|migration|catalogue/i);
  await cp("backend/migrations", join(dir, "backend/migrations"), { recursive: true });
  await cp("backend/analytics-catalogue.json", join(dir, "backend/analytics-catalogue.json"));
  await validateBundle(dir);
  await writeFile(join(dir, "backend/migrations/001_identity.sql"), "tampered");
  await assert.rejects(validateBundle(dir), /checksum/i);
});
