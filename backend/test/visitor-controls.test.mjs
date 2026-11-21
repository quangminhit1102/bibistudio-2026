import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";
import { createCatalogue } from "../dist/visitors/catalogue.js";
import { collectVisitor } from "../dist/visitors/collector.js";
const directory = resolve("backend/visitor-controls-migrations");
test("controls migrate idempotently; revision conflicts, excluded batches, precise delete and fresh authorization", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateVisitorControls, visitorControlsSchemaStatus } =
    await import("../dist/visitors/controls-schema.js");
  await migrateVisitorControls(f.pool, directory);
  await migrateVisitorControls(f.pool, directory);
  assert.equal((await visitorControlsSchemaStatus(f.pool, directory)).state, "complete");
  const { createVisitorControlsService } = await import("../dist/visitors/controls-service.js");
  const service = createVisitorControlsService(f.pool, f.clock);
  const admin = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const actor = await f.auth.authenticate(admin.accessToken);
  const user = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const userActor = await f.auth.authenticate(user.accessToken);
  await assert.rejects(service.setExclusions({ revision: 1, rules: [] }, userActor), {
    status: 403,
  });
  assert.deepEqual(await service.getExclusions(actor), { revision: 1, rules: [] });
  assert.deepEqual(await service.setExclusions({ revision: 1, rules: ["8.8.8.*"] }, actor), {
    revision: 2,
    rules: ["8.8.8.*"],
  });
  await assert.rejects(service.setExclusions({ revision: 1, rules: [] }, actor), { status: 409 });
  const catalogue = createCatalogue({
    version: 1,
    routes: [{ path: "/", label: "home" }],
    products: [],
  });
  const batch = { paths: ["/"], products: [], lastPath: "/" };
  const ctx = {
    ip: "8.8.8.8",
    peer: "127.0.0.1",
    sourceVerified: true,
    trustedCidrs: ["127.0.0.1/32"],
    now: f.clock.now(),
    idSecret: "x".repeat(64),
    userAgent: "test",
    catalogue,
    controlsEnabled: true,
  };
  assert.deepEqual(await collectVisitor(f.pool, batch, ctx), { status: 204 });
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitors"))[0][0].n, 0);
  await service.setExclusions({ revision: 2, rules: [] }, actor);
  const bootstrap = await collectVisitor(f.pool, batch, ctx);
  await collectVisitor(f.pool, batch, { ...ctx, cookie: bootstrap.cookie.value });
  const [[v]] = await f.pool.query("SELECT id FROM visitors");
  const [[s]] = await f.pool.query("SELECT id FROM visitor_sessions");
  await assert.rejects(service.deleteVisitors([v.id, v.id], actor), { status: 400 });
  await f.pool.query("UPDATE visitors SET is_probe=1 WHERE id=?", [v.id]);
  await assert.rejects(service.deleteVisitors([v.id], actor), { status: 409 });
  await f.pool.query("UPDATE visitors SET is_probe=0 WHERE id=?", [v.id]);
  await assert.rejects(service.deleteSession(v.id, "00000000-0000-4000-8000-000000000000", actor), {
    status: 404,
  });
  assert.equal((await service.deleteSession(v.id, s.id, actor)).visitorDeleted, true);
  const [[auditSession]] = await f.pool.query(
    "SELECT target_type,target_id FROM audit_logs WHERE action='customer_access.delete_session' ORDER BY created_at DESC LIMIT 1",
  );
  assert.deepEqual({ ...auditSession }, { target_type: "visitor_session", target_id: s.id });
  for (const table of ["visitors", "visitor_sessions", "visitor_session_pages"])
    assert.equal((await f.pool.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n, 0);
  await f.pool.query("UPDATE refresh_token_sessions SET revoked_at=UTC_TIMESTAMP() WHERE id=?", [
    actor.sid,
  ]);
  await assert.rejects(service.setExclusions({ revision: 3, rules: [] }, actor), { status: 401 });
});

