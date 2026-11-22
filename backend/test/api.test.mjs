import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createApp } from "../dist/app.js";

const release = { releaseId: "a".repeat(40) + "-123", sourceSha: "a".repeat(40) };
async function serve(t) {
  const server = createServer(createApp(release));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}
test("public API serves health and the supplied release, with no sample endpoint", async (t) => {
  const base = await serve(t);
  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200);
  assert.match(health.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await health.json(), { ok: true });
  assert.deepEqual(await (await fetch(base + "/api/version")).json(), release);
  const demo = await fetch(base + "/api/demo");
  assert.equal(demo.status, 404);
  assert.deepEqual(await demo.json(), { error: "Not found" });
});
test("unknown API routes are JSON 404; unsupported methods are 405", async (t) => {
  const base = await serve(t);
  const missing = await fetch(base + "/api/unknown");
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "Not found" });
  const method = await fetch(base + "/api/health", { method: "POST" });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, HEAD");
  assert.deepEqual(await method.json(), { error: "Method not allowed" });
});
test("compiled CommonJS server starts inside an ESM repo and serves HTTP", async (t) => {
  const { createAuthFixture } = await import("./helpers/auth.mjs");
  const { randomBytes } = await import("node:crypto");
  const fixture = await createAuthFixture(t, { visitorControls: true, content: true });
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      PORT: "0",
      HOST: "127.0.0.1",
      DB_HOST: fixture.dbConfig.host,
      DB_PORT: String(fixture.dbConfig.port),
      DB_NAME: fixture.dbConfig.database,
      DB_USER: fixture.dbConfig.user,
      DB_PASSWORD: fixture.dbConfig.password,
      AUTH_JWT_SECRET: fixture.config.jwtSecret,
      AUTH_ALLOWED_ORIGINS: "http://127.0.0.1:1",
      ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());
  let output = "";
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server startup timed out: " + output)), 10000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/BIBI_API_READY (http:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("server exited: " + code));
    });
  });
  const base = await ready;
  assert.deepEqual(await (await fetch(base + "/api/health")).json(), { ok: true });
  assert.equal((await fetch(base + "/api/ready")).status, 200);
});
