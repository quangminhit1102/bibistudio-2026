import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { accessLogLine } from "./helpers/access-logs.mjs";
import { migrateAccessLogs } from "../dist/access-logs/schema.js";
import { getOrCreateSource, commitAccessLogBatch } from "../dist/access-logs/repository.js";
import { parseAccessLogLine } from "../dist/access-logs/parse.js";
import { withTransaction } from "../dist/db/transaction.js";
const directory = fileURLToPath(new URL("../access-log-migrations", import.meta.url));
async function fixture(t) {
  const f = await createDatabaseFixture(t);
  await migrateAccessLogs(f.pool, directory);
  const before = await getOrCreateSource(f.pool, "bibistudio.vn.vhplastic.com-Nov-2026.gz", "http");
  const rows = [1, 2].map((n) => parseAccessLogLine(accessLogLine(), before.sourceId, n));
  const after = {
    ...before,
    committedBytes: 1000,
    committedLines: 2,
    recordCount: 2,
    prefixSha256: createHash("sha256").update("two-lines").digest("hex"),
  };
  return { ...f, before, after, rows };
}
test("batch insert and checkpoint rollback together, retry preserves identical lines", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    withTransaction(f.pool, async (c) => {
      await commitAccessLogBatch(c, f.before, f.after, f.rows);
      throw Error("injected crash");
    }),
    /injected/,
  );
  const [[empty]] = await f.pool.query("SELECT COUNT(*) n FROM access_log_records");
  assert.equal(empty.n, 0);
  const afterFailure = await getOrCreateSource(f.pool, f.before.basename, "http");
  assert.equal(afterFailure.committedLines, 0);
  await withTransaction(f.pool, (c) => commitAccessLogBatch(c, f.before, f.after, f.rows));
  const saved = await getOrCreateSource(f.pool, f.before.basename, "http");
  assert.deepEqual(saved, f.after);
  const [[count]] = await f.pool.query("SELECT COUNT(*) n FROM access_log_records");
  assert.equal(count.n, 2);
  await assert.rejects(
    withTransaction(f.pool, (c) => commitAccessLogBatch(c, f.before, f.after, f.rows)),
    /stale/i,
  );
});
test("concurrent writers with the same checkpoint allow exactly one transaction", async (t) => {
  const f = await fixture(t);
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      withTransaction(f.pool, (c) => commitAccessLogBatch(c, f.before, f.after, f.rows)),
    ),
  );
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  const [[count]] = await f.pool.query("SELECT COUNT(*) n FROM access_log_records");
  assert.equal(count.n, 2);
});
test("blank lines reconcile, malformed markers persist, invalid checkpoint never advances", async (t) => {
  const f = await fixture(t);
  const marker = parseAccessLogLine(Buffer.from("secret invalid raw"), f.before.sourceId, 2);
  const after = { ...f.after, committedLines: 3, blankCount: 1 };
  await withTransaction(f.pool, (c) =>
    commitAccessLogBatch(c, f.before, after, [f.rows[0], marker]),
  );
  const [rows] = await f.pool.query("SELECT * FROM access_log_records ORDER BY ordinal");
  assert.equal(rows.length, 2);
  assert.equal(rows[1].pathname, null);
  assert.equal(rows[1].ip_prefix, null);
  assert.equal(rows[1].parse_status, "error");
  assert.ok(!JSON.stringify(rows).includes("secret"));
  await assert.rejects(
    withTransaction(f.pool, (c) =>
      commitAccessLogBatch(c, after, { ...after, committedLines: 4 }, []),
    ),
    /checkpoint/i,
  );
  await assert.rejects(getOrCreateSource(f.pool, f.before.basename, "https"), /transport/i);
});