test("schema readiness rejects missing singleton and invalid rule settings, preserves ledger checksum", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateVisitorControls, visitorControlsSchemaStatus } =
    await import("../dist/visitors/controls-schema.js");
  const { readExclusions } = await import("../dist/visitors/controls-service.js");
  assert.equal((await visitorControlsSchemaStatus(f.pool, directory)).state, "empty");
  await assert.rejects(
    collectVisitor(
      f.pool,
      { paths: ["/"], products: [], lastPath: "/" },
      {
        controlsEnabled: true,
        ip: "8.8.8.8",
        now: f.clock.now(),
        idSecret: "a".repeat(64),
        catalogue: createCatalogue({
          version: 1,
          routes: [{ path: "/", label: "home" }],
          products: [],
        }),
        userAgent: "",
      },
    ),
    { status: 503 },
  );
  await migrateVisitorControls(f.pool, directory);
  await f.pool.query("DELETE FROM visitor_exclusion_settings");
  assert.equal((await visitorControlsSchemaStatus(f.pool, directory)).state, "dirty");
  await assert.rejects(readExclusions(f.pool), { status: 503 });
});

test("HTTP permissions are independent, browser mutations protected, static exclusions precede visitor detail", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateVisitorControls } = await import("../dist/visitors/controls-schema.js");
  await migrateVisitorControls(f.pool, directory);
  const { createApp } = await import("../dist/app.js");
  const { serve } = await import("./helpers/http.mjs");
  const catalogue = createCatalogue({
    version: 1,
    routes: [{ path: "/", label: "home" }],
    products: [],
  });
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        visitorControls: { schemaDirectory: directory },
        analytics: { pool: f.pool, idSecret: "x".repeat(64), cookieSecure: false, catalogue },
      },
    ),
  );
  const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const call = (path, method = "GET", body, origin = "http://localhost:5173") =>
    fetch(base + "/api/customer-access" + path, {
      method,
      headers: {
        Authorization: `Bearer ${grant.accessToken}`,
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
        Origin: origin,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  assert.equal((await call("/exclusions")).status, 403);
  assert.equal((await call("/bulk-delete", "POST", { ids: [] })).status, 403);
  await f.pool.query(
    "INSERT INTO role_permissions VALUES ('system-user','customer_access.manage_exclusions')",
  );
  assert.equal((await call("/exclusions")).status, 200);
  assert.equal(
    (await call("/exclusions", "PUT", { revision: 1, rules: [] }, "https://evil.invalid")).status,
    403,
  );
  assert.equal((await call("/exclusions", "PUT", { revision: 1, rules: ["8.8.*.*"] })).status, 200);
  assert.equal((await call("/exclusions", "PUT", { revision: 1, rules: [] })).status, 409);
  assert.equal((await call("/bulk-delete", "POST", { ids: [] })).status, 403);
  await f.pool.query(
    "DELETE FROM role_permissions WHERE role_id='system-user' AND permission_id='customer_access.manage_exclusions'",
  );
  await f.pool.query(
    "INSERT INTO role_permissions VALUES ('system-user','customer_access.delete')",
  );
  assert.equal((await call("/exclusions")).status, 403);
  assert.equal((await call("/bulk-delete", "POST", { ids: [] })).status, 400);
  assert.equal((await call("/00000000-0000-4000-8000-000000000000", "DELETE")).status, 404);
  await f.pool.query(
    "DELETE FROM role_permissions WHERE role_id='system-user' AND permission_id='customer_access.view'",
  );
  assert.equal((await call("/00000000-0000-4000-8000-000000000000", "DELETE")).status, 403);
});

test("excluded relay batches preserve replay receipts, skip all analytics/cookies/geo and ignore unverified raw IP", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateVisitorControls } = await import("../dist/visitors/controls-schema.js");
  await migrateVisitorControls(f.pool, directory);
  const { migrateVisitorContext } = await import("../dist/visitors/context-schema.js");
  await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
  await f.pool.query("UPDATE visitor_exclusion_settings SET rules='[\"8.8.8.*\"]'");
  const catalogue = createCatalogue({
    version: 1,
    routes: [{ path: "/", label: "home" }],
    products: [],
  });
  const ctx = {
    ip: "8.8.8.8",
    peer: "127.0.0.1",
    sourceVerified: false,
    now: f.clock.now(),
    idSecret: "x".repeat(64),
    userAgent: "test",
    catalogue,
    controlsEnabled: true,
    contextEnabled: true,
    countryLookup: {
      lookup() {
        assert.fail("excluded batch must not lookup country");
      },
      close() {},
    },
  };
  const batch = { paths: ["/"], products: [], lastPath: "/" };
  const relayObservation = {
    ip: "::ffff:8.8.8.8",
    observedAt: f.clock.now(),
    requestId: "a".repeat(32),
    source: "php_relay",
  };
  assert.deepEqual(await collectVisitor(f.pool, batch, { ...ctx, relayObservation }), {
    status: 204,
  });
  await assert.rejects(collectVisitor(f.pool, batch, { ...ctx, relayObservation }), {
    status: 409,
    code: "RELAY_REPLAY",
  });
  for (const table of [
    "visitors",
    "visitor_sessions",
    "visitor_session_pages",
    "visitor_viewed_products",
    "rate_limit_counters",
  ])
    assert.equal((await f.pool.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n, 0, table);
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM analytics_relay_receipts"))[0][0].n, 1);
  assert.equal((await collectVisitor(f.pool, batch, ctx)).status, 202);
  await f.pool.query("UPDATE visitor_controls_schema_migrations SET state='dirty'");
  await assert.rejects(collectVisitor(f.pool, batch, ctx), { status: 503 });
});

