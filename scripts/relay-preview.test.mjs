import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, cp, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import metadata from "../ops/database-metadata.cjs";
import { createAuthFixture } from "../backend/test/helpers/auth.mjs";
import { migrateVisitorContext } from "../backend/dist/visitors/context-schema.js";
import { previewRelease } from "./preview.mjs";
import { makeManifest } from "./release-manifest.mjs";
import { prepareCountryDataset } from "./prepare-geoip.mjs";
import { root } from "./runtime.mjs";
test("compiled local preview includes real PHP proxy and closes relay, pools and links", async (t) => {
  const f = await createAuthFixture(t, { visitorControls: true });
  await migrateVisitorContext(f.pool, join(root, "backend/visitor-context-migrations"));
  await prepareCountryDataset();
  const dir = await mkdtemp(join(tmpdir(), "bibi-relay-preview-"));
  let app;
  try {
    await mkdir(join(dir, "frontend/assets"), { recursive: true });
    await mkdir(join(dir, "backend"));
    await writeFile(join(dir, "frontend/index.html"), "<html>Relay preview</html>");
    const manifest = makeManifest(
      "a".repeat(40),
      null,
      await metadata.createDatabaseMetadata(join(root, "backend")),
    );
    for (const name of ["manifest.json", "frontend/version.json"])
      await writeFile(join(dir, name), JSON.stringify(manifest));
    for (const name of [
      "dist",
      "migrations",
      "visitor-migrations",
      "visitor-context-migrations",
      "visitor-controls-migrations",
      "geoip",
      "relay",
    ])
      await cp(join(root, "backend", name), join(dir, "backend", name), { recursive: true });
    for (const name of ["package.json", "package-lock.json", "analytics-catalogue.json"])
      await cp(join(root, "backend", name), join(dir, "backend", name));
    const env = {
      DB_HOST: f.dbConfig.host,
      DB_PORT: String(f.dbConfig.port),
      DB_NAME: f.dbConfig.database,
      DB_USER: f.dbConfig.user,
      DB_PASSWORD: f.dbConfig.password,
      AUTH_JWT_SECRET: f.config.jwtSecret,
      AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
      ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
      ANALYTICS_RELAY_SECRET: randomBytes(32).toString("base64url"),
      GEOIP_COUNTRY_FILE: join(dir, "backend/geoip/country.mmdb"),
    };
    app = await previewRelease(dir, { port: 0, runtimeEnv: env });
    assert.ok(app.relayUrl, "preview must start PHP for a context-enabled runtime");
    assert.equal((await (await fetch(app.relayUrl + "/__relay-ready")).json()).runtime, "php");
    const headers = { origin: app.url, "content-type": "application/json", "X-Bibi-Request": "1" };
    const body = JSON.stringify({ paths: ["/contact"], products: [], lastPath: "/contact" });
    const r = await fetch(app.url + "/api/analytics/relay/collect.php", {
      method: "POST",
      headers,
      body,
    });
    assert.equal(r.status, 202);
    assert.match(r.headers.getSetCookie()[0], /Path=\/api\/analytics/);
    const rejected = await fetch(app.url + "/api/analytics/relay/collect.php", {
      method: "POST",
      headers: { ...headers, "X-Real-IP": "198.51.100.1" },
      body,
    });
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json()).error.code, "ANALYTICS_RELAY_REJECTED");
    assert.equal((await fetch(app.url + "/api/ready")).status, 200);
    const url = app.relayUrl;
    await app.close();
    await app.close();
    await assert.rejects(lstat(join(dir, "backend/node_modules")), { code: "ENOENT" });
    await assert.rejects(fetch(url + "/__relay-ready"));
  } finally {
    await app?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
