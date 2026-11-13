import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash, createHmac } from "node:crypto";
import { resolve } from "node:path";
import { createVisitorFixture } from "./helpers/visitors.mjs";
import { serve } from "./helpers/http.mjs";
import { createApp } from "../dist/app.js";
import { migrateVisitorContext } from "../dist/visitors/context-schema.js";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const b64 = (s) => Buffer.from(s).toString("base64url");
test("HTTP verifies exact signed bytes before collection, legacy stays unknown and auth trust unchanged", async (t) => {
  const f = await createVisitorFixture(t);
  await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
  const secret = randomBytes(32).toString("base64url");
  const origin = "http://localhost:5173",
    ua = "relay-test";
  const app = createApp(
    { releaseId: "test", sourceSha: "test" },
    {
      clock: f.clock,
      config: { allowedOrigins: [origin], trustProxy: false },
      analytics: {
        pool: f.pool,
        idSecret: f.idSecret,
        catalogue: f.catalogue,
        cookieSecure: true,
        relaySecret: secret,
        countryLookup: {
          lookup() {
            return { code: "US", name: "United States", dataset: "fixture" };
          },
          close() {},
        },
      },
    },
  );
  const base = await serve(t, app);
  const body = JSON.stringify(f.batch) + "\n";
  function headers(cookie = f.cookie, privacy = false) {
    const raw = [
      "bibi-analytics-v1",
      Math.floor(+f.clock.now() / 1000),
      randomBytes(16).toString("hex"),
      "POST",
      "/api/analytics/collect",
      sha(body),
      "8.8.8.8",
      b64(origin),
      sha(cookie),
      b64(ua),
      privacy ? "1" : "0",
      "0",
      "",
    ].join("\n");
    return {
      "Content-Type": "application/json",
      Origin: origin,
      "User-Agent": ua,
      "X-Bibi-Request": "1",
      Cookie: cookie ? "bibi_visitor=" + cookie : "",
      "X-Bibi-Relay-Context": b64(raw),
      "X-Bibi-Relay-Signature": createHmac("sha256", Buffer.from(secret, "base64url"))
        .update(raw)
        .digest("hex"),
      ...(privacy ? { DNT: "1" } : {}),
    };
  }
  const send = (h, data = body) =>
    fetch(base + "/api/analytics/collect", { method: "POST", headers: h, body: data });
  const valid = headers();
  for (const patch of [
    { "X-Bibi-Relay-Signature": "0".repeat(64) },
    { Cookie: "bibi_visitor=other" },
    { "User-Agent": "other" },
    { DNT: "1" },
    { Cookie: "bibi_visitor=" + f.cookie + "; bibi_visitor=other" },
    {
      "X-Bibi-Relay-Context": valid["X-Bibi-Relay-Context"] + ", " + valid["X-Bibi-Relay-Context"],
    },
  ])
    assert.equal((await send({ ...valid, ...patch })).status, 403);
  assert.equal(
    (await send(valid, JSON.stringify({ ...f.batch, lastPath: "/contact" }))).status,
    403,
  );
  for (const table of [
    "visitors",
    "visitor_sessions",
    "analytics_relay_receipts",
    "rate_limit_counters",
  ])
    assert.equal((await f.pool.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n, 0);
  assert.equal((await send(headers("", true))).status, 204);
  assert.equal((await send(headers(""))).status, 202);
  assert.equal((await send(valid)).status, 204);
  assert.equal((await send(valid)).status, 409);
  const [[row]] = await f.pool.query("SELECT * FROM visitor_sessions");
  assert.equal(row.ip_status, "observed");
  assert.equal(row.client_ip, "8.8.8.8");
  assert.equal(row.country_code, "US");
  const direct = headers();
  delete direct["X-Bibi-Relay-Context"];
  delete direct["X-Bibi-Relay-Signature"];
  delete direct.Cookie;
  const bootstrap = await send(direct);
  assert.equal(bootstrap.status, 202);
  direct.Cookie = bootstrap.headers.getSetCookie()[0].split(";")[0];
  assert.equal((await send({ ...direct, "X-Forwarded-For": "1.1.1.1" })).status, 204);
  const [sessions] = await f.pool.query("SELECT ip_status,client_ip FROM visitor_sessions");
  assert.ok(sessions.some((s) => s.ip_status === "unavailable" && s.client_ip === null));
  assert.equal(app.get("trust proxy"), false);
});
