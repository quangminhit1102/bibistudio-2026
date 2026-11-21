import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createAuthFixture } from "./helpers/auth.mjs";
import { createRuntime } from "../dist/runtime.js";
import { createApp } from "../dist/app.js";
import { serve } from "./helpers/http.mjs";
import { migrateVisitorContext } from "../dist/visitors/context-schema.js";
test("runtime loads dataset once, closes it, and readiness rejects unmigrated context without DDL", async (t) => {
  const f = await createAuthFixture(t, { visitorControls: true });
  const dir = await mkdtemp(join(tmpdir(), "bibi-runtime-country-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "country.mmdb");
  await writeFile(file, await readFile(resolve("backend/geoip/country.mmdb")));
  await writeFile(
    join(dir, "country.lock.json"),
    await readFile(resolve("scripts/geoip-country.lock.json")),
  );
  const env = {
    DB_HOST: f.dbConfig.host,
    DB_PORT: String(f.dbConfig.port),
    DB_USER: f.dbConfig.user,
    DB_PASSWORD: f.dbConfig.password,
    DB_NAME: f.dbConfig.database,
    AUTH_JWT_SECRET: f.config.jwtSecret,
    AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
    ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
    ANALYTICS_RELAY_SECRET: randomBytes(32).toString("base64url"),
    GEOIP_COUNTRY_FILE: file,
  };
  const before = (await f.pool.query("SHOW TABLES"))[0];
  const runtime = createRuntime(env, f.clock);
  t.after(() => runtime.close());
  assert.equal(runtime.appOptions.analytics.countryLookup.lookup("8.8.8.8").code, "US");
  assert.equal(runtime.appOptions.analytics.clientIpSourceVerified, false);
  assert.equal(runtime.appOptions.config.trustProxy, false);
  assert.deepEqual((await f.pool.query("SHOW TABLES"))[0], before);
  const base = await serve(
    t,
    createApp({ releaseId: "test", sourceSha: "test" }, runtime.appOptions),
  );
  assert.equal((await fetch(base + "/api/ready")).status, 503);
  await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  for (const patch of [
    { ANALYTICS_RELAY_SECRET: "short" },
    { GEOIP_COUNTRY_FILE: join(dir, "missing") },
  ])
    assert.throws(() => createRuntime({ ...env, ...patch }, f.clock));
  await writeFile(file, "corrupt");
  assert.throws(() => createRuntime(env, f.clock), /checksum/i);
  assert.equal(
    runtime.appOptions.analytics.countryLookup.lookup("8.8.8.8").code,
    "US",
    "active immutable reader is not replaced by file mutation",
  );
  await runtime.close();
  assert.equal(runtime.appOptions.analytics.countryLookup.lookup("8.8.8.8"), null);
});
