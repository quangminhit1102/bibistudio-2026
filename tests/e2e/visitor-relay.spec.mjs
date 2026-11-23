import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { createProfileAuthFixture } from "./helpers/profile-fixture.mjs";
import { createRuntime } from "../../backend/dist/runtime.js";
import { createApp } from "../../backend/dist/app.js";
import { migrateVisitorContext } from "../../backend/dist/visitors/context-schema.js";
import { prepareCountryDataset } from "../../scripts/prepare-geoip.mjs";
import { startLocalAnalyticsRelay } from "../../scripts/local-analytics-relay.mjs";

// The tracker's batch interval (`schedule()` in src/lib/visitor-tracker.ts).
const BATCH_MS = 15000;

test(
  "browser to real PHP to Express/MySQL: identity, snapshots, privacy, replay and bounded fallback",
  { timeout: 240000 },
  async (t) => {
    const cleanup = [];
    const f = await createProfileAuthFixture({ after: (fn) => cleanup.push(fn) });
    await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
    f.clock.set(new Date());
    const dataset = await prepareCountryDataset();
    const dir = await mkdtemp(join(tmpdir(), "bibi-relay-browser-"));
    const routerFile = join(dir, "router.php");
    // Keep PHP source immutable: opcode cache may retain a rewritten router for two seconds.
    // Only this private test router reads fixturePeer; deployable PHP has no such hook.
    await writeFile(
      routerFile,
      `<?php $fixture=json_decode(file_get_contents(getenv('BIBI_RELAY_CONFIG_FILE')),true); $_SERVER['REMOTE_ADDR']=$fixture['fixturePeer']??'8.8.8.8'; require '/router/default.php';`,
    );
    const setPeer = async (ip) => {
      const config = JSON.parse(await readFile(relay.configFile, "utf8"));
      await writeFile(relay.configFile, JSON.stringify({ ...config, fixturePeer: ip }), {
        mode: 0o600,
      });
    };
    let runtime, backend, frontend, relay, browser;
    let failLookup = false;
    const captured = [];
    const previous = { backend: process.env.BACKEND_PORT, relay: process.env.LOCAL_PHP_RELAY_URL };
    try {
      const secret = randomBytes(32).toString("base64url");
      const env = {
        ...f.profileEnv,
        DB_HOST: f.dbConfig.host,
        DB_PORT: String(f.dbConfig.port),
        DB_USER: f.dbConfig.user,
        DB_PASSWORD: f.dbConfig.password,
        DB_NAME: f.dbConfig.database,
        AUTH_JWT_SECRET: f.config.jwtSecret,
        AUTH_JWT_ISSUER: f.config.jwtIssuer,
        AUTH_JWT_AUDIENCE: f.config.jwtAudience,
        AUTH_ALLOWED_ORIGINS: "http://127.0.0.1:1",
        ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
        ANALYTICS_RELAY_SECRET: secret,
        GEOIP_COUNTRY_FILE: dataset.file,
      };
      runtime = createRuntime(env);
      const realLookup = runtime.appOptions.analytics.countryLookup;
      runtime.appOptions.analytics.countryLookup = {
        lookup: (ip) => (failLookup ? null : realLookup.lookup(ip)),
        close: () => realLookup.close(),
      };
      const app = createApp(
        { releaseId: "relay-browser", sourceSha: "isolated-test", schemaVersion: 6 },
        runtime.appOptions,
      );
      backend = createServer((req, res) => {
        if (req.url === "/api/analytics/collect" && req.headers["x-bibi-relay-context"]) {
          const record = { headers: { ...req.headers }, body: [] };
          captured.push(record);
          req.on("data", (chunk) => record.body.push(chunk));
        }
        app(req, res);
      });
      backend.listen(0, "127.0.0.1");
      await once(backend, "listening");
      process.env.BACKEND_PORT = String(backend.address().port);
      const reservation = createServer();
      reservation.listen(0, "127.0.0.1");
      await once(reservation, "listening");
      const frontendPort = reservation.address().port;
      await new Promise((done) => reservation.close(done));
      const base = "http://127.0.0.1:" + frontendPort;
      runtime.appOptions.config.allowedOrigins.splice(0, 1, base);
      relay = await startLocalAnalyticsRelay({
        env: { ...env, AUTH_ALLOWED_ORIGINS: base },
        backendPort: backend.address().port,
        frontendPort,
        routerFile,
      });
      process.env.LOCAL_PHP_RELAY_URL = relay.url;
      frontend = await createViteServer({
        configFile: resolve("vite.local.config.ts"),
        cacheDir: resolve(".superpowers/e2e/visitor-relay-vite"),
        server: {
          host: "127.0.0.1",
          port: Number(new URL(base).port),
          strictPort: true,
          watch: {
            ignored: [
              "**/.superpowers/**",
              "**/.releases/**",
              "**/dist-cpanel/**",
              "**/.output/**",
              "**/backend/dist/**",
            ],
          },
        },
        logLevel: "error",
      });
      await frontend.listen();
      console.log("relay-e2e: Vite/PHP ready");
      browser = await chromium.launch();
      t.signal.addEventListener(
        "abort",
        () => {
          void browser.close().catch(() => {});
        },
        { once: true },
      );
      console.log("relay-e2e: browser ready");
      const makeContext = async (options) => {
        const c = await browser.newContext(options);
        await c.route(/^https:\/\/fonts\.googleapis\.com\//, (route) =>
          route.fulfill({ contentType: "text/css", body: "/* offline fonts */" }),
        );
        return c;
      };
      const context = await makeContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      // The tracker arms its batch timer only after the dynamically imported
      // runtime and all of its module dependencies have loaded. Record that
      // moment so the test never advances a clock the tracker is not on yet.
      const watchBatchTimer = (p) =>
        p.addInitScript((batchMs) => {
          const schedule = window.setTimeout;
          window.setTimeout = function (handler, delay, ...rest) {
            if (delay === batchMs) window.__batchTimerArmed = true;
            return schedule.call(window, handler, delay, ...rest);
          };
        }, BATCH_MS);
      const page = await context.newPage();
      await page.clock.install({ time: Date.now() });
      await watchBatchTimer(page);
      console.log("relay-e2e: clock installed");
      page.setDefaultTimeout(20000);
      page.setDefaultNavigationTimeout(90000);
      await page.route(/^https:\/\/fonts\.googleapis\.com\//, (route) =>
        route.fulfill({ contentType: "text/css", body: "/* offline fonts */" }),
      );
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const evidence = resolve(".superpowers/e2e/visitor-relay");
      await mkdir(evidence, { recursive: true });
      async function go(p, path, { armed = !path.startsWith("/admin") } = {}) {
        console.log("relay-e2e: navigating " + path);
        await p.clock.resume();
        // The Vite development server holds a live HMR connection, so
        // `networkidle` is not a reliable definition of page readiness here.
        // The following assertions exercise the real relay and page behavior.
        const trackingReady =
          path.startsWith("/admin")
            ? undefined
            : p.waitForResponse(
                (response) =>
                  new URL(response.url()).pathname.endsWith("/src/lib/visitor-runtime.ts"),
                { timeout: 20000 },
              );
        await p.goto(base + path, { waitUntil: "domcontentloaded", timeout: 90000 });
        if (trackingReady) {
          await trackingReady;
          // The runtime module response precedes its own imports and React's
          // effect that creates the tracker. Wait for the tracker itself before
          // freezing the test clock; a page with a privacy signal never arms it.
          if (armed) await p.waitForFunction(() => window.__batchTimerArmed === true);
          else
            await p.evaluate(
              () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
            );
        }
        console.log("relay-e2e: loaded " + path);
        if (!path.startsWith("/admin"))
          await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
      }
      const acknowledgements = [];
      page.on("response", (r) => {
        if (new URL(r.url()).pathname === "/api/analytics/relay/collect.php")
          acknowledgements.push(r.status());
      });
      async function tick(
        p = page,
        predicate = (r) => new URL(r.url()).pathname === "/api/analytics/relay/collect.php",
      ) {
        f.clock.set(new Date());
        const response = p.waitForResponse(predicate, { timeout: 20000 });
        console.log("relay-e2e: advancing batch timer");
        await p.clock.fastForward(BATCH_MS + 50);
        const result = await response;
        console.log("relay-e2e: batch HTTP " + result.status());
        await result.finished();
        await p.waitForTimeout(50);
        return result;
      }
      await go(page, "/products/da-lat-map-notebook");
      for (
        let attempt = 0;
        attempt < 3 &&
        (await f.pool.query("SELECT COUNT(*) n FROM visitor_sessions"))[0][0].n === 0;
        attempt++
      )
        await tick();
      assert.ok(
        acknowledgements.includes(202) && acknowledgements.includes(204),
        "actual cookie bootstrap transitions 202 to 204",
      );
      const cookie = (await context.cookies()).find((c) => c.name === "bibi_visitor");
      assert.ok(cookie);
      assert.equal(cookie.path, "/api/analytics");
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.sameSite, "Lax");
      let [rows] = await f.pool.query("SELECT * FROM visitor_sessions");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].ip_status, "observed");
      assert.equal(rows[0].client_ip, "8.8.8.8");
      assert.equal(rows[0].country_code, "US");
      const firstId = rows[0].id;
      const envelope = captured.at(-1);
      const replayHeaders = { ...envelope.headers };
      delete replayHeaders.host;
      delete replayHeaders["content-length"];
      delete replayHeaders.connection;
      const repeats = await Promise.all([
        fetch(`http://127.0.0.1:${backend.address().port}/api/analytics/collect`, {
          method: "POST",
          headers: replayHeaders,
          body: Buffer.concat(envelope.body),
        }),
        fetch(`http://127.0.0.1:${backend.address().port}/api/analytics/collect`, {
          method: "POST",
          headers: replayHeaders,
          body: Buffer.concat(envelope.body),
        }),
      ]);
      assert.ok(repeats.every((r) => r.status === 409));
      await go(page, "/products/da-lat-map-notebook");
      assert.equal((await tick()).status(), 204);
      assert.equal(
        (await context.cookies()).find((c) => c.name === "bibi_visitor").value,
        cookie.value,
      );
      assert.equal((await f.pool.query("SELECT COUNT(*) n FROM visitor_sessions"))[0][0].n, 1);
      await go(page, "/admin/analytics/visitors");
      await page.getByLabel("Tên tài khoản", { exact: true }).fill("user01");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(f.secrets.userPassword);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.getByText("8.8.8.8", { exact: true }).first().waitFor();
      await page.getByText("Hoa Kỳ", { exact: true }).first().waitFor();
      assert.ok(await page.getByText("Chưa xác minh", { exact: true }).count());
      await page.screenshot({ path: join(evidence, "observed-desktop.png"), fullPage: true });
      // PHP signs wall-clock time. Age only fixture history to test a new session without forging PHP time.
      for (const table of [
        "visitor_sessions",
        "visitor_session_pages",
        "visitor_viewed_products",
      ]) {
        const fields =
          table === "visitor_sessions"
            ? ["started_at", "last_received_at"]
            : ["first_received_at", "last_received_at"];
        await f.pool.query(
          `UPDATE ${table} SET ${fields.map((field) => `${field}=DATE_SUB(${field},INTERVAL 31 MINUTE)`).join(",")}`,
        );
      }
      await setPeer("2001:4860:4860::8888");
      await go(page, "/products/ha-giang-map-notebook");
      assert.equal((await tick()).status(), 204);
      [rows] = await f.pool.query("SELECT * FROM visitor_sessions ORDER BY started_at");
      assert.equal(rows.length, 2);
      assert.equal(rows[0].id, firstId);
      assert.equal(rows[0].country_code, "US");
      assert.equal(rows[1].client_ip, "2001:4860:4860::8888");
      assert.equal(rows[1].country_code, "CA");
      failLookup = true;
      await go(page, "/contact");
      assert.equal((await tick()).status(), 204);
      assert.equal(
        (
          await f.pool.query("SELECT country_code FROM visitor_sessions ORDER BY started_at DESC")
        )[0][0].country_code,
        "CA",
        "same IP retains its resolved country",
      );
      await setPeer("1.1.1.1");
      await go(page, "/products/da-lat-map-notebook");
      assert.equal((await tick()).status(), 204);
      const [[missingCountry]] = await f.pool.query(
        "SELECT client_ip,country_code FROM visitor_sessions ORDER BY started_at DESC",
      );
      assert.equal(
        missingCountry.client_ip,
        "1.1.1.1",
        "fixture peer change must reach actual PHP before testing a lookup miss",
      );
      assert.equal(missingCountry.country_code, null);
      assert.ok(
        (await f.pool.query("SELECT COUNT(*) n FROM visitor_viewed_products"))[0][0].n >= 2,
      );
      failLookup = false;
      await setPeer("2001:4860:4860::8888");
      await go(page, "/products/ha-giang-map-notebook");
      assert.equal((await tick()).status(), 204);
      await go(page, "/admin/analytics/visitors");
      await page.getByText("2001:4860:4860::8888", { exact: true }).first().waitFor();
      await page.getByRole("button", { name: "Chi tiết khách 1", exact: true }).click();
      await page.locator(".a-visitor-session-panel").first().waitFor();
      assert.equal(await page.locator(".a-visitor-session-panel").count(), 2);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.getByRole("dialog").evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        true,
      );
      await page.screenshot({ path: join(evidence, "sessions-mobile.png"), fullPage: true });
      await page.getByRole("button", { name: "Đóng", exact: true }).click();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      await page.screenshot({ path: join(evidence, "observed-mobile.png"), fullPage: true });
      await go(page, "/products/ha-giang-map-notebook");
      await page.getByText("Quyền riêng tư khi truy cập", { exact: true }).click();
      const cleared = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/analytics/opt-out" && r.status() === 204,
      );
      await page
        .getByRole("checkbox", {
          name: "Cho phép ghi nhận trang và sản phẩm quan tâm",
          exact: true,
        })
        .uncheck();
      await cleared;
      assert.equal(
        (await context.cookies()).some((c) => c.name === "bibi_visitor"),
        false,
      );
      assert.equal(
        (await context.cookies()).some((c) => c.name === "bibi_refresh"),
        true,
      );
      const countBefore = (await f.pool.query("SELECT COUNT(*) n FROM visitor_sessions"))[0][0].n;
      let privacyRequests = 0;
      page.on("request", (r) => {
        if (new URL(r.url()).pathname === "/api/analytics/relay/collect.php") privacyRequests++;
      });
      await page.clock.fastForward(60000);
      await page.waitForTimeout(150);
      assert.equal(privacyRequests, 0);
      assert.equal(
        (await f.pool.query("SELECT COUNT(*) n FROM visitor_sessions"))[0][0].n,
        countBefore,
      );
      for (const signal of ["DNT", "GPC"]) {
        const privateContext = await makeContext();
        await privateContext.addInitScript(
          (signal) =>
            Object.defineProperty(
              navigator,
              signal === "GPC" ? "globalPrivacyControl" : "doNotTrack",
              { configurable: true, value: signal === "GPC" ? true : "1" },
            ),
          signal,
        );
        const privatePage = await privateContext.newPage();
        await privatePage.clock.install({ time: Date.now() });
        let sent = 0;
        privatePage.on("request", (r) => {
          if (new URL(r.url()).pathname === "/api/analytics/relay/collect.php") sent++;
        });
        await go(privatePage, "/products/da-lat-map-notebook", { armed: false });
        await privatePage.clock.fastForward(60000);
        await privatePage.waitForTimeout(100);
        assert.equal(sent, 0);
        await privateContext.close();
      }
      await relay.close();
      const fallbackContext = await makeContext();
      const fallbackPage = await fallbackContext.newPage();
      await fallbackPage.clock.install({ time: Date.now() });
      await watchBatchTimer(fallbackPage);
      await go(fallbackPage, "/products/da-lat-map-notebook");
      assert.equal(
        (
          await tick(fallbackPage, (r) => new URL(r.url()).pathname === "/api/analytics/collect")
        ).status(),
        202,
      );
      assert.equal(
        (
          await tick(fallbackPage, (r) => new URL(r.url()).pathname === "/api/analytics/collect")
        ).status(),
        204,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT COUNT(*) n FROM visitor_sessions WHERE ip_status='unavailable' AND client_ip IS NULL",
          )
        )[0][0].n,
        1,
      );
      await fallbackContext.close();
      assert.deepEqual(errors, []);
      console.log(
        "Isolated browser/PHP/MySQL acceptance passed; public peers are fixture-injected, not live source assurance.",
      );
    } finally {
      await browser?.close();
      await relay?.close();
      await frontend?.close();
      await frontend?.watcher.close();
      if (backend) {
        backend.closeAllConnections();
        await new Promise((r) => backend.close(r));
      }
      await runtime?.close();
      for (const close of cleanup.reverse()) await close();
      await rm(dir, { recursive: true, force: true });
      if (previous.backend === undefined) delete process.env.BACKEND_PORT;
      else process.env.BACKEND_PORT = previous.backend;
      if (previous.relay === undefined) delete process.env.LOCAL_PHP_RELAY_URL;
      else process.env.LOCAL_PHP_RELAY_URL = previous.relay;
    }
  },
);
