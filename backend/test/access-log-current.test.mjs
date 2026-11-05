import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, appendFile, readFile, unlink, stat, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { archiveFixture, accessLogLine } from "./helpers/access-logs.mjs";
import { migrateAccessLogs } from "../dist/access-logs/schema.js";
import { captureCurrentLog, queuedCurrentSnapshots } from "../dist/access-logs/current-snapshot.js";
import { syncCurrentLogs } from "../dist/access-logs/current-cache.js";
import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { currentSnapshotWorkUsage } from "../dist/access-logs/current-snapshot.js";
import { workUsage } from "../dist/access-logs/snapshot.js";
async function fixture(t, limits = {}) {
  const f = await createDatabaseFixture(t),
    a = await archiveFixture(t, limits),
    currentDirectory = join(a.root, "current");
  await mkdir(currentDirectory);
  const config = { ...a.config, currentDirectory };
  const file = join(currentDirectory, config.domainAlias),
    ssl = file + "-ssl_log";
  await writeFile(file, "");
  await writeFile(ssl, "");
  await migrateAccessLogs(f.pool, resolve("backend/access-log-migrations"));
  const write = (lines) =>
    writeFile(ssl, Buffer.concat(lines.flatMap((line) => [Buffer.from(line), Buffer.from("\n")])));
  const sync = (signal = AbortSignal.timeout(120000), hooks = {}) =>
    syncCurrentLogs({ pool: f.pool, config, clock: f.clock, signal, ...hooks });
  const active = async () => {
    const [rows] = await f.pool.query(
      "SELECT r.* FROM access_log_current_records r JOIN access_log_current_sources s ON r.source_id=s.id AND r.snapshot_id=s.active_snapshot_id ORDER BY ordinal",
    );
    return rows;
  };
  return {
    ...f,
    ...a,
    config,
    file,
    ssl,
    write,
    sync,
    active,
    databaseConfig: f.config,
    archiveWrite: a.write,
  };
}
test("current snapshot freezes prefix during append, detects rewrites, ignores other domains and preserves private queued input", async (t) => {
  const f = await fixture(t);
  await f.write([accessLogLine()]);
  await writeFile(join(f.config.currentDirectory, "other.example"), "secret");
  const snapshot = await captureCurrentLog(f.config, "https", AbortSignal.timeout(120000), {
    onCopied: () => appendFile(f.ssl, accessLogLine()),
  });
  assert.equal((await readFile(snapshot.path)).length, accessLogLine().length + 1);
  assert.equal((await queuedCurrentSnapshots(f.config)).length, 1);
  if (process.platform !== "win32") assert.equal((await stat(snapshot.path)).mode & 0o777, 0o600);
  await assert.rejects(
    captureCurrentLog(f.config, "https", AbortSignal.timeout(120000), {
      onCopied: () => writeFile(f.ssl, "changed"),
    }),
    /SOURCE_CHANGED/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(captureCurrentLog(f.config, "http", controller.signal));
  await unlink(f.ssl);
  assert.equal((await queuedCurrentSnapshots(f.config)).length, 1);
});
test("one pooled connection runs archive and current under one job lock and global quota", async (t) => {
  const f = await fixture(t);
  await f.archiveWrite([accessLogLine()]);
  await f.write([accessLogLine()]);
  const { syncAccessLogs } = await import("../dist/access-logs/sync-service.js");
  const pool = mysql.createPool({
    ...f.databaseConfig,
    connectionLimit: 1,
    timezone: "Z",
    dateStrings: true,
  });
  t.after(() => pool.end());
  const receipt = await syncAccessLogs({
    pool,
    config: f.config,
    clock: f.clock,
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(receipt.state, "complete");
  assert.equal(receipt.inserted, 1);
  assert.equal(receipt.current.records, 1);
  const held = await f.pool.getConnection();
  await held.query("SELECT GET_LOCK(CONCAT('bibi-log-job:',LEFT(SHA2(DATABASE(),256),32)),0)");
  try {
    assert.equal(
      (
        await syncAccessLogs({
          pool,
          config: f.config,
          clock: f.clock,
          signal: AbortSignal.timeout(10000),
        })
      ).state,
      "pending",
    );
  } finally {
    await held.query("SELECT RELEASE_LOCK(CONCAT('bibi-log-job:',LEFT(SHA2(DATABASE(),256),32)))");
    held.release();
  }
});
test("real SQL cache keeps1205 physical rows including duplicates/errors, keeps IDs on unchanged source and replaces only cache", async (t) => {
  const f = await fixture(t, { batchRows: 500 });
  await f.write([
    ...Array.from({ length: 1204 }, () => accessLogLine()),
    Buffer.from("bad raw secret"),
  ]);
  assert.equal((await f.sync()).state, "complete");
  let rows = await f.active();
  assert.equal(rows.length, 1205);
  assert.equal(rows.filter((r) => r.parse_status === "error").length, 1);
  const first = rows.map((r) => r.id);
  assert.equal(new Set(first).size, 1205);
  assert.equal((await f.sync()).state, "complete");
  assert.deepEqual(
    (await f.active()).map((r) => r.id),
    first,
  );
  for (const secret of ["203.0.113.42", "token=secret", "bad raw secret", "Mozilla"])
    assert.ok(!JSON.stringify(rows).includes(secret));
  await f.pool.query(
    "INSERT INTO access_log_sources(id,basename,transport,prefix_sha256,state) VALUES(UUID(),'archive-Nov-2026.gz','https',REPEAT('0',64),'complete')",
  );
  await f.write([accessLogLine({ request: "GET /new HTTP/1.1" })]);
  assert.equal((await f.sync()).state, "complete");
  rows = await f.active();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pathname, "/new");
  const [[archive]] = await f.pool.query("SELECT COUNT(*) n FROM access_log_sources");
  assert.equal(archive.n, 1);
  const [[allCache]] = await f.pool.query("SELECT COUNT(*) n FROM access_log_current_records");
  assert.equal(allCache.n, 1);
});
test("interruption after staging retains old active snapshot; retry queued source after disappearance never publishes partial counts", async (t) => {
  const f = await fixture(t, { batchRows: 2 });
  await f.write([accessLogLine()]);
  await f.sync();
  const old = (await f.active()).map((r) => r.id);
  await f.write(
    Array.from({ length: 5 }, () => accessLogLine({ request: "GET /changed HTTP/1.1" })),
  );
  const controller = new AbortController();
  const interrupted = await f.sync(controller.signal, { onBatch: () => controller.abort() });
  assert.equal(interrupted.state, "pending");
  assert.deepEqual(
    (await f.active()).map((r) => r.id),
    old,
  );
  await unlink(f.ssl);
  const retried = await f.sync();
  assert.equal(retried.state, "error");
  assert.equal((await f.active()).length, 5);
  const [[source]] = await f.pool.query(
    "SELECT state,error_code,record_count FROM access_log_current_sources WHERE transport='https'",
  );
  assert.equal(source.state, "error");
  assert.equal(Number(source.record_count), 5);
  assert.ok(source.error_code);
});
test("current quota and unsafe symlink errors preserve previous good cache", async (t) => {
  const f = await fixture(t);
  await f.write([accessLogLine()]);
  await f.sync();
  const old = (await f.active()).map((r) => r.id);
  f.config.limits.compressedBytes = 10;
  assert.equal((await f.sync()).state, "error");
  assert.deepEqual(
    (await f.active()).map((r) => r.id),
    old,
  );
  if (process.platform !== "win32") {
    f.config.limits.compressedBytes = 64 * 1024 ** 2;
    await unlink(f.ssl);
    await symlink(f.file, f.ssl);
    assert.equal((await f.sync()).state, "error");
    assert.deepEqual(
      (await f.active()).map((r) => r.id),
      old,
    );
  }
});

test("combined archive/current quota never exceeds the shared private work budget", async (t) => {
  const f = await fixture(t, { workBytes: 16000 });
  await writeFile(f.ssl, Buffer.alloc(6000, 65));
  await captureCurrentLog(f.config, "https", AbortSignal.timeout(10000));
  await f.archiveWrite([randomBytes(10000)]);
  const { syncAccessLogs } = await import("../dist/access-logs/sync-service.js");
  const receipt = await syncAccessLogs({
    pool: f.pool,
    config: f.config,
    clock: f.clock,
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(receipt.state, "error");
  assert.ok((await currentSnapshotWorkUsage(f.config)) + (await workUsage(f.config)) <= 16000);
});
test("EOF tail stays visible as a safe marker, unknown private queue entries fail explicitly without deleting good cache", async (t) => {
  const f = await fixture(t);
  await writeFile(f.ssl, Buffer.concat([accessLogLine(), Buffer.from("\n\ntruncated secret")]));
  await f.sync();
  const rows = await f.active();
  assert.equal(rows.length, 2);
  assert.equal(rows[1].parse_status, "error");
  const unknown = join(f.config.workDirectory + "-current", "unowned");
  await writeFile(unknown, "keep");
  const receipt = await f.sync();
  assert.equal(receipt.state, "error");
  assert.equal(receipt.records, 2);
  assert.equal((await f.active()).length, 2);
  assert.equal(await readFile(unknown, "utf8"), "keep");
  const [[source]] = await f.pool.query(
    "SELECT state,error_code FROM access_log_current_sources WHERE transport='https'",
  );
  assert.equal(source.state, "error");
  assert.ok(source.error_code);
});

test("append between path stat and file open still snapshots the originally observed prefix", async (t) => {
  const f = await fixture(t);
  await f.write([accessLogLine()]);
  const snapshot = await captureCurrentLog(f.config, "https", AbortSignal.timeout(10000), {
    onLocated: () => appendFile(f.ssl, Buffer.concat([accessLogLine(), Buffer.from("\n")])),
  });
  assert.equal(snapshot.bytes, accessLogLine().length + 1);
  assert.equal((await readFile(snapshot.path)).length, snapshot.bytes);
});
