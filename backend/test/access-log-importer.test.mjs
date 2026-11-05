import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, readFile, unlink, readdir } from "node:fs/promises";
import { gzipSync, constants } from "node:zlib";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { archiveFixture, accessLogLine as line } from "./helpers/access-logs.mjs";
import { migrateAccessLogs } from "../dist/access-logs/schema.js";
import { syncAccessLogArchives as sync } from "../dist/access-logs/importer.js";
const directory = fileURLToPath(new URL("../access-log-migrations", import.meta.url));
async function fixture(t, limits) {
  const db = await createDatabaseFixture(t),
    files = await archiveFixture(t, limits);
  await migrateAccessLogs(db.pool, directory);
  const run = (signal) =>
    sync({
      pool: db.pool,
      config: files.config,
      clock: db.clock,
      signal: signal ?? AbortSignal.timeout(15000),
    });
  const count = async () =>
    Number((await db.pool.query("SELECT COUNT(*) n FROM access_log_records"))[0][0].n);
  return { ...db, ...files, dbConfig: db.config, run, count };
}
test("append and recompression preserve identical physical lines, repeated import is no-op", async (t) => {
  const f = await fixture(t);
  const bytes = await f.write([line(), line()]);
  assert.equal((await f.run()).inserted, 2);
  assert.equal((await f.run()).inserted, 0);
  await writeFile(f.file, gzipSync(bytes, { level: constants.Z_BEST_COMPRESSION }));
  assert.equal((await f.run()).inserted, 0);
  await writeFile(
    f.file,
    Buffer.concat([await readFile(f.file), gzipSync(Buffer.concat([line(), Buffer.from("\n")]))]),
  );
  assert.equal((await f.run()).inserted, 1);
  assert.equal(await f.count(), 3);
  await unlink(f.file);
  assert.equal((await f.run()).inserted, 0);
  assert.equal(await f.count(), 3);
});
test("changed/truncated committed prefix is flagged rather than reset or deduplicated", async (t) => {
  const f = await fixture(t);
  await f.write([line(), line()]);
  await f.run();
  await f.write([line({ request: "GET /changed HTTP/1.1" }), line(), line()]);
  const result = await f.run();
  assert.equal(result.divergedSources, 1);
  assert.equal(result.state, "error");
  assert.equal(await f.count(), 2);
});
test("partial last line waits and resolves when a later stable snapshot appends its newline", async (t) => {
  const f = await fixture(t);
  await f.write([line(), line(), line()], "");
  const first = await f.run();
  assert.equal(first.inserted, 2);
  assert.equal(first.pendingSources, 1);
  assert.equal(await f.count(), 2);
  await f.write([line(), line(), line()]);
  const next = await f.run();
  assert.equal(next.inserted, 1);
  assert.equal(next.pendingSources, 0);
  assert.equal(await f.count(), 3);
});
test("abort immediately after commit resumes saved snapshot even when source disappears", async (t) => {
  const f = await fixture(t);
  await f.write([line(), line(), line(), line(), line()]);
  const controller = new AbortController(),
    get = f.pool.getConnection.bind(f.pool);
  let armed = true;
  f.pool.getConnection = async () => {
    const connection = await get();
    return new Proxy(connection, {
      get(target, key) {
        if (key === "commit")
          return async () => {
            await target.commit();
            if (armed) {
              armed = false;
              controller.abort();
            }
          };
        const value = target[key];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
  const interrupted = await f.run(controller.signal);
  assert.equal(interrupted.state, "pending");
  assert.equal(await f.count(), 2);
  await unlink(f.file);
  const resumed = await f.run();
  assert.equal(resumed.inserted, 3);
  assert.equal(await f.count(), 5);
  assert.equal((await f.run()).inserted, 0);
});
test("corrupt gzip and expansion limit write no records", async (t) => {
  const f = await fixture(t, { expandedBytes: 1000 });
  const content = await f.write(Array.from({ length: 20 }, () => line()));
  assert.ok(content.length > 1000);
  assert.equal((await f.run()).state, "error");
  assert.equal(await f.count(), 0);
  const bytes = gzipSync(Buffer.concat([line(), Buffer.from("\n")]));
  await writeFile(f.file, bytes.subarray(0, bytes.length - 5));
  assert.equal((await f.run()).state, "error");
  assert.equal(await f.count(), 0);
});
test("blank lines and oversized/malformed records have honest marker/count reconciliation", async (t) => {
  const f = await fixture(t, { lineBytes: 1000 });
  await f.write([
    line(),
    Buffer.from(""),
    Buffer.from("x".repeat(2000)),
    Buffer.from("malformed-secret"),
  ]);
  const result = await f.run();
  assert.equal(result.state, "complete");
  assert.equal(result.inserted, 3);
  assert.equal(result.parseErrors, 2);
  const [rows] = await f.pool.query("SELECT * FROM access_log_records");
  assert.equal(rows.length, 3);
  assert.ok(!JSON.stringify(rows).includes("malformed-secret"));
  const [[source]] = await f.pool.query("SELECT * FROM access_log_sources");
  assert.equal(Number(source.committed_lines), 4);
  assert.equal(Number(source.blank_count), 1);
  assert.equal(Number(source.record_count), 3);
  assert.deepEqual(await readdir(f.config.workDirectory), []);
});
test("a single-connection runtime pool does not deadlock itself on its advisory lock", async (t) => {
  const f = await fixture(t);
  await f.write([line(), line(), line()]);
  const pool = mysql.createPool({
    ...f.dbConfig,
    connectionLimit: 1,
    timezone: "Z",
    dateStrings: true,
  });
  t.after(() => pool.end());
  const result = await sync({
    pool,
    config: f.config,
    clock: f.clock,
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(result.inserted, 3);
  assert.equal(result.state, "complete");
});
test("simultaneous jobs do not duplicate physical record positions", async (t) => {
  const f = await fixture(t);
  await f.write([line(), line(), line()]);
  await Promise.all([f.run(), f.run()]);
  assert.equal(await f.count(), 3);
  assert.equal((await f.run()).inserted, 0);
});
test("a changed queued partial tail is reported as divergence instead of silently stalling", async (t) => {
  const f = await fixture(t);
  await f.write([line(), Buffer.from("partial tail")], "");
  await f.run();
  await f.write([line(), line({ request: "GET /other HTTP/1.1" })]);
  const result = await f.run();
  assert.equal(result.state, "error");
  assert.equal(result.divergedSources, 1);
  assert.equal(await f.count(), 1);
});
test("deadline stops work without late commits and missing source is not empty-success", async (t) => {
  const f = await fixture(t, { runMs: 1 });
  await f.write([line(), line(), line()]);
  const result = await f.run();
  assert.equal(result.state, "pending");
  const before = await f.count();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(await f.count(), before);
  f.config.limits.runMs = 120000;
  await f.run();
  const total = await f.count();
  assert.equal(total, 3);
  const missing = await sync({
    pool: f.pool,
    config: { ...f.config, archiveDirectory: f.config.archiveDirectory + "-missing" },
    clock: f.clock,
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(missing.state, "error");
  assert.equal(await f.count(), 3);
});
