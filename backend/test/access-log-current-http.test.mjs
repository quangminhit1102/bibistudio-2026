import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";
import { archiveFixture, accessLogLine } from "./helpers/access-logs.mjs";
import { serve } from "./helpers/http.mjs";
import { migrateAccessLogs } from "../dist/access-logs/schema.js";
import { syncCurrentLogs } from "../dist/access-logs/current-cache.js";
import { createApp } from "../dist/app.js";
test("scope defaults current, pages all1205 cached rows, archive separate, validates scope and retires inactive detail", async (t) => {
  const f = await createAuthFixture(t),
    a = await archiveFixture(t, { batchRows: 500 }),
    currentDirectory = join(a.root, "current");
  await mkdir(currentDirectory);
  const config = { ...a.config, currentDirectory };
  await writeFile(join(currentDirectory, config.domainAlias), "");
  const ssl = join(currentDirectory, config.domainAlias + "-ssl_log");
  await writeFile(
    ssl,
    Array.from({ length: 1205 }, () => accessLogLine().toString()).join("\n") + "\n",
  );
  const directory = resolve("backend/access-log-migrations");
  await migrateAccessLogs(f.pool, directory);
  const sync = () =>
    syncCurrentLogs({ pool: f.pool, config, clock: f.clock, signal: AbortSignal.timeout(120000) });
  await sync();
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        accessLogs: { pool: f.pool, schemaDirectory: directory, currentEnabled: true },
      },
    ),
  );
  const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  assert.equal((await fetch(base + "/api/customer-access/access-logs")).status, 401);
  const get = async (path) => {
    const response = await fetch(base + "/api/customer-access/access-logs" + path, {
      headers: { Authorization: "Bearer " + grant.accessToken },
    });
    return { status: response.status, body: await response.json() };
  };
  const first = await get("?pageSize=100");
  assert.equal(first.status, 200);
  assert.equal(first.body.total, 1205);
  assert.equal(first.body.items.length, 100);
  assert.equal((await get("?pageSize=100&page=13")).body.items.length, 5);
  assert.equal((await get("?scope=archive")).body.total, 0);
  assert.equal((await get("?scope=current&status=404")).body.total, 0);
  for (const path of ["?scope=unknown", "/status?scope=unknown", "/status?unexpected=1"])
    assert.equal((await get(path)).status, 400);
  const status = await get("/status");
  assert.equal(status.body.scope, "current");
  assert.equal(status.body.total, 1205);
  assert.equal(status.body.ipTrusted, false);
  assert.ok(status.body.sourceModifiedAt);
  const id = first.body.items[0].id;
  assert.equal((await get("/" + id)).status, 200);
  assert.equal((await get("/" + id)).body.sourceName, config.domainAlias + "-ssl_log");
  assert.equal((await get("/" + id + "?scope=archive")).status, 404);
  await writeFile(ssl, "");
  await sync();
  assert.equal((await get("/" + id)).status, 404);
  assert.equal((await get("")).body.total, 0);
  await f.pool.query(
    "DELETE FROM user_roles WHERE user_id=(SELECT id FROM users WHERE username=?)",
    ["user01"],
  );
  assert.equal((await get("")).status, 403);
  const admin = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  assert.equal(
    (
      await fetch(base + "/api/customer-access/access-logs", {
        headers: { Authorization: "Bearer " + admin.accessToken },
      })
    ).status,
    200,
  );
});
