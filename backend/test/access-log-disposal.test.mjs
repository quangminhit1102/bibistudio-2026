import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import { archiveFixture, accessLogLine } from "./helpers/access-logs.mjs";
import { discoverAccessLogArchives } from "../dist/access-logs/sources.js";
import { snapshotArchive, queuedSnapshots, removeSnapshot } from "../dist/access-logs/snapshot.js";
import {
  captureCurrentLog,
  queuedCurrentSnapshots,
  removeCurrentSnapshot,
} from "../dist/access-logs/current-snapshot.js";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { migrateAccessLogs } from "../dist/access-logs/schema.js";
import { syncAccessLogArchives } from "../dist/access-logs/importer.js";
import { syncCurrentLogs } from "../dist/access-logs/current-cache.js";
import { resolve } from "node:path";

const fs = createRequire(import.meta.url)("node:fs/promises");
for (const scope of ["archive", "current"]) {
  for (const cut of ["rename", "payload", "descriptor", "rmdir"]) {
    test(`${scope} disposal interrupted after ${cut} recovers without losing healthy queued input`, async (t) => {
      const f = await archiveFixture(t);
      const currentDirectory = join(f.root, "current");
      await mkdir(currentDirectory);
      const config = { ...f.config, currentDirectory };
      const currentFile = join(currentDirectory, config.domainAlias);
      const capture = async (lines) => {
        if (scope === "archive") {
          await f.write(lines);
          return snapshotArchive(
            (await discoverAccessLogArchives(config))[0],
            config,
            AbortSignal.timeout(10000),
          );
        }
        await writeFile(currentFile, Buffer.concat(lines.flatMap((x) => [x, Buffer.from("\n")])));
        return captureCurrentLog(config, "http", AbortSignal.timeout(10000));
      };
      const old = await capture([accessLogLine()]);
      const healthy = await capture([accessLogLine(), accessLogLine()]);
      const expected = await readFile(healthy.path);
      const remove = scope === "archive" ? removeSnapshot : removeCurrentSnapshot;
      const queue = scope === "archive" ? queuedSnapshots : queuedCurrentSnapshots;
      const method = cut === "rename" || cut === "rmdir" ? cut : "unlink";
      const original = fs[method];
      let interrupted = false;
      fs[method] = async (...args) => {
        const result = await original(...args);
        const path = String(args[0]);
        if (
          !interrupted &&
          (cut === method ||
            path.endsWith(
              cut === "descriptor"
                ? "descriptor.json"
                : scope === "archive"
                  ? "archive.gz"
                  : "source.log",
            ))
        ) {
          interrupted = true;
          throw Error("simulated job termination");
        }
        return result;
      };
      try {
        await assert.rejects(remove(old, config), /simulated/);
      } finally {
        fs[method] = original;
      }
      assert.equal(interrupted, true);
      await unlink(scope === "archive" ? f.file : currentFile);
      const remaining = await queue(config);
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].path, healthy.path);
      assert.deepEqual(await readFile(remaining[0].path), expected);
      await remove(old, config); // repeated disposal remains safe after recovery
      assert.equal((await queue(config)).length, 1);
    });
  }
}

for (const scope of ["archive", "current"]) {
  test(`${scope} interrupted disposal resumes queued imports after source loss with valid DB counts`, async (t) => {
    const db = await createDatabaseFixture(t),
      f = await archiveFixture(t);
    const currentDirectory = join(f.root, "current");
    await mkdir(currentDirectory);
    const config = { ...f.config, currentDirectory };
    const currentFile = join(currentDirectory, config.domainAlias);
    const write = (n) =>
      scope === "archive"
        ? f.write(Array(n).fill(accessLogLine()))
        : writeFile(
            currentFile,
            Buffer.concat(Array(n).fill(Buffer.concat([accessLogLine(), Buffer.from("\n")]))),
          );
    const capture = async () =>
      scope === "archive"
        ? snapshotArchive(
            (await discoverAccessLogArchives(config))[0],
            config,
            AbortSignal.timeout(10000),
          )
        : captureCurrentLog(config, "http", AbortSignal.timeout(10000));
    const run = () =>
      (scope === "archive" ? syncAccessLogArchives : syncCurrentLogs)({
        pool: db.pool,
        config,
        clock: db.clock,
        signal: AbortSignal.timeout(10000),
      });
    await migrateAccessLogs(db.pool, resolve("backend/access-log-migrations"));
    await write(2);
    await run();
    const old = await capture();
    await write(3);
    await capture();
    const original = fs.unlink;
    fs.unlink = async (...args) => {
      const result = await original(...args);
      if (String(args[0]).endsWith("descriptor.json")) throw Error("terminated after descriptor");
      return result;
    };
    try {
      await assert.rejects(
        (scope === "archive" ? removeSnapshot : removeCurrentSnapshot)(old, config),
        /terminated/,
      );
    } finally {
      fs.unlink = original;
    }
    await unlink(scope === "archive" ? f.file : currentFile);
    await run();
    await run();
    const sql =
      scope === "archive"
        ? "SELECT COUNT(*) n FROM access_log_records"
        : "SELECT COUNT(*) n FROM access_log_current_records r JOIN access_log_current_sources s ON r.source_id=s.id AND r.snapshot_id=s.active_snapshot_id";
    assert.equal(Number((await db.pool.query(sql))[0][0].n), 3);
    if (scope === "current") {
      const [sources] = await db.pool.query(
        "SELECT record_count FROM access_log_current_sources WHERE active_snapshot_id IS NOT NULL",
      );
      assert.equal(
        sources.reduce((sum, s) => sum + Number(s.record_count), 0),
        3,
      );
    }
  });
}

test("disposal recovery refuses unknown files and malformed live queue entries", async (t) => {
  const f = await archiveFixture(t);
  await f.write([accessLogLine()]);
  const snapshot = await snapshotArchive(
    (await discoverAccessLogArchives(f.config))[0],
    f.config,
    AbortSignal.timeout(10000),
  );
  await writeFile(join(resolve(snapshot.path, ".."), "unexpected"), "retain");
  await assert.rejects(removeSnapshot(snapshot, f.config), /UNEXPECTED_WORK_ENTRY/);
  await assert.rejects(queuedSnapshots(f.config), /UNEXPECTED_WORK_ENTRY/);
});
