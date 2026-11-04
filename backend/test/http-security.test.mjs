import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { serve } from "./helpers/http.mjs";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { fileURLToPath } from "node:url";

test("network identity masks IPv4/24 and IPv6/48 before any counter storage", async () => {
  const { networkPrefix } = await import("../dist/http/network.js");
  assert.equal(networkPrefix("192.168.5.123"), "192.168.5.0/24");
  assert.equal(networkPrefix("::ffff:192.168.5.124"), "192.168.5.0/24");
  assert.equal(networkPrefix("2001:db8:abcd:1234:5678::1"), "2001:db8:abcd::/48");
  assert.equal(networkPrefix("invalid"), "unknown");
});

test("security middleware requires trusted origin, JSON and custom header without trusting forwarded IP", async (t) => {
  const { installSecurity, requireBrowserOrigin } = await import("../dist/http/security.js");
  const { errorHandler } = await import("../dist/http/errors.js");
  const app = express();
  const config = { allowedOrigins: ["http://localhost:5173"], trustProxy: false };
  installSecurity(app, config);
  app.post("/mutate", requireBrowserOrigin(config), (req, res) => res.json({ ip: req.ip }));
  app.use(errorHandler);
  const base = await serve(t, app);
  const good = {
    Origin: "http://localhost:5173",
    "Content-Type": "application/json",
    "X-Bibi-Request": "1",
  };
  for (const patch of [
    { Origin: "https://evil.example" },
    { Origin: "" },
    { "X-Bibi-Request": "" },
    { "Content-Type": "text/plain" },
  ]) {
    const response = await fetch(base + "/mutate", {
      method: "POST",
      headers: { ...good, ...patch },
      body: "{}",
    });
    assert.ok([403, 415].includes(response.status));
  }
  const response = await fetch(base + "/mutate", {
    method: "POST",
    headers: { ...good, "X-Forwarded-For": "1.2.3.4" },
    body: "{}",
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ip, "127.0.0.1");
  assert.equal(response.headers.get("access-control-allow-origin"), good.Origin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("safe errors have generated request IDs and never expose SQL, token, password or stack", async (t) => {
  const { installSecurity } = await import("../dist/http/security.js");
  const { errorHandler } = await import("../dist/http/errors.js");
  const app = express();
  installSecurity(app, { allowedOrigins: [], trustProxy: false });
  app.get("/fail", () => {
    throw new Error("password=secret token=secret SELECT * FROM users");
  });
  app.use(errorHandler);
  const base = await serve(t, app);
  const response = await fetch(base + "/fail", {
    headers: { "X-Request-Id": "attacker-controlled" },
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
  assert.match(body.requestId, /^[a-f0-9-]{36}$/);
  assert.equal(response.headers.get("x-request-id"), body.requestId);
  assert.ok(!JSON.stringify(body).match(/secret|SELECT|stack|password|token/));
});

test("shared MySQL throttle is atomic across callers and expires", async (t) => {
  const { pool, clock } = await createDatabaseFixture(t);
  const { migrate } = await import("../dist/db/migrate.js");
  const { consumeRateLimit } = await import("../dist/auth/throttle.js");
  await migrate(pool, fileURLToPath(new URL("../migrations", import.meta.url)));
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      consumeRateLimit(pool, "test-network-prefix", { limit: 5, windowMs: 60000 }, clock.now()),
    ),
  );
  assert.equal(results.filter((result) => result.allowed).length, 5);
  const [[row]] = await pool.query("SELECT bucket_hash,hits FROM rate_limit_counters");
  assert.match(row.bucket_hash, /^[a-f0-9]{64}$/);
  assert.equal(row.hits, 20);
  clock.advance(60001);
  assert.equal(
    (
      await consumeRateLimit(
        pool,
        "test-network-prefix",
        { limit: 5, windowMs: 60000 },
        clock.now(),
      )
    ).allowed,
    true,
  );
});

test("readiness fails closed without private DB configuration", async (t) => {
  const { createApp } = await import("../dist/app.js");
  const base = await serve(t, createApp({ releaseId: "test", sourceSha: "test" }));
  assert.equal((await fetch(base + "/api/health")).status, 200);
  assert.equal((await fetch(base + "/api/ready")).status, 503);
});

test("audit metadata is allowlisted and rolls back with the caller transaction", async (t) => {
  const { pool } = await createDatabaseFixture(t);
  const { migrate } = await import("../dist/db/migrate.js");
  const { writeAudit } = await import("../dist/audit/repository.js");
  const { withTransaction } = await import("../dist/db/transaction.js");
  await migrate(pool, fileURLToPath(new URL("../migrations", import.meta.url)));
  await withTransaction(pool, (conn) =>
    writeAudit(conn, {
      action: "login.failure",
      metadata: {
        reason: "credentials",
        password: "secret",
        token: "secret",
        rawIp: "1.2.3.4",
        query: "email=private",
      },
    }),
  );
  const [[row]] = await pool.query("SELECT metadata FROM audit_logs");
  const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
  assert.deepEqual(metadata, { reason: "credentials" });
  await assert.rejects(
    withTransaction(pool, async (conn) => {
      await writeAudit(conn, { action: "test.rollback" });
      throw new Error("rollback");
    }),
  );
  const [[count]] = await pool.query("SELECT COUNT(*) n FROM audit_logs");
  assert.equal(count.n, 1);
});
