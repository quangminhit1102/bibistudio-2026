import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createProfileFixture } from "./helpers/profiles.mjs";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { archiveFixture, accessLogLine } from "./helpers/access-logs.mjs";
import { pngImage } from "./helpers/avatar-images.mjs";
import { bridge } from "./helpers/native-backup.mjs";
import { createProfileBackup } from "../dist/profile/backup.js";
import { runNativeTool } from "../dist/db/backup.js";
import { migrateVisitorHistory } from "../dist/visitors/schema.js";
import { migrateAccessLogs } from "../dist/access-logs/schema.js";
import { syncAccessLogArchives } from "../dist/access-logs/importer.js";
test("native paired restore verifies durable visitor metadata, frozen log rows and avatar pointers together", async (t) => {
  const f = await createProfileFixture(t),
    verify = await createDatabaseFixture(t),
    archive = await archiveFixture(t);
  const directory = await mkdtemp(join(tmpdir(), "bibi-visitor-backup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await migrateVisitorHistory(f.pool, resolve("backend/visitor-migrations"));
  await migrateAccessLogs(f.pool, resolve("backend/access-log-migrations"));
  await archive.write([accessLogLine()]);
  await syncAccessLogArchives({
    pool: f.pool,
    config: archive.config,
    clock: f.clock,
    signal: AbortSignal.timeout(120000),
  });
  await f.pool.query(
    "INSERT INTO visitors(id,identity_hash,ip_prefix,device_type,operating_system,browser,first_seen_at,last_seen_at) VALUES('old',?,'192.0.2.0/24','desktop','Windows','Edge','2020-01-01','2020-01-01')",
    ["d".repeat(64)],
  );
  await f.pool.query(
    "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path,client_ip,ip_status) VALUES('old-session','old','2020-01-01','2020-01-01','/','/','8.8.8.8','verified')",
  );
  const avatar = await (await f.upload(pngImage(), 1)).json();
  assert.ok(avatar.avatarId);
  let restored = false;
  const receipt = await createProfileBackup({
    pool: f.pool,
    database: f.dbConfig,
    verifyDatabase: verify.config.database,
    directory,
    assetDirectory: f.assetDirectory,
    releaseId: "a".repeat(40) + "-123",
    flavor: "mariadb",
    runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
    verifyRestored: async (c, db) => {
      const [[ledger]] = await c.query(
        `SELECT state FROM \`${db}\`.visitor_history_schema_migrations`,
      );
      assert.equal(ledger.state, "complete");
      const [[session]] = await c.query(
        `SELECT client_ip,ip_status FROM \`${db}\`.visitor_sessions WHERE id='old-session'`,
      );
      assert.equal(session.client_ip, "8.8.8.8");
      assert.equal(session.ip_status, "verified");
      const [[logs]] = await c.query(`SELECT COUNT(*) n FROM \`${db}\`.access_log_records`);
      assert.equal(logs.n, 1);
      restored = true;
    },
  });
  assert.equal(restored, true);
  assert.equal(receipt.verified, true);
  assert.equal(receipt.assetCount, 1);
  assert.match(await readFile(receipt.path, "utf8"), /visitor_history_schema_migrations/);
});
