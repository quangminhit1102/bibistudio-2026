import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createAuthFixture } from "./helpers/auth.mjs";
import { startServer } from "../dist/server.js";

test("runtime config fails closed, bounds origins and does not contain frontend secrets", async () => {
  const { readAuthConfig } = await import("../dist/config.js");
  const env = {
    AUTH_JWT_SECRET: randomBytes(32).toString("hex"),
    AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
  };
  assert.equal(readAuthConfig(env).cookieSecure, false);
  for (const patch of [
    { AUTH_JWT_SECRET: "short" },
    { AUTH_ALLOWED_ORIGINS: "*" },
    { AUTH_ALLOWED_ORIGINS: "https://bibistudio.vn/admin" },
    { NODE_ENV: "production" },
    { TRUSTED_PROXY_CIDRS: "everything" },
  ])
    assert.throws(() => readAuthConfig({ ...env, ...patch }), /configuration/i);
  assert.equal(
    readAuthConfig({
      ...env,
      NODE_ENV: "production",
      AUTH_ALLOWED_ORIGINS: "https://bibistudio.vn",
    }).cookieSecure,
    true,
  );
});

test("compiled server runtime serves real login with bounded pools and closes all handles without migrating", async (t) => {
  const f = await createAuthFixture(t);
  const { createRuntime } = await import("../dist/runtime.js");
  const env = {
    DB_HOST: f.dbConfig.host,
    DB_PORT: String(f.dbConfig.port),
    DB_USER: f.dbConfig.user,
    DB_PASSWORD: f.dbConfig.password,
    DB_NAME: f.dbConfig.database,
    AUTH_JWT_SECRET: f.config.jwtSecret,
    AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
    ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
    RELEASE_PROBE_SECRET: randomBytes(32).toString("hex"),
  };
  const runtime = createRuntime(env, f.clock);
  const server = await startServer({
    host: "127.0.0.1",
    port: 0,
    release: { releaseId: "test", sourceSha: "test" },
    appOptions: runtime.appOptions,
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
      },
      body: JSON.stringify({ username: "user01", password: f.secrets.userPassword }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).profile.username, "user01");
    assert.equal((await fetch(base + "/api/ready")).status, 200);
    const [[tables]] = await f.pool.query("SELECT COUNT(*) n FROM schema_migrations");
    assert.equal(tables.n, 4);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await runtime.close();
  }
  await assert.rejects(runtime.appOptions.db.getConnection());
});
