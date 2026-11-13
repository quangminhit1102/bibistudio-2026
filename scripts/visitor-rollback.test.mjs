import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createProfileFixture } from "../backend/test/helpers/profiles.mjs";
import { legacyVisitorBackend } from "../backend/test/helpers/legacy-visitor-backend.mjs";
import { serve } from "../backend/test/helpers/http.mjs";
import { migrateVisitorHistory } from "../backend/dist/visitors/schema.js";
import { cleanupAnalytics } from "../backend/dist/visitors/cleanup.js";
import { createApp } from "../backend/dist/app.js";
test("actual pinned production v4 rollback keeps historical visitor rows and auth/profile readiness", async (t) => {
  const f = await createProfileFixture(t);
  await migrateVisitorHistory(f.pool, resolve("backend/visitor-migrations"));
  await f.pool.query(
    "INSERT INTO visitors(id,identity_hash,ip_prefix,device_type,operating_system,browser,first_seen_at,last_seen_at) VALUES('history',?,'192.0.2.0/24','desktop','Windows','Edge','2020-01-01','2020-01-01')",
    ["c".repeat(64)],
  );
  await f.pool.query(
    "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path,client_ip,ip_status) VALUES('history-session','history','2020-01-01','2020-01-01','/','/','8.8.8.8','verified')",
  );
  await f.pool.query(
    "INSERT INTO visitor_session_pages VALUES('history-session','/','2020-01-01','2020-01-01')",
  );
  await f.pool.query(
    "INSERT INTO visitor_viewed_products VALUES('history-session','a','2020-01-01','2020-01-01')",
  );
  const options = {
    db: f.pool,
    config: f.config,
    clock: f.clock,
    profiles: {
      schemaDirectory: resolve("backend/profile-migrations"),
      assetDirectory: f.assetDirectory,
    },
    visitorHistory: { schemaDirectory: resolve("backend/visitor-migrations") },
  };
  const current = await serve(
    t,
    createApp({ releaseId: "new", sourceSha: "test", schemaVersion: 5 }, options),
  );
  assert.equal((await fetch(current + "/api/ready")).status, 200);
  const legacy = await legacyVisitorBackend(t);
  assert.equal(legacy.sourceSha, "3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf");
  const old = await serve(
    t,
    legacy.createApp(
      { releaseId: "old-production", sourceSha: legacy.sourceSha, schemaVersion: 4 },
      options,
    ),
  );
  assert.equal((await fetch(old + "/api/ready")).status, 200);
  assert.equal(
    (
      await fetch(old + "/api/auth/profile", {
        headers: { Authorization: `Bearer ${f.master.accessToken}` },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(old + "/api/profile", {
        headers: { Authorization: `Bearer ${f.master.accessToken}` },
      })
    ).status,
    200,
  );
  await cleanupAnalytics(f.pool, f.clock.now());
  assert.equal((await fetch(current + "/api/ready")).status, 200);
  for (const table of [
    "visitors",
    "visitor_sessions",
    "visitor_session_pages",
    "visitor_viewed_products",
  ]) {
    const [[row]] = await f.pool.query(`SELECT COUNT(*) n FROM ${table}`);
    assert.equal(row.n, 1, table);
  }
  const [[session]] = await f.pool.query("SELECT client_ip,ip_status FROM visitor_sessions");
  assert.equal(session.client_ip, "8.8.8.8");
  assert.equal(session.ip_status, "verified");
});
