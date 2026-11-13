import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createProfileFixture } from "../backend/test/helpers/profiles.mjs";
import { createDatabaseFixture } from "../backend/test/helpers/database.mjs";
import { legacyContextBackend } from "../backend/test/helpers/legacy-context-backend.mjs";
import { bridge } from "../backend/test/helpers/native-backup.mjs";
import { serve } from "../backend/test/helpers/http.mjs";
import { collectVisitor } from "../backend/dist/visitors/collector.js";
import { createCatalogue } from "../backend/dist/visitors/catalogue.js";
import { migrateVisitorContext } from "../backend/dist/visitors/context-schema.js";
import { createVisitorService } from "../backend/dist/visitors/service.js";
import { createVerifiedBackup, runNativeTool } from "../backend/dist/db/backup.js";

test("pinned v5 rollback after context DDL preserves snapshots and auth, forward recovers observed status", async (t) => {
  const f = await createProfileFixture(t);
  await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
  const catalogue = createCatalogue({
    version: 1,
    products: [{ slug: "map", name: "Sổ tay" }],
    routes: [
      { path: "/", label: "Trang chủ" },
      { path: "/products/map", label: "Sổ tay" },
    ],
  });
  const ctx = {
    now: f.clock.now(),
    idSecret: randomBytes(32).toString("hex"),
    catalogue,
    ip: "127.0.0.1",
    peer: "127.0.0.1",
    sourceVerified: false,
    userAgent: "rollback-fixture",
  };
  const batch = { paths: ["/products/map"], products: ["map"], lastPath: "/products/map" };
  const first = await collectVisitor(f.pool, batch, ctx);
  const cookie = first.cookie.value;
  await collectVisitor(f.pool, batch, {
    ...ctx,
    cookie,
    contextEnabled: true,
    relayObservation: {
      ip: "8.8.8.8",
      source: "php_relay",
      observedAt: f.clock.now(),
      requestId: randomBytes(16).toString("hex"),
    },
    countryLookup: {
      lookup: () => ({ code: "US", name: "United States", dataset: "fixture" }),
      close() {},
    },
  });
  const old = await legacyContextBackend(t);
  assert.equal(old.sourceSha, "ee12307cf68f45484d59c3b77c2f6f7f83a07f47");
  const base = await serve(
    t,
    old.createApp(
      { releaseId: "pinned-v5", sourceSha: old.sourceSha, schemaVersion: 5 },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        profiles: {
          schemaDirectory: resolve("backend/profile-migrations"),
          assetDirectory: f.assetDirectory,
        },
        visitorHistory: { schemaDirectory: resolve("backend/visitor-migrations") },
      },
    ),
  );
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  for (const path of ["/api/auth/profile", "/api/profile"])
    assert.equal(
      (await fetch(base + path, { headers: { Authorization: "Bearer " + f.master.accessToken } }))
        .status,
      200,
    );
  f.clock.advance(1000);
  await old.collectVisitor(f.pool, batch, { ...ctx, now: f.clock.now(), cookie });
  let [[row]] = await f.pool.query("SELECT * FROM visitor_sessions");
  assert.equal(row.ip_status, "unavailable");
  assert.equal(row.client_ip, "8.8.8.8");
  assert.equal(row.ip_source, "php_relay");
  assert.equal(row.country_code, "US");
  const current = createVisitorService(f.pool, catalogue, f.clock, true);
  const list = await current.list({ page: 1, pageSize: 10, search: "8.8.8.8" });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].ipStatus, "observed");
  assert.equal(list.items[0].country, "United States");
  // Old code creates an unknown new session, while the original snapshot survives.
  f.clock.advance(31 * 60000);
  await old.collectVisitor(f.pool, batch, { ...ctx, now: f.clock.now(), cookie });
  const [rows] = await f.pool.query("SELECT * FROM visitor_sessions ORDER BY started_at");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].country_code, "US");
  assert.equal(rows[1].client_ip, null);
  assert.equal(rows[1].country_code, null);
  await collectVisitor(f.pool, batch, { ...ctx, now: f.clock.now(), cookie, contextEnabled: true });
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitor_viewed_products"))[0][0].n, 2);
  assert.equal(
    (await f.pool.query("SELECT COUNT(*) n FROM analytics_relay_receipts"))[0][0].n,
    0,
    "forward collector removes only expired replay receipts",
  );
  await f.pool.execute("INSERT INTO analytics_relay_receipts(request_id,expires_at) VALUES(?,?)", [
    randomBytes(16),
    new Date(+f.clock.now() + 60000),
  ]);
  const verifier = await createDatabaseFixture(t);
  const dir = await mkdtemp(join(tmpdir(), "bibi-context-native-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let restored = false;
  const receipt = await createVerifiedBackup({
    pool: f.pool,
    database: f.dbConfig,
    verifyDatabase: verifier.config.database,
    directory: dir,
    releaseId: "a".repeat(40) + "-77",
    flavor: "mariadb",
    runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
    verifyRestored: async (connection, database) => {
      const [[snap]] = await connection.query(
        `SELECT country_code,ip_source FROM \`${database}\`.visitor_sessions ORDER BY started_at LIMIT 1`,
      );
      assert.equal(snap.country_code, "US");
      assert.equal(snap.ip_source, "php_relay");
      assert.equal(
        (
          await connection.query(
            `SELECT COUNT(*) n FROM \`${database}\`.visitor_context_schema_migrations`,
          )
        )[0][0].n,
        1,
      );
      assert.equal(
        (
          await connection.query(`SELECT COUNT(*) n FROM \`${database}\`.analytics_relay_receipts`)
        )[0][0].n,
        1,
      );
      restored = true;
    },
  });
  assert.equal(receipt.verified, true);
  assert.equal(restored, true);
  const dump = await readFile(receipt.path, "utf8");
  assert.match(dump, /analytics_relay_receipts/);
  assert.match(dump, /country_dataset/);
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitor_sessions"))[0][0].n, 2);
});
