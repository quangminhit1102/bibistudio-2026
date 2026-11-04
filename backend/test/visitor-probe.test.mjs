import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createVisitorFixture } from "./helpers/visitors.mjs";
import { serve } from "./helpers/http.mjs";
import { createApp } from "../dist/app.js";

test("release probe is signed, release-bound, expires and cannot retag a real visitor", async (t) => {
  const f = await createVisitorFixture(t);
  const { createProbeMarker } = await import("../dist/visitors/probe.js");
  const { cleanupAnalytics } = await import("../dist/visitors/cleanup.js");
  const secret = randomBytes(32).toString("hex");
  const releaseId = "test-release-123";
  const marker = createProbeMarker(secret, releaseId, f.clock.now());
  const base = await serve(
    t,
    createApp(
      { releaseId, sourceSha: "test" },
      {
        config: { allowedOrigins: ["http://localhost:5173"], trustProxy: false },
        clock: f.clock,
        analytics: {
          pool: f.pool,
          idSecret: f.idSecret,
          catalogue: f.catalogue,
          cookieSecure: false,
          probeSecret: secret,
        },
      },
    ),
  );
  const headers = {
    Origin: "http://localhost:5173",
    "Content-Type": "application/json",
    "X-Bibi-Request": "1",
    "X-Bibi-Probe": marker,
  };
  const send = (cookie, extra = {}) =>
    fetch(base + "/api/analytics/collect", {
      method: "POST",
      headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}), ...extra },
      body: JSON.stringify(f.batch),
    });
  assert.equal((await send(undefined, { "X-Bibi-Probe": "forged" })).status, 403);
  const bootstrap = await send();
  assert.equal(bootstrap.status, 202);
  const cookie = bootstrap.headers.get("set-cookie").split(";")[0];
  assert.equal((await send(cookie)).status, 204);
  const [[probe]] = await f.pool.query("SELECT is_probe FROM visitors");
  assert.equal(probe.is_probe, 1);
  await f.collect(f.batch, f.cookie);
  assert.equal((await send(`bibi_visitor=${f.cookie}`)).status, 409);
  const [[real]] = await f.pool.query("SELECT COUNT(*) n FROM visitors WHERE is_probe=0");
  assert.equal(real.n, 1);
  f.clock.advance(24 * 3600000 + 1);
  assert.equal((await send(cookie)).status, 403);
  await cleanupAnalytics(f.pool, f.clock.now(), 10);
  const [[remaining]] = await f.pool.query("SELECT COUNT(*) n FROM visitors");
  assert.equal(remaining.n, 1);
  const [[markers]] = await f.pool.query("SELECT COUNT(*) n FROM release_probes");
  assert.equal(markers.n, 0);
  const otherBase = await serve(
    t,
    createApp(
      { releaseId: "another-release", sourceSha: "test" },
      {
        config: { allowedOrigins: ["http://localhost:5173"], trustProxy: false },
        clock: f.clock,
        analytics: {
          pool: f.pool,
          idSecret: f.idSecret,
          catalogue: f.catalogue,
          cookieSecure: false,
          probeSecret: secret,
        },
      },
    ),
  );
  assert.equal(
    (
      await fetch(otherBase + "/api/analytics/collect", {
        method: "POST",
        headers: {
          ...headers,
          "X-Bibi-Probe": createProbeMarker(secret, releaseId, f.clock.now()),
        },
        body: JSON.stringify(f.batch),
      })
    ).status,
    403,
  );
});
