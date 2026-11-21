import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { createAuthFixture } from "./helpers/auth.mjs";

const directory = resolve("backend/content-migrations");

test("content schema reports empty before migration and complete after migrateContent", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const { contentSchemaStatus, migrateContent, assertContentReady } =
    await import("../dist/content/schema.js");
  const empty = await contentSchemaStatus(f.pool, directory);
  assert.equal(empty.state, "empty");
  assert.equal(empty.version, 8);
  assert.deepEqual(empty.migrationChecksums, {});
  await assert.rejects(assertContentReady(f.pool), { status: 503, code: "CONTENT_NOT_READY" });
  await migrateContent(f.pool, directory);
  await migrateContent(f.pool, directory);
  const complete = await contentSchemaStatus(f.pool, directory);
  assert.equal(complete.state, "complete");
  assert.equal(complete.version, 8);
  assert.match(complete.migrationChecksums["001_content.sql"], /^[a-f0-9]{64}$/);
  await assert.doesNotReject(assertContentReady(f.pool));
});

test("content schema reports dirty when only some tables exist", async (t) => {
  const f = await createDatabaseFixture(t);
  const { contentSchemaStatus } = await import("../dist/content/schema.js");
  await f.pool.query(
    "CREATE TABLE customers (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, kind VARCHAR(16) NOT NULL) ENGINE=InnoDB",
  );
  const status = await contentSchemaStatus(f.pool, directory);
  assert.equal(status.state, "dirty");
  assert.equal(status.version, 8);
});
