import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../dist/app.js";
import { createVisitorFixture } from "./helpers/visitors.mjs";
import { serve } from "./helpers/http.mjs";

test("collector HTTP requires origin, separates cookies, honors privacy and never trusts forwarded IP", async (t) => {
  const f = await createVisitorFixture(t);
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      {
        config: { allowedOrigins: ["http://localhost:5173"], trustProxy: false },
        clock: f.clock,
        analytics: {
          pool: f.pool,
          idSecret: f.idSecret,
          catalogue: f.catalogue,
          cookieSecure: true,
        },
      },
    ),
  );
  const headers = {
    Origin: "http://localhost:5173",
    "Content-Type": "application/json",
    "X-Bibi-Request": "1",
  };
  const send = (extra = {}, body = f.batch) =>
    fetch(base + "/api/analytics/collect", {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
  assert.equal((await send({ Origin: "https://evil.example" })).status, 403);
  assert.equal((await send({ DNT: "1" })).status, 204);
  assert.equal((await send({ "Sec-GPC": "1" })).headers.get("set-cookie"), null);
  const bootstrap = await send();
  assert.equal(bootstrap.status, 202);
  assert.equal(await bootstrap.text(), "");
  const cookie = bootstrap.headers.get("set-cookie");
  for (const pattern of [/HttpOnly/i, /Secure/i, /SameSite=Lax/i, /Path=\/api\/analytics/i])
    assert.match(cookie, pattern);
  assert.doesNotMatch(cookie, /Domain=/i);
  const ack = await send({ Cookie: cookie.split(";")[0], "X-Forwarded-For": "203.0.113.123" });
  assert.equal(ack.status, 204);
  assert.equal(await ack.text(), "");
  const [[visitor]] = await f.pool.query("SELECT ip_prefix FROM visitors");
  assert.equal(visitor.ip_prefix, "127.0.0.0/24");
  const optout = await fetch(base + "/api/analytics/opt-out", {
    method: "POST",
    headers: { ...headers, Cookie: cookie.split(";")[0] + "; bibi_refresh=untouched" },
    body: "{}",
  });
  assert.equal(optout.status, 204);
  assert.match(optout.headers.get("set-cookie"), /Path=\/api\/analytics/);
  assert.doesNotMatch(optout.headers.get("set-cookie"), /bibi_refresh/);
  const [[count]] = await f.pool.query("SELECT COUNT(*) n FROM visitors");
  assert.equal(count.n, 1);
});

test("visitor rate limit rejects burst without recording additional associations", async (t) => {
  const f = await createVisitorFixture(t);
  for (let i = 0; i < 10; i++) assert.equal((await f.collect(f.batch, f.cookie)).status, 204);
  await assert.rejects(
    f.collect({ paths: ["/contact"], products: [], lastPath: "/contact" }, f.cookie),
    (error) => error.status === 429,
  );
  const [[row]] = await f.pool.query("SELECT page_count FROM visitor_sessions");
  assert.equal(row.page_count, 1);
  f.clock.advance(60001);
  assert.equal((await f.collect(f.batch, f.cookie)).status, 204);
});

test(
  "collector saturation rejects a third batch immediately without an unbounded SQL queue",
  { timeout: 12000 },
  async (t) => {
    const f = await createVisitorFixture(t);
    await f.collect(f.batch, f.cookie);
    const base = await serve(
      t,
      createApp(
        { releaseId: "test", sourceSha: "test" },
        {
          config: { allowedOrigins: ["http://localhost:5173"], trustProxy: false },
          clock: f.clock,
          analytics: {
            pool: f.pool,
            idSecret: f.idSecret,
            catalogue: f.catalogue,
            cookieSecure: false,
          },
        },
      ),
    );
    const lock = await f.pool.getConnection();
    await lock.beginTransaction();
    await lock.query("SELECT id FROM visitors FOR UPDATE");
    const send = () =>
      fetch(base + "/api/analytics/collect", {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
          "X-Bibi-Request": "1",
          Cookie: `bibi_visitor=${f.cookie}`,
        },
        body: JSON.stringify(f.batch),
      });
    const pending = [send(), send()];
    try {
      // Wait for actual blocked ingestion queries, not an assumed network delay.
      const deadline = Date.now() + 5000;
      let blocked = 0;
      while (blocked < 2 && Date.now() < deadline) {
        const [[row]] = await f.pool.query(
          "SELECT COUNT(*) n FROM information_schema.processlist WHERE DB=? AND INFO LIKE 'INSERT INTO visitors%'",
          [f.config.database],
        );
        blocked = Number(row.n);
        if (blocked < 2) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(blocked, 2);
      assert.equal((await send()).status, 503);
    } finally {
      await lock.rollback();
      lock.release();
      assert.deepEqual(
        (await Promise.all(pending)).map((response) => response.status),
        [204, 204],
      );
    }
  },
);
