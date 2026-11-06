import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { createAuthFixture } from "../../backend/test/helpers/auth.mjs";
import { createRuntime } from "../../backend/dist/runtime.js";
import { startServer } from "../../backend/dist/server.js";
import { archiveFixture, accessLogLine } from "../../backend/test/helpers/access-logs.mjs";
import { migrateAccessLogs } from "../../backend/dist/access-logs/schema.js";
import { syncAccessLogs } from "../../backend/dist/access-logs/sync-service.js";
async function capture(page, path) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
  await page.screenshot({ path, fullPage: true });
}

test(
  "real MySQL/browser: public interest, visitor-only User, refresh, admin accounts and mobile UI",
  { timeout: 240000 },
  async () => {
    const cleanup = [];
    const f = await createAuthFixture({ after: (fn) => cleanup.push(fn) });
    f.clock.set(new Date());
    const archive = await archiveFixture({ after: (fn) => cleanup.push(fn) });
    archive.config.currentDirectory = resolve(archive.root, "current");
    await mkdir(archive.config.currentDirectory);
    await writeFile(resolve(archive.config.currentDirectory, archive.config.domainAlias), "");
    await writeFile(
      resolve(archive.config.currentDirectory, archive.config.domainAlias + "-ssl_log"),
      Buffer.concat([accessLogLine(), Buffer.from("\n")]),
    );
    await migrateAccessLogs(f.pool, resolve("backend/access-log-migrations"));
    await archive.write([accessLogLine()]);
    assert.equal(
      (
        await syncAccessLogs({
          pool: f.pool,
          config: archive.config,
          clock: f.clock,
          signal: AbortSignal.timeout(120000),
        })
      ).state,
      "complete",
    );
    let runtime, backend, frontend, browser;
    const username = `bt_${randomBytes(8).toString("hex")}`;
    const password = randomBytes(24).toString("hex");
    try {
      await f.pool.query("CREATE USER ?@'%' IDENTIFIED BY ?", [username, password]);
      await f.pool.query(
        `GRANT SELECT,INSERT,UPDATE,DELETE ON \`${f.dbConfig.database}\`.* TO ?@'%'`,
        [username],
      );
      runtime = createRuntime(
        {
          DB_HOST: f.dbConfig.host,
          DB_PORT: String(f.dbConfig.port),
          DB_NAME: f.dbConfig.database,
          DB_USER: username,
          DB_PASSWORD: password,
          AUTH_JWT_SECRET: f.config.jwtSecret,
          AUTH_ALLOWED_ORIGINS: "http://127.0.0.1:1",
          ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
          ACCESS_LOG_ARCHIVE_DIR: archive.config.archiveDirectory,
          ACCESS_LOG_DOMAIN_ALIAS: archive.config.domainAlias,
          ACCESS_LOG_WORK_DIR: archive.config.workDirectory,
          ACCESS_LOG_CURRENT_DIR: archive.config.currentDirectory,
        },
        f.clock,
      );
      await assert.rejects(
        runtime.appOptions.db.query("CREATE TABLE forbidden_runtime_ddl(id INT)"),
        { code: "ER_TABLEACCESS_DENIED_ERROR" },
      );
      backend = await startServer({
        host: "127.0.0.1",
        port: 0,
        release: { releaseId: "e2e", sourceSha: "test" },
        appOptions: runtime.appOptions,
      });
      const previous = process.env.BACKEND_PORT;
      process.env.BACKEND_PORT = String(backend.address().port);
      try {
        frontend = await createViteServer({
          configFile: resolve("vite.local.config.ts"),
          server: { host: "127.0.0.1", port: 0 },
          logLevel: "error",
        });
      } finally {
        if (previous === undefined) delete process.env.BACKEND_PORT;
        else process.env.BACKEND_PORT = previous;
      }
      await frontend.listen();
      const base = `http://127.0.0.1:${frontend.httpServer.address().port}`;
      runtime.appOptions.config.allowedOrigins.splice(0, 1, base);
      browser = await chromium.launch();
      const evidence = resolve(".superpowers/e2e/auth");
      await mkdir(evidence, { recursive: true });
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const collection = page
        .waitForResponse(
          (response) =>
            response.url().endsWith("/api/analytics/collect") && response.status() === 204,
          { timeout: 60000 },
        )
        .then(
          () => null,
          (error) => error,
        );
      await page.goto(base + "/products/da-lat-map-notebook");
      await page.getByRole("heading", { level: 1 }).waitFor();
      const collectionError = await collection;
      if (collectionError) throw collectionError;
      const [[visitor]] = await f.pool.query(
        "SELECT COUNT(*) n FROM visitor_viewed_products WHERE product_slug='da-lat-map-notebook'",
      );
      assert.equal(visitor.n, 1);
      await page.goto(base + "/admin");
      await page.getByLabel("Tên tài khoản", { exact: true }).fill("user01");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(f.secrets.userPassword);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.getByRole("heading", { name: "Khách truy cập", exact: true }).waitFor();
      await page
        .getByRole("heading", { name: "Kiểm tra cập nhật mỗi 15 phút", exact: true })
        .waitFor();
      await page.getByText("1 bản ghi", { exact: true }).first().waitFor();
      await capture(page, resolve(evidence, "user-access-logs-mobile.png"));
      await page.getByRole("button", { name: "Khách và sản phẩm", exact: true }).click();
      await page.getByText("Sổ tay bản đồ Đà Lạt · 1 khách", { exact: true }).waitFor();
      assert.equal(
        await page
          .locator("#admin-sidebar")
          .getByRole("link", { name: "Danh sách sản phẩm", exact: true })
          .count(),
        0,
      );
      await capture(page, resolve(evidence, "user-visitors-mobile.png"));
      await page.getByRole("button", { name: /^Xem KH-/ }).click();
      await page
        .getByRole("dialog", { name: "Chi tiết khách truy cập" })
        .getByText("Sổ tay bản đồ Đà Lạt", { exact: true })
        .waitFor();
      await capture(page, resolve(evidence, "visitor-interest-mobile.png"));
      await page.keyboard.press("Escape");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      let refreshes = 0;
      page.on("request", (request) => {
        if (request.url().endsWith("/api/auth/refresh")) refreshes++;
      });
      f.clock.advance(16 * 60000);
      const refreshed = page.waitForResponse(
        (response) => response.url().endsWith("/api/auth/refresh") && response.status() === 200,
      );
      await page.getByRole("button", { name: "Tải lại", exact: true }).click();
      await refreshed;
      await page.getByText("Sổ tay bản đồ Đà Lạt · 1 khách", { exact: true }).waitFor();
      assert.equal(refreshes, 1, "Concurrent UI401 requests share one refresh");
      await page.reload();
      await page.getByRole("heading", { name: "Khách truy cập", exact: true }).waitFor();
      await page.goto(base + "/admin/accounts/users");
      await page
        .getByText("Vai trò hiện tại không có quyền truy cập module này.", { exact: true })
        .waitFor();
      await context.close();
      const adminContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { DNT: "1" },
      });
      const admin = await adminContext.newPage();
      admin.on("pageerror", (error) => errors.push(error.message));
      await admin.goto(base + "/admin");
      await admin.getByLabel("Tên tài khoản", { exact: true }).fill("admin");
      await admin.getByLabel("Mật khẩu", { exact: true }).fill(f.secrets.masterPassword);
      await admin.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await admin.getByRole("heading", { name: "Bảng điều khiển", exact: true }).waitFor();
      await admin
        .locator(".a-kpis .a-card")
        .filter({ hasText: "Tài khoản" })
        .getByText("2", { exact: true })
        .waitFor();
      await admin
        .getByRole("figure", { name: "Doanh thu ghi nhận theo ngày", exact: true })
        .waitFor();
      await capture(admin, resolve(evidence, "admin-dashboard-desktop.png"));
      await admin.goto(base + "/admin/accounts/users");
      await admin.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
      const dialog = admin.getByRole("dialog", { name: "Tạo tài khoản" });
      await dialog.getByLabel("Tên tài khoản", { exact: true }).fill("editor_ui");
      await dialog.getByLabel("Tên hiển thị", { exact: true }).fill("Biên tập UI");
      await dialog.getByLabel("Mật khẩu", { exact: true }).fill("Only-test-UI!777");
      await dialog.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
      await admin.getByRole("link", { name: "editor_ui", exact: true }).waitFor();
      await capture(admin, resolve(evidence, "admin-accounts-desktop.png"));
      await admin.getByRole("link", { name: "editor_ui", exact: true }).click();
      await admin.getByRole("checkbox", { name: "Admin", exact: true }).check();
      await admin.getByRole("button", { name: "Lưu vai trò", exact: true }).click();
      await admin.getByText("Đã lưu vai trò và thu hồi các phiên cũ", { exact: true }).waitFor();
      await admin.getByLabel("Tên hiển thị", { exact: true }).fill("Biên tập UI đã lưu");
      await admin.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
      await admin.getByText("Đã lưu thông tin tài khoản", { exact: true }).waitFor();
      await admin.goto(base + "/admin/accounts/users");
      await admin.getByRole("link", { name: "admin", exact: true }).click();
      await admin.getByText("Tài khoản quản trị gốc được bảo vệ", { exact: true }).waitFor();
      const masterUsername = admin.getByLabel("Tên tài khoản", { exact: true });
      assert.equal(await masterUsername.isEnabled(), true);
      assert.equal(await masterUsername.isEditable(), false);
      assert.notEqual(await masterUsername.getAttribute("readonly"), null);
      await capture(admin, resolve(evidence, "master-protected-desktop.png"));
      assert.deepEqual(errors, []);
      await adminContext.close();
    } finally {
      await browser?.close();
      await frontend?.close();
      if (backend)
        await new Promise((done) => {
          backend.closeAllConnections();
          backend.close(done);
        });
      await runtime?.close();
      await f.pool.query("DROP USER IF EXISTS ?@'%'", [username]);
      for (const fn of cleanup.reverse()) await fn();
    }
  },
);