test("delete preserves other sessions, recomputes counters and races collector without FK or orphan history", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateVisitorControls } = await import("../dist/visitors/controls-schema.js");
  await migrateVisitorControls(f.pool, directory);
  const { createVisitorControlsService } = await import("../dist/visitors/controls-service.js");
  const service = createVisitorControlsService(f.pool, f.clock);
  const grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const actor = await f.auth.authenticate(grant.accessToken);
  const catalogue = createCatalogue({
    version: 1,
    routes: [{ path: "/", label: "home" }],
    products: [],
  });
  const batch = { paths: ["/"], products: [], lastPath: "/" };
  const ctx = {
    ip: "8.8.8.8",
    now: f.clock.now(),
    idSecret: "x".repeat(64),
    userAgent: "test",
    catalogue,
    controlsEnabled: true,
  };
  const bootstrap = await collectVisitor(f.pool, batch, ctx);
  const cookie = bootstrap.cookie.value;
  await collectVisitor(f.pool, batch, { ...ctx, cookie });
  const [[v]] = await f.pool.query("SELECT id FROM visitors");
  const [[s]] = await f.pool.query("SELECT id FROM visitor_sessions");
  f.clock.advance(31 * 60000);
  await collectVisitor(f.pool, batch, { ...ctx, now: f.clock.now(), cookie });
  assert.equal((await service.deleteSession(v.id, s.id, actor)).visitorDeleted, false);
  const [[survivor]] = await f.pool.query("SELECT * FROM visitors");
  assert.equal(survivor.session_count, 1);
  assert.equal(+new Date(survivor.first_seen_at + "Z"), +f.clock.now());
  const [[session]] = await f.pool.query("SELECT * FROM visitor_sessions");
  assert.equal(session.page_count, 1);
  const result = await Promise.allSettled([
    service.deleteVisitors([v.id], actor),
    collectVisitor(f.pool, batch, { ...ctx, cookie, now: f.clock.now() }),
  ]);
  assert.ok(
    result.every((r) => r.status === "fulfilled"),
    JSON.stringify(result),
  );
  assert.equal(
    (
      await f.pool.query(
        "SELECT COUNT(*) n FROM visitor_sessions s LEFT JOIN visitors v ON v.id=s.visitor_id WHERE v.id IS NULL",
      )
    )[0][0].n,
    0,
  );
  assert.equal(
    (
      await f.pool.query(
        "SELECT COUNT(*) n FROM visitor_session_pages p LEFT JOIN visitor_sessions s ON s.id=p.session_id WHERE s.id IS NULL",
      )
    )[0][0].n,
    0,
  );
  for (const row of (
    await f.pool.query(
      "SELECT v.session_count,COUNT(s.id) actual FROM visitors v LEFT JOIN visitor_sessions s ON s.visitor_id=v.id GROUP BY v.id",
    )
  )[0])
    assert.equal(row.session_count, row.actual);
  assert.equal(
    (
      await f.pool.query("SELECT COUNT(*) n FROM audit_logs WHERE action='customer_access.delete'")
    )[0][0].n,
    1,
  );
});

