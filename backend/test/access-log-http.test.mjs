import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createAuthFixture } from "./helpers/auth.mjs";
import { archiveFixture, accessLogLine } from "./helpers/access-logs.mjs";
import { serve } from "./helpers/http.mjs";
import { createApp } from "../dist/app.js";
import { migrateAccessLogs } from "../dist/access-logs/schema.js";
import { syncAccessLogArchives } from "../dist/access-logs/importer.js";

const directory = fileURLToPath(new URL("../access-log-migrations", import.meta.url));
async function setup(t, migrate = true) {
  const f = await createAuthFixture(t);
  if (migrate) await migrateAccessLogs(f.pool, directory);
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        accessLogs: { pool: f.pool, schemaDirectory: directory },
      },
    ),
  );
  const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const get = async (path = "", token = grant.accessToken) => {
    const [pathname, query] = path.split("?"),
      params = new URLSearchParams(query);
    if (!params.has("scope")) params.set("scope", "archive");
    const res = await fetch(base + "/api/customer-access/access-logs" + pathname + "?" + params, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
  };
  return { ...f, base, get };
}
test("protected SQL history pages all1205 rows, filters safely and exposes sanitized parse markers", async (t) => {
  const f = await setup(t),
    a = await archiveFixture(t, { batchRows: 500 });
  const lines = Array.from({ length: 1204 }, (_, i) =>
    accessLogLine({
      request: `GET ${i === 0 ? "/literal%_x" : "/products/a"}?token=secret HTTP/1.1`,
      status: i === 1 ? "404" : "200",
      time: i === 2 ? "04/Nov/2026:23:59:59 +0000" : "05/Nov/2026:00:00:00 +0000",
    }),
  );
  lines.push(Buffer.from("invalid raw secret line"));
  await a.write(lines);
  assert.equal(
    (
      await syncAccessLogArchives({
        pool: f.pool,
        config: a.config,
        clock: f.clock,
        signal: AbortSignal.timeout(120000),
      })
    ).state,
    "complete",
  );
  assert.equal((await f.get("", null)).status, 401);
  const first = await f.get("?pageSize=100");
  assert.equal(first.status, 200);
  assert.equal(first.body.total, 1205);
  assert.equal(first.body.items.length, 100);
  assert.equal(first.cache, "no-store");
  const last = await f.get("?page=13&pageSize=100");
  assert.equal(last.body.items.length, 5);
  const marker = last.body.items.find((row) => row.parseStatus === "error");
  assert.ok(marker);
  assert.equal(marker.occurredAt, null);
  assert.equal((await f.get("/" + marker.id)).body.id, marker.id);
  assert.equal((await f.get("/" + marker.id)).body.sourceName, a.basename);
  for (const [query, total] of [
    ["search=%25_", 1],
    ["pathname=/literal%25_x", 1],
    ["status=404", 1],
    ["ipPrefix=203.0.113.0%2F24", 1204],
    ["isBot=true", 0],
    ["resourceKind=page", 1204],
    ["from=2026-11-05&to=2026-11-05", 1203],
    ["parseStatus=error", 1],
  ]) {
    const result = await f.get("?" + query);
    assert.equal(result.status, 200, query);
    assert.equal(result.body.total, total, query);
    assert.ok(result.body.items.length <= total);
  }
  for (const query of [
    "page=0",
    "page=1.5",
    "pageSize=101",
    "pageSize=21",
    "page=9007199254740991",
    "status=abc",
    "isBot=unknown",
    "from=2026-02-30",
    "from=2026-11-06&to=2026-11-05",
    "unexpected=x",
  ])
    assert.equal((await f.get("?" + query)).status, 400, query);
  assert.equal((await f.get("/" + "f".repeat(64))).status, 404);
  const admin = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  assert.equal((await f.get("", admin.accessToken)).status, 200);
  await f.pool.query(
    "DELETE FROM user_roles WHERE user_id=(SELECT id FROM users WHERE username=?)",
    ["user01"],
  );
  assert.equal((await f.get()).status, 403);
  const serialized = JSON.stringify([first.body, last.body]);
  for (const secret of ["203.0.113.42", "token=secret", "invalid raw secret line", a.root])
    assert.ok(!serialized.includes(secret));
  const before = await f.get("/status", admin.accessToken);
  assert.equal(before.body.stale, false);
  f.clock.advance(46 * 60 * 1000);
  const renewed = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  assert.equal((await f.get("/status", renewed.accessToken)).body.stale, true);
});
test("missing/dirty schema returns503 while auth/public stay ready and source errors stay explicit", async (t) => {
  const f = await setup(t, false);
  assert.equal((await f.get()).status, 503);
  assert.equal((await fetch(f.base + "/api/ready")).status, 200);
  assert.equal((await fetch(f.base + "/api/health")).status, 200);
  await migrateAccessLogs(f.pool, directory);
  const status = await f.get("/status");
  assert.equal(status.status, 200);
  assert.equal(status.body.state, "never");
  await f.pool.query(
    "INSERT INTO access_log_sources(id,basename,transport,prefix_sha256,state,error_code) VALUES (UUID(),'safe-Nov-2026.gz','https',REPEAT('0',64),'diverged','SOURCE_DIVERGED')",
  );
  const failed = await f.get("/status");
  assert.equal(failed.body.state, "error");
  assert.equal(failed.body.sources[0].errorCode, "SOURCE_DIVERGED");
  assert.equal(failed.body.ipTrusted, false);
  await f.pool.query("UPDATE access_log_migrations SET state='dirty'");
  assert.equal((await f.get("/status")).status, 503);
  assert.equal((await fetch(f.base + "/api/ready")).status, 200);
});
