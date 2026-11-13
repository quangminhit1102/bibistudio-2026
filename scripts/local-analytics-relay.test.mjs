import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, stat } from "node:fs/promises";
import { startLocalAnalyticsRelay } from "./local-analytics-relay.mjs";
test("local relay owns a private config, keeps secret out of URL and frees its files/port", async () => {
  const upstream = createServer((req, res) => {
    res.writeHead(204);
    res.end();
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  let relay;
  try {
    relay = await startLocalAnalyticsRelay({
      env: {
        ANALYTICS_RELAY_SECRET: Buffer.alloc(32, 2).toString("base64url"),
        AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
      },
      backendPort: upstream.address().port,
      frontendPort: 5173,
    });
    const config = JSON.parse(await readFile(relay.configFile, "utf8"));
    assert.equal(config.environment, "local");
    assert.ok(!relay.url.includes(config.secret));
    assert.ok(!config.targetUrl.includes(config.secret));
    assert.ok(config.origins.includes("http://localhost:5173"));
    if (process.platform !== "win32")
      assert.equal((await stat(relay.configFile)).mode & 0o777, 0o600);
    assert.equal((await (await fetch(relay.url + "/__relay-ready")).json()).runtime, "php");
    const r = await fetch(relay.url + "/api/analytics/relay/collect.php", {
      method: "POST",
      headers: { origin: "http://localhost:5173", "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(r.status, 204, "PHP can reach loopback-only Node on this host");
    const path = relay.configFile,
      url = relay.url;
    await relay.close();
    await relay.close();
    await assert.rejects(stat(path), { code: "ENOENT" });
    await assert.rejects(fetch(url + "/__relay-ready"));
    await assert.rejects(
      startLocalAnalyticsRelay({
        env: {},
        backendPort: upstream.address().port,
        frontendPort: 5173,
      }),
      /setup|configuration/i,
    );
  } finally {
    await relay?.close();
    upstream.closeAllConnections();
    await new Promise((r) => upstream.close(r));
  }
});