test("collector waiting behind session deletion reads current sessions after obtaining visitor lock", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateVisitorControls } = await import("../dist/visitors/controls-schema.js");
  await migrateVisitorControls(f.pool, directory);
  const { migrateVisitorContext } = await import("../dist/visitors/context-schema.js");
  await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
  const { createVisitorControlsService } = await import("../dist/visitors/controls-service.js");
  const service = createVisitorControlsService(f.pool, f.clock);
  const grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const actor = await f.auth.authenticate(grant.accessToken);
  const catalogue = createCatalogue({
    version: 1,
    routes: [{ path: "/", label: "home" }],
    products: [],
  });
  const batch = { paths: ["/"], products: [], lastPath: "/" };
  const ctx = {
    ip: "8.8.8.8",
    now: f.clock.now(),
    idSecret: "x".repeat(64),
    userAgent: "test",
    catalogue,
    controlsEnabled: true,
    contextEnabled: true,
  };
  const bootstrap = await collectVisitor(f.pool, batch, ctx);
  ctx.cookie = bootstrap.cookie.value;
  await collectVisitor(f.pool, batch, ctx);
  const [[v]] = await f.pool.query("SELECT id FROM visitors");
  const [[s]] = await f.pool.query("SELECT id FROM visitor_sessions");
  const held = await f.pool.getConnection();
  await held.beginTransaction();
  await held.query("SELECT id FROM visitors WHERE id=? FOR UPDATE", [v.id]);
  async function waiting(fragment) {
    for (let n = 0; n < 100; n++) {
      const [r] = await f.pool.query("SHOW PROCESSLIST");
      if (r.some((p) => String(p.Info).includes(fragment))) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.fail("expected lock waiter " + fragment);
  }
  let deleting, collecting;
  try {
    deleting = service.deleteSession(v.id, s.id, actor);
    deleting.catch(() => {});
    await waiting("SELECT id,is_probe FROM visitors WHERE id=");
    collecting = collectVisitor(f.pool, batch, ctx);
    collecting.catch(() => {});
    await waiting("INSERT INTO visitors(id,identity_hash");
  } finally {
    await held.rollback();
    held.release();
  }
  const results = await Promise.allSettled([deleting, collecting]);
  assert.ok(
    results.every((r) => r.status === "fulfilled"),
    JSON.stringify(results),
  );
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitor_sessions"))[0][0].n, 1);
});

