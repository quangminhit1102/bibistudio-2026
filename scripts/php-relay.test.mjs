import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { startPhpRelay } from "./php-relay.mjs";
import { verifyRelayContext } from "../backend/dist/visitors/relay-context.js";
test(
  "real PHP server forwards only anonymous context, preserves cookies and contains failures",
  { timeout: 60000 },
  async (t) => {
    const dir = await mkdtemp(join(tmpdir(), "bibi-relay-"));
    let relay;
    let mode = "normal";
    const seen = [];
    const upstream = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      seen.push({ headers: req.headers, body, url: req.url });
      if (mode === "unsafe-cookie") {
        res.writeHead(202, {
          "set-cookie":
            "bibi_visitor=synthetic; Path=/api/analytics; Path=/; HttpOnly; SameSite=Lax",
        });
        res.end();
        return;
      }
      if (mode === "timeout") {
        setTimeout(() => res.end("{}"), 6000).unref();
        return;
      }
      if (mode === "oversize") {
        res.setHeader("content-type", "application/json");
        res.end("x".repeat(65537));
        return;
      }
      if (mode === "redirect") {
        res.writeHead(302, { location: "http://example.invalid/" });
        res.end();
        return;
      }
      if (mode === "rate") {
        res.writeHead(429, { "content-type": "application/json" });
        res.end('{"error":{"code":"TOO_MANY_REQUESTS"}}');
        return;
      }
      res.writeHead(202, {
        "set-cookie": [
          "bibi_visitor=synthetic; Path=/api/analytics; HttpOnly; SameSite=Lax",
          "bibi_refresh=never-forward; Path=/api/auth; HttpOnly",
        ],
        "content-type": "application/json",
      });
      res.end("{}");
    });
    upstream.listen(0, "0.0.0.0");
    await once(upstream, "listening");
    const secret = Buffer.alloc(32, 7).toString("base64url");
    const configFile = join(dir, "config.json");
    await writeFile(
      configFile,
      JSON.stringify({
        environment: "local",
        secret,
        targetUrl: `http://host.docker.internal:${upstream.address().port}/api/analytics/collect`,
        origins: ["http://localhost:5173"],
      }),
      { mode: 0o600 },
    );
    const routerFile = join(dir, "router.php");
    await writeFile(
      routerFile,
      "<?php $_SERVER['REMOTE_ADDR']='8.8.8.8'; require '/router/default.php';",
    );
    try {
      relay = await startPhpRelay({
        port: 0,
        targetUrl: `http://host.docker.internal:${upstream.address().port}/api/analytics/collect`,
        configFile,
        sourceDirectory: resolve("backend/relay"),
        routerFile,
      });
      const request = (extra = {}) =>
        fetch(relay.url + "/api/analytics/relay/collect.php", {
          method: "POST",
          headers: {
            origin: "http://localhost:5173",
            "content-type": "application/json",
            "user-agent": "test-browser",
            ...extra.headers,
          },
          body: extra.body ?? "{}",
        });
      await t.test("canonical envelope binds exact bytes and excludes auth", async () => {
        const r = await request({
          headers: {
            cookie: "auth=private; bibi_visitor=synthetic",
            authorization: "Bearer never-forward",
            dnt: "1",
            "sec-gpc": "1",
          },
        });
        assert.equal(r.status, 202);
        assert.deepEqual(r.headers.getSetCookie(), [
          "bibi_visitor=synthetic; Path=/api/analytics; HttpOnly; SameSite=Lax",
        ]);
        const row = seen.at(-1);
        assert.equal(row.url, "/api/analytics/collect");
        assert.equal(row.headers["x-bibi-request"], "1");
        assert.equal(row.headers.authorization, undefined);
        assert.equal(row.headers.cookie, "bibi_visitor=synthetic");
        assert.equal(row.headers.dnt, "1");
        assert.equal(row.headers["sec-gpc"], "1");
        assert.equal(
          verifyRelayContext({
            context: row.headers["x-bibi-relay-context"],
            signature: row.headers["x-bibi-relay-signature"],
            rawBody: Buffer.from(row.body),
            cookie: "synthetic",
            origin: row.headers.origin,
            userAgent: row.headers["user-agent"],
            dnt: true,
            gpc: true,
            now: new Date(),
            secret,
          }).ip,
          "8.8.8.8",
        );
      });
      await t.test(
        "input method/origin/body/header/cookie attacks never reach upstream",
        async () => {
          const before = seen.length;
          assert.equal((await fetch(relay.url + "/api/analytics/relay/collect.php")).status, 405);
          for (const headers of [
            { origin: "http://evil.test" },
            { "x-forwarded-for": "198.51.100.1" },
            { x_real_ip: "198.51.100.1" },
            { "x-bibi-relay-context": "forged" },
            { cookie: "bibi_visitor=a; bibi_visitor=b" },
          ])
            assert.equal((await request({ headers })).status, 403);
          assert.equal((await request({ body: "x".repeat(16385) })).status, 413);
          assert.equal((await request({ body: "broken" })).status, 400);
          assert.equal(seen.length, before);
          assert.equal((await fetch(relay.url + "/context.php")).status, 404);
        },
      );
      await t.test(
        "bounded upstream failures, no redirects, rate/privacy status propagation",
        async () => {
          for (const failure of ["unsafe-cookie", "oversize", "redirect", "timeout"]) {
            mode = failure;
            const start = Date.now();
            assert.equal((await request()).status, 502);
            assert.ok(Date.now() - start < 6500);
          }
          mode = "rate";
          assert.equal((await request()).status, 429);
        },
      );
      const url = relay.url;
      await relay.close();
      await relay.close();
      await assert.rejects(fetch(url + "/__relay-ready"));
      mode = "normal";
      relay = await startPhpRelay({
        port: 0,
        targetUrl: `http://host.docker.internal:${upstream.address().port}/api/analytics/collect`,
        configFile,
        sourceDirectory: resolve("backend/relay"),
      });
      assert.equal((await request()).status, 202);
      assert.equal(
        seen.at(-1).headers["x-bibi-relay-context"],
        undefined,
        "private local peer remains unknown, never fabricated",
      );
      await relay.close();
      const docker = (args) =>
        execFileSync(
          "docker",
          [...(process.platform === "win32" ? ["--context", "desktop-linux"] : []), ...args],
          {
            encoding: "utf8",
            windowsHide: true,
            env: { ...process.env, DOCKER_API_VERSION: "1.43" },
          },
        ).trim();
      const before = docker(["ps", "-aq", "--filter", "label=com.bibi.local-relay"]);
      const occupied = createServer();
      occupied.listen(0, "127.0.0.1");
      await once(occupied, "listening");
      try {
        await assert.rejects(
          startPhpRelay({
            port: occupied.address().port,
            targetUrl: `http://host.docker.internal:${upstream.address().port}/api/analytics/collect`,
            configFile,
            sourceDirectory: resolve("backend/relay"),
          }),
        );
      } finally {
        await new Promise((r) => occupied.close(r));
      }
      assert.equal(
        docker(["ps", "-aq", "--filter", "label=com.bibi.local-relay"]),
        before,
        "failed start leaves no owned container",
      );
    } finally {
      await relay?.close();
      upstream.closeAllConnections();
      await new Promise((r) => upstream.close(r));
      await rm(dir, { recursive: true, force: true });
    }
  },
);

test("runtime image first download has its own bounded preparation deadline", async () => {
  const { ensurePhpImage } = await import("./php-relay.mjs");
  assert.equal(typeof ensurePhpImage, "function");
  const calls = [];
  const run = async (args, options) => {
    calls.push({ args, options });
    if (args[0] === "image") throw new Error("not cached");
    return { stdout: "" };
  };
  await ensurePhpImage(run);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].args[0], "pull");
  assert.match(calls[1].args[1], /^php:8\.4-cli@sha256:/);
  assert.equal(calls[1].options.timeout, 120000);
});
