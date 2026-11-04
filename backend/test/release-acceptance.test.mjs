import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";
import { createApp } from "../dist/app.js";
import { createCatalogue } from "../dist/visitors/catalogue.js";
test("release-only identity is idempotent, unprivileged and refuses changed grants", async (t) => {
  const { seedProbeIdentity } = await import("../dist/db/probe-identity.js");
  const f = await createAuthFixture(t);
  const password = "Only-test-Probe!777";
  await seedProbeIdentity(f.pool, password);
  const first = await f.auth.login({ username: "bibi_release_probe", password });
  assert.equal(first.profile.isMaster, false);
  assert.equal(first.profile.fullAccess, false);
  assert.deepEqual(first.profile.permissions, []);
  await seedProbeIdentity(f.pool, "Only-test-Changed!888");
  await f.auth.login({ username: "bibi_release_probe", password });
  await f.pool.execute("INSERT INTO user_roles(user_id,role_id) VALUES (?,'system-user')", [first.profile.id]);
  await assert.rejects(seedProbeIdentity(f.pool, password), /probe/i);
});
test("real HTTP release acceptance checks restricted login, refresh/logout and tagged product interest", async (t) => {
  const { seedProbeIdentity } = await import("../dist/db/probe-identity.js");
  const { verifyReleaseProbe } = await import("../dist/db/release-probe.js");
  const f = await createAuthFixture(t);
  f.clock.set(new Date());
  const secret = randomBytes(32).toString("hex");
  const password = "Only-test-Probe!777";
  await seedProbeIdentity(f.pool, password);
  const catalogue = createCatalogue({ version: 1, routes: [{ path: "/products/test-notebook", label: "Test" }], products: [{ slug: "test-notebook", name: "Test" }] });
  const release = { releaseId: "a".repeat(40) + "-123", sourceSha: "a".repeat(40) };
  const baseUrl = await serve(t, createApp(release, {
    db: f.pool, config: f.config, clock: { now: () => new Date() },
    analytics: { pool: f.pool, catalogue, cookieSecure: false, idSecret: randomBytes(32).toString("hex"), probeSecret: secret },
  }));
  const options = { pool: f.pool, baseUrl, origin: f.config.allowedOrigins[0], secret, password, release, catalogue, allowLocal: true };
  const receipt = await verifyReleaseProbe(options);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.auth, true);
  assert.equal(receipt.rbac, true);
  assert.equal(receipt.analytics, true);
  const [[row]] = await f.pool.query("SELECT COUNT(*) n FROM refresh_token_sessions s JOIN users u ON u.id=s.user_id WHERE u.username='bibi_release_probe' AND s.revoked_at IS NULL");
  assert.equal(row.n, 0);
  await assert.rejects(verifyReleaseProbe({ ...options, release: { ...release, releaseId: "wrong-release" } }));
  await f.pool.query("UPDATE users SET active=0 WHERE username='bibi_release_probe'");
  await assert.rejects(verifyReleaseProbe(options));
});
