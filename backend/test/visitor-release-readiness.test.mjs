import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createProfileFixture } from "./helpers/profiles.mjs";
import { createApp } from "../dist/app.js";
import { migrateVisitorHistory } from "../dist/visitors/schema.js";
import { serve } from "./helpers/http.mjs";
test("manifest5 readiness requires independently complete visitor schema and retired log routes are JSON404", async (t) => {
  const f = await createProfileFixture(t, { visitorHistory: false });
  const base = await serve(
    t,
    createApp(
      { releaseId: "history", sourceSha: "test", schemaVersion: 5 },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        profiles: {
          schemaDirectory: resolve("backend/profile-migrations"),
          assetDirectory: f.assetDirectory,
        },
        visitorHistory: { schemaDirectory: resolve("backend/visitor-migrations") },
        accessLogs: { pool: f.pool, schemaDirectory: resolve("backend/access-log-migrations") },
      },
    ),
  );
  assert.equal((await fetch(base + "/api/ready")).status, 503);
  await migrateVisitorHistory(f.pool, resolve("backend/visitor-migrations"));
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  for (const path of [
    "/api/customer-access/access-logs",
    "/api/customer-access/access-logs/status",
  ]) {
    const r = await fetch(base + path);
    assert.equal(r.status, 404);
    assert.equal((await r.json()).error.code, "NOT_FOUND");
  }
  await f.pool.query("UPDATE visitor_history_schema_migrations SET state='dirty'");
  assert.equal((await fetch(base + "/api/ready")).status, 503);
});
