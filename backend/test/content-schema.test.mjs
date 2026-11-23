import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { createAuthFixture } from "./helpers/auth.mjs";

const directory = resolve("backend/content-migrations");
const digest = (text) => createHash("sha256").update(text).digest("hex");

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
  assert.match(complete.migrationChecksums["002_content_v9.sql"], /^[a-f0-9]{64}$/);
  await assert.doesNotReject(assertContentReady(f.pool));
  const [[media]] = await f.pool.query(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='media'",
  );
  assert.equal(media.n, 1);
  const [columns] = await f.pool.query(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='products' AND COLUMN_NAME IN ('name_en','description_en','featured','sort_order','image_alt_en')",
  );
  assert.deepEqual(
    new Set(columns.map((c) => c.COLUMN_NAME)),
    new Set(["name_en", "description_en", "featured", "sort_order", "image_alt_en"]),
  );
  const [postColumns] = await f.pool.query(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='posts' AND COLUMN_NAME IN ('read_time','cover_image_id')",
  );
  assert.deepEqual(
    new Set(postColumns.map((c) => c.COLUMN_NAME)),
    new Set(["read_time", "cover_image_id"]),
  );
});

test("content schema upgrades a v8 ledger to v9 without touching version 1", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const { contentSchemaStatus, migrateContent, assertContentReady } =
    await import("../dist/content/schema.js");
  const sql = await readFile(resolve(directory, "001_content.sql"), "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const tables = ["product_categories", "content_categories", "posts", "products", "customers"];
  const hashes = {};
  for (let i = 0; i < tables.length; i++) {
    await f.pool.query(statements[i]);
    const [[ddl]] = await f.pool.query(`SHOW CREATE TABLE \`${tables[i]}\``);
    hashes[tables[i]] = digest(String(ddl["Create Table"]));
  }
  await f.pool.query(
    "CREATE TABLE content_schema_migrations (version INT UNSIGNED PRIMARY KEY,checksum CHAR(64) NOT NULL,state VARCHAR(20) NOT NULL,completed_steps INT UNSIGNED NOT NULL DEFAULT 0,ddl_hashes JSON NOT NULL,applied_at DATETIME(3) NULL) ENGINE=InnoDB",
  );
  await f.pool.execute(
    "INSERT INTO content_schema_migrations(version,checksum,state,completed_steps,ddl_hashes) VALUES(1,?,'complete',?,?)",
    [digest(sql), 5, JSON.stringify(hashes)],
  );
  const before = await contentSchemaStatus(f.pool, directory);
  assert.equal(before.state, "dirty");
  assert.deepEqual(before.migrationChecksums, { "001_content.sql": digest(sql) });
  await assert.rejects(assertContentReady(f.pool), { status: 503, code: "CONTENT_NOT_READY" });

  await migrateContent(f.pool, directory);

  const [[v1]] = await f.pool.query(
    "SELECT version,state,completed_steps,checksum FROM content_schema_migrations WHERE version=1",
  );
  assert.equal(v1.state, "complete");
  assert.equal(v1.completed_steps, 5);
  assert.equal(v1.checksum, digest(sql));
  const [[v2]] = await f.pool.query(
    "SELECT version,state,completed_steps FROM content_schema_migrations WHERE version=2",
  );
  assert.equal(v2.state, "complete");
  assert.equal(v2.completed_steps, 3);

  const complete = await contentSchemaStatus(f.pool, directory);
  assert.equal(complete.state, "complete");
  assert.match(complete.migrationChecksums["001_content.sql"], /^[a-f0-9]{64}$/);
  assert.match(complete.migrationChecksums["002_content_v9.sql"], /^[a-f0-9]{64}$/);
  await assert.doesNotReject(assertContentReady(f.pool));
  const [[media]] = await f.pool.query(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='media'",
  );
  assert.equal(media.n, 1);
  const [columns] = await f.pool.query(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='products' AND COLUMN_NAME='featured'",
  );
  assert.equal(columns.length, 1);
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

async function migratedWithNewerRow(t, state) {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const schema = await import("../dist/content/schema.js");
  await schema.migrateContent(f.pool, directory);
  await f.pool.query(
    "INSERT INTO content_schema_migrations(version,checksum,state,completed_steps,ddl_hashes,applied_at) VALUES(3,REPEAT('a',64),?,1,'{}',UTC_TIMESTAMP(3))",
    [state],
  );
  await f.pool.query("ALTER TABLE products ADD COLUMN attributes JSON NULL");
  return { pool: f.pool, ...schema };
}

test("a newer complete schema version keeps the packaged release ready", async (t) => {
  const f = await migratedWithNewerRow(t, "complete");
  await assert.doesNotReject(f.assertContentReady(f.pool));
  const status = await f.contentSchemaStatus(f.pool, directory);
  assert.equal(status.state, "complete");
  assert.equal(status.version, 8);
  assert.deepEqual(Object.keys(status.migrationChecksums).sort(), [
    "001_content.sql",
    "002_content_v9.sql",
  ]);
  await assert.rejects(f.migrateContent(f.pool, directory), /newer/i);
});

test("a newer incomplete schema version is not ready", async (t) => {
  const f = await migratedWithNewerRow(t, "dirty");
  await assert.rejects(f.assertContentReady(f.pool), { status: 503, code: "CONTENT_NOT_READY" });
  assert.equal((await f.contentSchemaStatus(f.pool, directory)).state, "incompatible");
});

test("a newer complete version does not hide a dirty packaged version", async (t) => {
  const f = await migratedWithNewerRow(t, "complete");
  await f.pool.query("UPDATE content_schema_migrations SET state='dirty' WHERE version=2");
  await assert.rejects(f.assertContentReady(f.pool), { status: 503, code: "CONTENT_NOT_READY" });
  assert.equal((await f.contentSchemaStatus(f.pool, directory)).state, "dirty");
});
