import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startDevelopment } from "./dev.mjs";
import { assertPortsFree } from "./process-group.mjs";
import { createProfileAuthFixture } from "../tests/e2e/helpers/profile-fixture.mjs";
import { migrateVisitorContext } from "../backend/dist/visitors/context-schema.js";
import { prepareCountryDataset } from "./prepare-geoip.mjs";
async function port() {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const p = server.address().port;
  await new Promise((r) => server.close(r));
  return p;
}
test(
  "real dev starts FE/BE/PHP with inspector and closes every surface without extra command",
  { timeout: 90000 },
  async (t) => {
    const f = await createProfileAuthFixture(t);
    await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
    const dataset = await prepareCountryDataset();
    const ports = await Promise.all([port(), port(), port()]);
    const directory = await mkdtemp(join(tmpdir(), "bibi-relay-dev-"));
    let service;
    const env = {
      ...f.profileEnv,
      DB_HOST: f.dbConfig.host,
      DB_PORT: String(f.dbConfig.port),
      DB_USER: f.dbConfig.user,
      DB_PASSWORD: f.dbConfig.password,
      DB_NAME: f.dbConfig.database,
      AUTH_JWT_SECRET: f.config.jwtSecret,
      AUTH_ALLOWED_ORIGINS: `http://127.0.0.1:${ports[0]}`,
      ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
      ANALYTICS_RELAY_SECRET: randomBytes(32).toString("base64url"),
      GEOIP_COUNTRY_FILE: dataset.file,
    };
    const before = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    Object.assign(process.env, env);
    try {
      service = await startDevelopment({
        frontendPort: ports[0],
        backendPort: ports[1],
        inspectorPort: ports[2],
        prebundle: false,
        cacheDir: join(directory, "cache"),
      });
      assert.ok(service.relayUrl, "actual API dev must also start PHP");
      const base = `http://127.0.0.1:${ports[0]}`;
      assert.equal((await fetch(base + "/api/ready")).status, 200);
      assert.equal(
        (await (await fetch(service.relayUrl + "/__relay-ready")).json()).runtime,
        "php",
      );
      assert.ok(
        Array.isArray(await (await fetch(`http://127.0.0.1:${ports[2]}/json/list`)).json()),
      );
      const headers = { origin: base, "content-type": "application/json", "X-Bibi-Request": "1" };
      const body = JSON.stringify({ paths: ["/contact"], products: [], lastPath: "/contact" });
      let r = await fetch(base + "/api/analytics/relay/collect.php", {
        method: "POST",
        headers,
        body,
      });
      assert.equal(r.status, 202);
      const cookie = r.headers.getSetCookie()[0];
      assert.match(cookie, /Path=\/api\/analytics/);
      r = await fetch(base + "/api/analytics/relay/collect.php", {
        method: "POST",
        headers: { ...headers, cookie: cookie.split(";")[0] },
        body,
      });
      assert.equal(r.status, 204);
      r = await fetch(base + "/api/analytics/relay/collect.php", {
        method: "POST",
        headers: { ...headers, "X-Forwarded-For": "198.51.100.1" },
        body,
      });
      assert.equal(r.status, 403);
      assert.equal((await r.json()).error.code, "ANALYTICS_RELAY_REJECTED");
      const all = [...ports, Number(new URL(service.relayUrl).port)];
      await service.close();
      await service.close();
      await assertPortsFree(all);
      const relayKey = process.env.ANALYTICS_RELAY_SECRET;
      delete process.env.ANALYTICS_RELAY_SECRET;
      try {
        await assert.rejects(
          startDevelopment({
            frontendPort: ports[0],
            backendPort: ports[1],
            inspectorPort: ports[2],
            prebundle: false,
            cacheDir: join(directory, "failure-cache"),
          }),
          /setup|configuration/i,
        );
      } finally {
        process.env.ANALYTICS_RELAY_SECRET = relayKey;
      }
      await assertPortsFree(ports);
    } finally {
      await service?.close();
      for (const [key, value] of Object.entries(before)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
);
