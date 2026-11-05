import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { gunzipSync } from "node:zlib";
import mysql from "mysql2/promise";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";
import { readSchemaStatus } from "../dist/db/status.js";
import { migrateAccessLogs, readAccessLogSchema } from "../dist/access-logs/schema.js";
const directory = fileURLToPath(new URL("../access-log-migrations", import.meta.url));

test("feature migration is separate, checksummed and idempotent on actual MariaDB", async (t) => {
  const f = await createDatabaseFixture(t);
  assert.equal((await readAccessLogSchema(f.pool, directory)).state, "empty");
  await migrateAccessLogs(f.pool, directory);
  await migrateAccessLogs(f.pool, directory);
  const status = await readAccessLogSchema(f.pool, directory);
  assert.equal(status.state, "complete");
  assert.equal(status.version, 1);
  assert.equal(Object.keys(status.checksums).length, 1);
  const [tables] = await f.pool.query("SHOW TABLES");
  assert.equal(tables.length, 4);
  assert.ok(tables.every((x) => Object.values(x)[0].startsWith("access_log_")));
});
test("dirty, changed and unknown feature history refuse all new DDL", async (t) => {
  const f = await createDatabaseFixture(t);
  await migrateAccessLogs(f.pool, directory);
  await f.pool.query("UPDATE access_log_migrations SET state='dirty'");
  await assert.rejects(migrateAccessLogs(f.pool, directory), /dirty/i);
  assert.equal((await readAccessLogSchema(f.pool, directory)).state, "dirty");
  await f.pool.query("UPDATE access_log_migrations SET state='complete',checksum=REPEAT('a',64)");
  await assert.rejects(migrateAccessLogs(f.pool, directory), /checksum/i);
  await f.pool.query("UPDATE access_log_migrations SET version=9");
  await assert.rejects(migrateAccessLogs(f.pool, directory), /unknown/i);
  const [tables] = await f.pool.query("SHOW TABLES");
  assert.equal(tables.length, 4);
});
test("untracked feature tables and DDL drift are not silently adopted", async (t) => {
  const f = await createDatabaseFixture(t);
  await f.pool.query("CREATE TABLE access_log_records (id INT)");
  await assert.rejects(migrateAccessLogs(f.pool, directory), /untracked/i);
  const [tables] = await f.pool.query("SHOW TABLES");
  assert.equal(tables.length, 1);
  await f.pool.query("DROP TABLE access_log_records");
  await migrateAccessLogs(f.pool, directory);
  await f.pool.query("ALTER TABLE access_log_records ADD unexpected_column INT");
  assert.equal((await readAccessLogSchema(f.pool, directory)).state, "dirty");
  await assert.rejects(migrateAccessLogs(f.pool, directory), /DDL|dirty/i);
});
test("changed packaged asset is detected before modification", async (t) => {
  const f = await createDatabaseFixture(t);
  await migrateAccessLogs(f.pool, directory);
  const copy = await mkdtemp(join(tmpdir(), "bibi-access-schema-"));
  t.after(() => rm(copy, { recursive: true }));
  await writeFile(
    join(copy, "001_access_logs.sql"),
    (await readFile(join(directory, "001_access_logs.sql"), "utf8")) + "\n ",
  );
  await assert.rejects(migrateAccessLogs(f.pool, copy), /checksum/i);
});
test("actual pre-log e725 factory keeps auth readiness with additive log tables", async (t) => {
  const f = await createAuthFixture(t);
  await migrateAccessLogs(f.pool, directory);
  assert.equal(
    (await readSchemaStatus(f.pool, fileURLToPath(new URL("../migrations", import.meta.url))))
      .version,
    4,
  );
  const fixture = gunzipSync(
    await readFile(new URL("./fixtures/pre-log-app.cjs.gz", import.meta.url)),
  ).toString("utf8");
  const receipt = JSON.parse(
    await readFile(new URL("./fixtures/pre-log-app.json", import.meta.url), "utf8"),
  );
  assert.equal(createHash("sha256").update(fixture).digest("hex"), receipt.compiledSha256);
  assert.equal(receipt.sourceSha, "e7257b4962d1afd7689234c70cb65fb176e828d3");
  const baseline = { exports: {} };
  vm.runInNewContext(fixture, {
    require: createRequire(new URL("../dist/app.js", import.meta.url)),
    module: baseline,
    exports: baseline.exports,
    process: { env: { NODE_ENV: "production" } },
  });
  const handler = baseline.exports.createApp(
    { releaseId: "baseline-auth", sourceSha: receipt.sourceSha },
    { db: f.pool, config: f.config, clock: f.clock },
  );
  const base = await serve(t, handler);
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  assert.equal((await fetch(base + "/api/accounts")).status, 401);
});
test("runtime DML-only account reads feature status and writes records but cannot create tables", async (t) => {
  const f = await createDatabaseFixture(t);
  await migrateAccessLogs(f.pool, directory);
  const user = f.config.database.replace("bibi_test_", "al_");
  const password = "Only-access-log-fixture!99";
  await f.pool.query("CREATE USER ?@'%' IDENTIFIED BY ?", [user, password]);
  t.after(async () => {
    const admin = await mysql.createConnection({ ...f.config, database: undefined });
    try {
      await admin.query("DROP USER ?@'%'", [user]);
    } finally {
      await admin.end();
    }
  });
  await f.pool.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON \`${f.config.database}\`.* TO ?@'%'`, [
    user,
  ]);
  const runtime = mysql.createPool({
    ...f.config,
    user,
    password,
    timezone: "Z",
    dateStrings: true,
    connectionLimit: 1,
  });
  t.after(() => runtime.end());
  assert.equal((await readAccessLogSchema(runtime, directory)).state, "complete");
  await runtime.execute(
    "INSERT INTO access_log_sources(id,basename,transport,prefix_sha256) VALUES ('fixture','fixture.gz','http',REPEAT('a',64))",
  );
  await assert.rejects(runtime.query("CREATE TABLE runtime_must_not_create(id INT)"), /denied/i);
});