test("bulk delete validates bounded unique IDs and is atomic for missing or protected targets", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateVisitorControls } = await import("../dist/visitors/controls-schema.js");
  await migrateVisitorControls(f.pool, directory);
  const { createVisitorControlsService } = await import("../dist/visitors/controls-service.js");
  const service = createVisitorControlsService(f.pool, f.clock);
  const grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const actor = await f.auth.authenticate(grant.accessToken);
  const catalogue = createCatalogue({
    version: 1,
    routes: [{ path: "/", label: "home" }],
    products: [],
  });
  const batch = { paths: ["/"], products: [], lastPath: "/" };
  const ctx = {
    ip: "8.8.8.8",
    now: f.clock.now(),
    idSecret: "x".repeat(64),
    userAgent: "test",
    catalogue,
    controlsEnabled: true,
  };
  for (let n = 0; n < 2; n++) {
    const init = await collectVisitor(f.pool, batch, ctx);
    await collectVisitor(f.pool, batch, { ...ctx, cookie: init.cookie.value });
  }
  const ids = (await f.pool.query("SELECT id FROM visitors ORDER BY id"))[0].map((r) => r.id);
  await assert.rejects(service.deleteVisitors([], actor), { status: 400 });
  await assert.rejects(service.deleteVisitors(Array(101).fill(ids[0]), actor), { status: 400 });
  await assert.rejects(
    service.deleteVisitors([ids[0], "00000000-0000-4000-8000-000000000000"], actor),
    { status: 404 },
  );
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitors"))[0][0].n, 2);
  await f.pool.query("UPDATE visitors SET is_probe=1 WHERE id=?", [ids[1]]);
  await assert.rejects(service.deleteVisitors(ids, actor), { status: 409 });
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitors"))[0][0].n, 2);
  await f.pool.query("UPDATE visitors SET is_probe=0 WHERE id=?", [ids[1]]);
  const result = await service.deleteVisitors(ids, actor);
  assert.equal(result.deletedVisitors, 2);
  assert.equal(result.deletedSessions, 2);
  assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitor_session_pages"))[0][0].n, 0);
  const [[audit]] = await f.pool.query(
    "SELECT metadata FROM audit_logs WHERE action='customer_access.delete'",
  );
  const metadata = typeof audit.metadata === "string" ? JSON.parse(audit.metadata) : audit.metadata;
  assert.deepEqual(metadata.visitorIds, ids);
  assert.equal(metadata.visitorCount, 2);
  assert.equal(metadata.sessionCount, 2);
});

for (const rule of ["8.8.8.*", "1.1.1.*"]) {
  test(`exclusions use persisted verified address precedence over differing relay address: ${rule}`, async (t) => {
    const f = await createAuthFixture(t);
    const { migrateVisitorControls } = await import("../dist/visitors/controls-schema.js");
    await migrateVisitorControls(f.pool, directory);
    const { migrateVisitorContext } = await import("../dist/visitors/context-schema.js");
    await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
    await f.pool.query("UPDATE visitor_exclusion_settings SET rules=?", [JSON.stringify([rule])]);
    const catalogue = createCatalogue({
      version: 1,
      routes: [{ path: "/", label: "home" }],
      products: [],
    });
    const batch = { paths: ["/"], products: [], lastPath: "/" };
    let lookups = 0;
    const ctx = {
      ip: "8.8.8.8",
      peer: "127.0.0.1",
      sourceVerified: true,
      trustedCidrs: ["127.0.0.1/32"],
      now: f.clock.now(),
      idSecret: "x".repeat(64),
      userAgent: "test",
      catalogue,
      controlsEnabled: true,
      contextEnabled: true,
      countryLookup: {
        lookup(ip) {
          lookups++;
          assert.equal(ip, "8.8.8.8");
          return null;
        },
        close() {},
      },
      relayObservation: {
        ip: "1.1.1.1",
        observedAt: f.clock.now(),
        requestId: "c".repeat(32),
        source: "php_relay",
      },
    };
    const result = await collectVisitor(f.pool, batch, ctx);
    if (rule === "8.8.8.*") {
      assert.deepEqual(result, { status: 204 });
      assert.equal(lookups, 0);
      assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitors"))[0][0].n, 0);
      assert.equal(
        (await f.pool.query("SELECT COUNT(*) n FROM analytics_relay_receipts"))[0][0].n,
        1,
      );
    } else {
      assert.equal(result.status, 202);
      await collectVisitor(f.pool, batch, { ...ctx, cookie: result.cookie.value });
      const [[session]] = await f.pool.query("SELECT client_ip,ip_status FROM visitor_sessions");
      assert.equal(session.client_ip, "8.8.8.8");
      assert.equal(session.ip_status, "verified");
      assert.equal(lookups, 1);
    }
  });
}
