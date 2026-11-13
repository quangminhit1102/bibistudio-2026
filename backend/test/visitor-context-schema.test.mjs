import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createVisitorFixture } from "./helpers/visitors.mjs";
import {
  migrateVisitorContext,
  visitorContextSchemaStatus,
} from "../dist/visitors/context-schema.js";
const directory = resolve("backend/visitor-context-migrations");
test("context DDL is additive, idempotent, read-only status and independent ledgers", async (t) => {
  const f = await createVisitorFixture(t);
  await f.collect(f.batch, f.cookie);
  const auth = (await f.pool.query("SELECT * FROM schema_migrations ORDER BY version"))[0],
    history = (await f.pool.query("SELECT * FROM visitor_history_schema_migrations"))[0];
  const before = (await f.pool.query("SHOW TABLES"))[0];
  assert.equal((await visitorContextSchemaStatus(f.pool, directory)).state, "empty");
  assert.deepEqual((await f.pool.query("SHOW TABLES"))[0], before);
  await migrateVisitorContext(f.pool, directory);
  await migrateVisitorContext(f.pool, directory);
  assert.equal((await visitorContextSchemaStatus(f.pool, directory)).state, "complete");
  assert.deepEqual(
    (await f.pool.query("SELECT * FROM schema_migrations ORDER BY version"))[0],
    auth,
  );
  assert.deepEqual(
    (await f.pool.query("SELECT * FROM visitor_history_schema_migrations"))[0],
    history,
  );
  const [[session]] = await f.pool.query("SELECT * FROM visitor_sessions");
  assert.equal(session.ip_source, null);
  assert.equal(session.country_code, null);
  assert.equal(session.page_count, 1);
  const [tables] = await f.pool.query(
    "SELECT ENGINE FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('analytics_relay_receipts','visitor_context_schema_migrations')",
  );
  assert.equal(tables.length, 2);
  assert.ok(tables.every((r) => r.ENGINE === "InnoDB"));
  await f.pool.query("ALTER TABLE visitor_sessions MODIFY country_code VARCHAR(3) NULL");
  assert.equal((await visitorContextSchemaStatus(f.pool, directory)).state, "dirty");
  await assert.rejects(migrateVisitorContext(f.pool, directory), /drift/i);
});
test("partial context DDL resumes explicitly and rejects checksum/receipt drift", async (t) => {
  const f = await createVisitorFixture(t);
  const get = f.pool.getConnection.bind(f.pool);
  let fail = true;
  f.pool.getConnection = async () => {
    const c = await get(),
      query = c.query.bind(c);
    c.query = async (sql, ...args) => {
      if (fail && sql.startsWith("ALTER TABLE visitor_sessions ADD COLUMN country_code")) {
        fail = false;
        throw new Error("controlled outage");
      }
      return query(sql, ...args);
    };
    return c;
  };
  await assert.rejects(migrateVisitorContext(f.pool, directory), /controlled/);
  assert.equal((await visitorContextSchemaStatus(f.pool, directory)).state, "dirty");
  await assert.rejects(migrateVisitorContext(f.pool, directory), /Dirty/);
  await migrateVisitorContext(f.pool, directory, { resumeDirty: true });
  assert.equal((await visitorContextSchemaStatus(f.pool, directory)).state, "complete");
  const changed = await mkdtemp(resolve(tmpdir(), "bibi-context-sql-"));
  t.after(() => rm(changed, { recursive: true, force: true }));
  await writeFile(
    resolve(changed, "001_context.sql"),
    (await readFile(resolve(directory, "001_context.sql"), "utf8")) + "\n",
  );
  assert.equal((await visitorContextSchemaStatus(f.pool, changed)).state, "incompatible");
  await assert.rejects(migrateVisitorContext(f.pool, changed), /checksum/i);
  await f.pool.query("ALTER TABLE analytics_relay_receipts DROP INDEX expires_at");
  assert.equal((await visitorContextSchemaStatus(f.pool, directory)).state, "dirty");
});
