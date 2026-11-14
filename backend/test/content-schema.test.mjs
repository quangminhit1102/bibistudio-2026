import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { createContentFixture } from "./helpers/content.mjs";
import { migrateContent, contentSchemaStatus } from "../dist/content/schema.js";
const directory = resolve("backend/content-migrations");

test("content DDL is additive, idempotent and preserves existing feature ledgers", async (t) => {
  const f = await createContentFixture(t, { migrate: false }),
    tables = [
      "schema_migrations",
      "profile_schema_migrations",
      "visitor_history_schema_migrations",
      "visitor_context_schema_migrations",
    ];
  const before = await Promise.all(
    tables.map(async (table) => (await f.pool.query(`SELECT * FROM ${table} ORDER BY version`))[0]),
  );
  const all = (await f.pool.query("SHOW TABLES"))[0];
  assert.equal((await contentSchemaStatus(f.pool, directory)).state, "empty");
  assert.deepEqual((await f.pool.query("SHOW TABLES"))[0], all);
  await migrateContent(f.pool, directory);
  await migrateContent(f.pool, directory);
  const status = await contentSchemaStatus(f.pool, directory);
  assert.equal(status.version, 1);
  assert.equal(status.state, "complete");
  assert.equal((await f.pool.query("SELECT * FROM content_schema_migrations"))[0].length, 1);
  for (let n = 0; n < tables.length; n++)
    assert.deepEqual(
      (await f.pool.query(`SELECT * FROM ${tables[n]} ORDER BY version`))[0],
      before[n],
    );
  const [engines] = await f.pool.query(
    "SELECT ENGINE FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE 'content\\_%'",
  );
  assert.ok(engines.length >= 15);
  assert.ok(engines.every((row) => row.ENGINE === "InnoDB"));
});

test("content checksum or schema drift never silently migrates over existing data", async (t) => {
  const f = await createContentFixture(t),
    changed = await mkdtemp(join(tmpdir(), "bibi-content-sql-"));
  t.after(async () => {
    assert.equal(dirname(resolve(changed)), resolve(tmpdir()));
    await rm(changed, { recursive: true, force: true });
  });
  await writeFile(
    join(changed, "001_content.sql"),
    (await readFile(join(directory, "001_content.sql"), "utf8")) + "\n",
  );
  assert.equal((await contentSchemaStatus(f.pool, changed)).state, "dirty");
  await assert.rejects(migrateContent(f.pool, changed), /checksum/i);
  await f.pool.query("ALTER TABLE content_posts ADD COLUMN unexpected INT NULL");
  assert.equal((await contentSchemaStatus(f.pool, directory)).state, "dirty");
  await assert.rejects(migrateContent(f.pool, directory), /drift|dirty/i);
});
