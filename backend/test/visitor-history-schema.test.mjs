import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createAuthFixture } from "./helpers/auth.mjs";
import { migrateVisitorHistory, visitorHistorySchemaStatus } from "../dist/visitors/schema.js";
const directory = resolve("backend/visitor-migrations");
test("visitor metadata migration is additive, idempotent and independent of auth schema4", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  await f.pool.query(
    "INSERT INTO visitors(id,identity_hash,ip_prefix,device_type,operating_system,browser,first_seen_at,last_seen_at) VALUES('visitor',?,'127.0.0.0/24','desktop','Windows','Edge','2020-01-01','2020-01-01')",
    ["a".repeat(64)],
  );
  await f.pool.query(
    "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path) VALUES('session','visitor','2020-01-01','2020-01-01','/','/')",
  );
  assert.equal((await visitorHistorySchemaStatus(f.pool, directory)).state, "empty");
  await migrateVisitorHistory(f.pool, directory);
  await migrateVisitorHistory(f.pool, directory);
  assert.equal((await visitorHistorySchemaStatus(f.pool, directory)).state, "complete");
  const [[row]] = await f.pool.query("SELECT * FROM visitor_sessions WHERE id='session'");
  assert.equal(row.client_ip, null);
  assert.equal(row.ip_status, "legacy");
  assert.equal(row.device_type, null);
  assert.equal(row.landing_path, "/");
  const [[count]] = await f.pool.query("SELECT COUNT(*) n FROM schema_migrations");
  assert.equal(count.n, 4);
  await f.pool.query("ALTER TABLE visitor_sessions MODIFY client_ip VARCHAR(50) NULL");
  assert.equal((await visitorHistorySchemaStatus(f.pool, directory)).state, "dirty");
  await assert.rejects(migrateVisitorHistory(f.pool, directory), /drift/i);
});
test("interrupted visitor DDL resumes explicitly and rejects changed assets", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const get = f.pool.getConnection.bind(f.pool);
  let fail = true;
  f.pool.getConnection = async () => {
    const c = await get(),
      query = c.query.bind(c);
    c.query = async (sql, ...args) => {
      if (
        fail &&
        typeof sql === "string" &&
        sql.startsWith("ALTER TABLE visitor_sessions ADD COLUMN ip_status")
      ) {
        fail = false;
        throw new Error("controlled outage");
      }
      return query(sql, ...args);
    };
    return c;
  };
  await assert.rejects(migrateVisitorHistory(f.pool, directory), /controlled/);
  assert.equal((await visitorHistorySchemaStatus(f.pool, directory)).state, "dirty");
  await assert.rejects(migrateVisitorHistory(f.pool, directory), /Dirty/);
  await migrateVisitorHistory(f.pool, directory, { resumeDirty: true });
  assert.equal((await visitorHistorySchemaStatus(f.pool, directory)).state, "complete");
  const changed = await mkdtemp(resolve(tmpdir(), "bibi-visitor-sql-"));
  t.after(() => rm(changed, { recursive: true, force: true }));
  await writeFile(
    resolve(changed, "001_history.sql"),
    (await readFile(resolve(directory, "001_history.sql"), "utf8")) + "\n",
  );
  assert.equal((await visitorHistorySchemaStatus(f.pool, changed)).state, "incompatible");
  await assert.rejects(migrateVisitorHistory(f.pool, changed), /checksum/i);
});
