import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { createProfileAuthFixture } from "./helpers/profile-fixture.mjs";
import { createRuntime } from "../../backend/dist/runtime.js";
import { startServer } from "../../backend/dist/server.js";
import { legacyVisitorBackend } from "../../backend/test/helpers/legacy-visitor-backend.mjs";
import { serve } from "../../backend/test/helpers/http.mjs";

test(
  "real visitor browser/DB: full synthetic IPs, same-cohort charts, 45 sessions, old history and date-only mobile UI",
  { timeout: 240000 },
  async () => {
    const cleanup = [],
      f = await createProfileAuthFixture({ after: (fn) => cleanup.push(fn) });
    f.clock.set(new Date());
    let runtime, backend, frontend, browser;
    const username = "va_" + randomBytes(8).toString("hex"),
      password = randomBytes(24).toString("hex");
    try {
      const visitor = randomUUID(),
        other = randomUUID();
      for (const id of [visitor, other])
        await f.pool.query(
          "INSERT INTO visitors(id,identity_hash,ip_prefix,device_type,operating_system,browser,first_seen_at,last_seen_at) VALUES(?,?,'192.0.2.0/24','desktop','Windows','Edge',?,?)",
          [id, randomBytes(32).toString("hex"), f.clock.now(), f.clock.now()],
        );
      for (let index = 0; index < 47; index++) {
        const id = randomUUID(),
          old = index === 46,
          second = index === 45;
        const time = old
          ? new Date("2020-01-01T01:00Z")
          : new Date(+f.clock.now() - index * 40 * 60000);
        await f.pool.query(
          "INSERT INTO visitor_sessions(id,visitor_id,started_at,last_received_at,landing_path,last_received_path,page_count,product_count,client_ip,ip_status,device_type,operating_system,browser) VALUES(?,?,?,?,'/','/contact',2,1,?,'verified','desktop','Windows','Edge')",
          [id, second ? other : visitor, time, time, second ? "192.0.2.20" : "2001:db8::1234"],
        );
        for (const path of ["/", "/contact"])
          await f.pool.query("INSERT INTO visitor_session_pages VALUES(?,?,?,?)", [
            id,
            path,
            time,
            time,
          ]);
        await f.pool.query(
          "INSERT INTO visitor_viewed_products VALUES(?,'da-lat-map-notebook',?,?)",
          [id, time, time],
        );
      }
      await f.pool.query("CREATE USER ?@'%' IDENTIFIED BY ?", [username, password]);
      await f.pool.query(
        `GRANT SELECT,INSERT,UPDATE,DELETE ON \`${f.dbConfig.database}\`.* TO ?@'%'`,
        [username],
      );
      runtime = createRuntime(
        {
          ...f.profileEnv,
          DB_HOST: f.dbConfig.host,
          DB_PORT: String(f.dbConfig.port),
          DB_NAME: f.dbConfig.database,
          DB_USER: username,
          DB_PASSWORD: password,
          AUTH_JWT_SECRET: f.config.jwtSecret,
          AUTH_JWT_ISSUER: f.config.jwtIssuer,
          AUTH_JWT_AUDIENCE: f.config.jwtAudience,
          AUTH_ALLOWED_ORIGINS: "http://127.0.0.1:1",
          ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
        },
        f.clock,
      );
      backend = await startServer({
        host: "127.0.0.1",
        port: 0,
        release: { releaseId: "visitor-e2e", sourceSha: "test", schemaVersion: 5 },
        appOptions: runtime.appOptions,
      });
      const previous = process.env.BACKEND_PORT;
      process.env.BACKEND_PORT = String(backend.address().port);
      try {
        frontend = await createViteServer({
          configFile: resolve("vite.local.config.ts"),
          cacheDir: resolve(".superpowers/e2e/visitor-vite"),
          server: { host: "127.0.0.1", port: 0 },
          logLevel: "error",
        });
      } finally {
        if (previous === undefined) delete process.env.BACKEND_PORT;
        else process.env.BACKEND_PORT = previous;
      }
      await frontend.listen();
      await frontend.warmupRequest("/src/main.tsx");
      await frontend.warmupRequest("/src/features/admin/shell/admin-entry.tsx");
      console.log("visitor acceptance: isolated database, backend and frontend ready");
      const base = "http://127.0.0.1:" + frontend.httpServer.address().port;
      runtime.appOptions.config.allowedOrigins.splice(0, 1, base);
      browser = await chromium.launch();
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      page.setDefaultTimeout(20000);
      await page.route(/^https:\/\/fonts\.googleapis\.com\//, (route) =>
        route.fulfill({ contentType: "text/css", body: "/* Offline font fallback */" }),
      );
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const evidence = resolve(".superpowers/e2e/visitor-analytics");
      await mkdir(evidence, { recursive: true });
      await page.goto(base + "/admin/analytics/visitors", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Tên tài khoản", { exact: true }).fill("user01");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(f.secrets.userPassword);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.getByText("2001:db8::1234", { exact: true }).first().waitFor();
      assert.equal(await page.getByRole("button", { name: "Loại trừ IP", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: /^Xóa khách/ }).count(), 0);
      assert.equal(await page.getByText("Nhật ký cPanel", { exact: true }).count(), 0);
      assert.equal(
        await page.getByRole("columnheader", { name: "ID khách", exact: true }).count(),
        0,
      );
      const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
      const report = await (
        await fetch(base + "/api/customer-access/report", {
          headers: { Authorization: `Bearer ${grant.accessToken}` },
        })
      ).json();
      assert.equal(report.totalSessions, 46);
      assert.equal(report.totalVisitors, 2);
      assert.equal(report.products[0].interestedVisitors, 2);
      assert.equal(
        report.series.reduce((n, p) => n + p.sessions, 0),
        46,
      );
      assert.equal((await fetch(base + "/api/customer-access/access-logs")).status, 404);
      await page.screenshot({ path: resolve(evidence, "overview-desktop.png"), fullPage: true });
      await page.getByRole("button", { name: "Chi tiết khách 1", exact: true }).click();
      await page.locator(".a-visitor-session-panel").first().waitFor();
      assert.equal(await page.locator(".a-visitor-session-panel").count(), 20);
      await page.getByRole("button", { name: "Xem thêm phiên", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".a-visitor-session-panel").length === 40,
      );
      await page.getByRole("button", { name: "Xem thêm phiên", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".a-visitor-session-panel").length === 45,
      );
      assert.equal(await page.locator(".a-visitor-session-panel[open]").count(), 1);
      assert.equal(
        await page.getByRole("button", { name: "Xem thêm phiên", exact: true }).count(),
        0,
      );
      await page.getByRole("button", { name: "Đóng", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Khoảng ngày", exact: true }).click();
      assert.equal(await page.locator('input[type="date"]').count(), 2);
      assert.equal(
        await page.locator('input[type="datetime-local"], input[type="time"]').count(),
        0,
      );
      await page.getByLabel("Từ ngày", { exact: true }).fill("2020-01-01");
      await page.getByLabel("Đến ngày", { exact: true }).fill("2020-01-01");
      await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
      await page.getByText("1 bản ghi", { exact: true }).first().waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      await page.screenshot({ path: resolve(evidence, "old-history-mobile.png"), fullPage: true });
      await page.getByRole("button", { name: "Chi tiết", exact: true }).first().click();
      await page.getByRole("dialog").getByRole("link", { name: "/contact", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Phiên trước", exact: true }).count(), 0);
      assert.equal(
        await page.getByRole("dialog").evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        true,
      );
      await page.screenshot({ path: resolve(evidence, "session-mobile.png"), fullPage: true });
      await page.getByRole("button", { name: "Đóng", exact: true }).click();
      const lifecycle = { after: (fn) => cleanup.push(fn) };
      const legacy = await legacyVisitorBackend(lifecycle);
      const oldBase = await serve(
        lifecycle,
        legacy.createApp(
          { releaseId: "rollback-v4", sourceSha: legacy.sourceSha, schemaVersion: 4 },
          runtime.appOptions,
        ),
      );
      await page.route(
        (url) => url.pathname === "/api/customer-access/report",
        async (route) => {
          const response = await fetch(oldBase + "/api/customer-access/report", {
            headers: { Authorization: route.request().headers().authorization },
          });
          const body = await response.json();
          assert.equal(
            body.totalSessions,
            46,
            "Pinned old backend ignores selected2020 dates and returns its90-day report",
          );
          await route.fulfill({
            status: response.status,
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        },
      );
      await page.getByRole("button", { name: "Làm mới", exact: true }).click();
      await page
        .getByText("Phiên bản báo cáo không khớp khoảng ngày đã chọn. Vui lòng tải lại trang.", {
          exact: true,
        })
        .first()
        .waitFor();
      assert.equal(
        await page.locator(".a-visitor-kpis").count(),
        0,
        "Old totals are never displayed under the selected historical range",
      );
      await page.screenshot({
        path: resolve(evidence, "rollback-compatibility.png"),
        fullPage: true,
      });
      // Actual mutation UI uses only this disposable random test database.
      const admin = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      admin.setDefaultTimeout(20000);
      admin.on("pageerror", (error) => errors.push(error.message));
      await admin.goto(base + "/admin/analytics/visitors");
      await admin.getByLabel("Tên tài khoản", { exact: true }).fill("admin");
      await admin.getByLabel("Mật khẩu", { exact: true }).fill(f.secrets.masterPassword);
      await admin.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await admin.getByRole("button", { name: "Loại trừ IP", exact: true }).click();
      await admin.getByLabel("Thêm quy tắc", { exact: true }).fill("8.8.8.*\n1.1.*.*");
      await admin.screenshot({
        path: resolve(evidence, "controls-exclusions-desktop.png"),
        fullPage: true,
      });
      await admin.getByRole("button", { name: "Lưu cấu hình", exact: true }).click();
      await admin.getByRole("dialog").waitFor({ state: "hidden" });
      const [[settings]] = await f.pool.query(
        "SELECT rules FROM visitor_exclusion_settings WHERE id=1",
      );
      assert.deepEqual(
        typeof settings.rules === "string" ? JSON.parse(settings.rules) : settings.rules,
        ["8.8.8.*", "1.1.*.*"],
      );
      await admin.getByRole("button", { name: "Chi tiết khách 2", exact: true }).click();
      await admin
        .getByRole("button", { name: /^Xóa phiên/ })
        .first()
        .click();
      await admin.getByRole("dialog", { name: "Xóa phiên truy cập?", exact: true }).waitFor();
      await admin.screenshot({
        path: resolve(evidence, "controls-delete-session-confirm.png"),
        fullPage: true,
      });
      await admin.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await admin.getByText("1 bản ghi", { exact: true }).first().waitFor();
      const [[removed]] = await f.pool.query("SELECT COUNT(*) n FROM visitors WHERE id=?", [other]);
      assert.equal(removed.n, 0);
      await admin.setViewportSize({ width: 390, height: 844 });
      await admin.getByRole("checkbox", { name: "Chọn khách 2001:db8::1234", exact: true }).check();
      await admin.getByRole("button", { name: "Xóa đã chọn", exact: true }).waitFor();
      assert.equal(
        await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      await admin.screenshot({
        path: resolve(evidence, "controls-selection-mobile.png"),
        fullPage: true,
      });
      await admin.getByRole("button", { name: "Xóa đã chọn", exact: true }).click();
      await admin.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await admin.getByText("Chưa có dữ liệu", { exact: true }).first().waitFor();
      const [[remaining]] = await f.pool.query("SELECT COUNT(*) n FROM visitors WHERE id=?", [
        visitor,
      ]);
      assert.equal(
        remaining.n,
        0,
        "Bulk deletion removes selected visitor including historical sessions",
      );
      await admin.close();
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await frontend?.close();
      await frontend?.watcher.close();
      if (backend)
        await new Promise((done) => {
          backend.closeAllConnections();
          backend.close(done);
        });
      await runtime?.close();
      await f.pool.query("DROP USER IF EXISTS ?@'%'", [username]);
      for (const close of cleanup.reverse()) await close();
    }
  },
);
