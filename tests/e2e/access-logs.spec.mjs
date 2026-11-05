import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { createAuthFixture } from "../../backend/test/helpers/auth.mjs";
import { archiveFixture, accessLogLine } from "../../backend/test/helpers/access-logs.mjs";
import { migrateAccessLogs } from "../../backend/dist/access-logs/schema.js";
import { syncAccessLogs } from "../../backend/dist/access-logs/sync-service.js";
import { createRuntime } from "../../backend/dist/runtime.js";
import { startServer } from "../../backend/dist/server.js";
import { collectVisitor } from "../../backend/dist/visitors/collector.js";

test(
  "real browser/MySQL: full1205 current/archive records, filters, detail, refresh and mobile source failures",
  { timeout: 240000 },
  async () => {
    const cleanup = [],
      f = await createAuthFixture({ after: (fn) => cleanup.push(fn) }),
      a = await archiveFixture({ after: (fn) => cleanup.push(fn) }, { batchRows: 500 });
    f.clock.set(new Date());
    a.config.currentDirectory = join(a.root, "current");
    await mkdir(a.config.currentDirectory);
    const lines = [
      ...Array.from({ length: 1204 }, () => accessLogLine()),
      Buffer.from("malformed raw secret"),
    ];
    await a.write(lines);
    await writeFile(join(a.config.currentDirectory, a.config.domainAlias), "");
    const ssl = join(a.config.currentDirectory, a.config.domainAlias + "-ssl_log");
    await writeFile(ssl, Buffer.concat(lines.flatMap((line) => [line, Buffer.from("\n")])));
    await migrateAccessLogs(f.pool, resolve("backend/access-log-migrations"));
    const sync = () =>
      syncAccessLogs({
        pool: f.pool,
        config: a.config,
        clock: f.clock,
        signal: AbortSignal.timeout(120000),
      });
    const initial = await sync();
    assert.equal(initial.inserted, 1205);
    assert.equal(initial.current.records, 1205);
    const [[marker]] = await f.pool.query(
      "SELECT id,error_code FROM access_log_current_records WHERE parse_status='error'",
    );
    const username = "al_" + randomBytes(8).toString("hex"),
      password = randomBytes(24).toString("hex");
    let runtime, backend, frontend, browser;
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
          ACCESS_LOG_ARCHIVE_DIR: a.config.archiveDirectory,
          ACCESS_LOG_CURRENT_DIR: a.config.currentDirectory,
          ACCESS_LOG_DOMAIN_ALIAS: a.config.domainAlias,
          ACCESS_LOG_WORK_DIR: a.config.workDirectory,
        },
        f.clock,
      );
      const analytics = runtime.appOptions.analytics,
        slug = "da-lat-map-notebook",
        path = "/products/" + slug;
      const context = {
          ...analytics,
          now: f.clock.now(),
          ip: "192.0.2.123",
          userAgent: "Android Mobile Chrome/130.0",
        },
        batch = { paths: [path], products: [slug], lastPath: path };
      const bootstrap = await collectVisitor(f.pool, batch, context);
      await collectVisitor(f.pool, batch, { ...context, cookie: bootstrap.cookie.value });
      backend = await startServer({
        host: "127.0.0.1",
        port: 0,
        release: { releaseId: "e2e-access-logs", sourceSha: "test" },
        appOptions: runtime.appOptions,
      });
      const previous = process.env.BACKEND_PORT;
      process.env.BACKEND_PORT = String(backend.address().port);
      try {
        frontend = await createViteServer({
          configFile: resolve("vite.local.config.ts"),
          cacheDir: resolve(".superpowers/e2e/access-log-vite"),
          server: { host: "127.0.0.1", port: 0 },
          logLevel: "error",
        });
      } finally {
        if (previous === undefined) delete process.env.BACKEND_PORT;
        else process.env.BACKEND_PORT = previous;
      }
      await frontend.listen();
      const base = "http://127.0.0.1:" + frontend.httpServer.address().port;
      runtime.appOptions.config.allowedOrigins.splice(0, 1, base);
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const evidence = resolve(".superpowers/e2e/access-logs");
      await mkdir(evidence, { recursive: true });
      const shot = async (name) => {
        await page.waitForFunction(() =>
          document
            .getAnimations()
            .every(
              (a) =>
                a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity,
            ),
        );
        await page.screenshot({ path: join(evidence, name + ".png") });
      };
      const listResponse = (scope, extra = "") =>
        page.waitForResponse(
          (response) =>
            response.status() === 200 &&
            response.url().includes("/api/customer-access/access-logs?") &&
            response.url().includes("scope=" + scope) &&
            response.url().includes(extra),
        );
      await page.goto(base + "/admin");
      await page.getByLabel("Tên tài khoản", { exact: true }).fill("user01");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(f.secrets.userPassword);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.getByText("1.205 bản ghi", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Phạm vi nhật ký").inputValue(), "current");
      assert.equal(
        await page
          .locator("#admin-sidebar")
          .getByRole("link", { name: "Danh sách sản phẩm", exact: true })
          .count(),
        0,
      );
      await shot("current-desktop");
      const [[valid]] = await f.pool.query(
        "SELECT id FROM access_log_current_records WHERE parse_status='parsed' ORDER BY occurred_at DESC,id DESC LIMIT 1",
      );
      await page.getByRole("button", { name: "Xem bản ghi " + valid.id, exact: true }).click();
      await page.getByRole("dialog").getByText("203.0.113.0/24", { exact: true }).waitFor();
      await page
        .getByRole("dialog")
        .getByText(a.config.domainAlias + "-ssl_log", { exact: true })
        .waitFor();
      await shot("valid-record-desktop");
      await page.keyboard.press("Escape");
      let pending = listResponse("current", "pageSize=100");
      await page.getByLabel("Số dòng mỗi trang").selectOption("100");
      let body = await (await pending).json();
      assert.equal(body.items.length, 100);
      assert.equal(body.total, 1205);
      pending = listResponse("current", "page=13");
      await page.getByRole("button", { name: "Trang cuối", exact: true }).click();
      body = await (await pending).json();
      assert.equal(body.items.length, 5);
      await page.getByRole("button", { name: "Xem bản ghi " + marker.id, exact: true }).click();
      await page.getByRole("dialog").getByText(marker.error_code, { exact: true }).waitFor();
      await shot("parse-marker-desktop");
      await page.keyboard.press("Escape");
      await page.getByText("Bộ lọc nâng cao", { exact: true }).click();
      pending = listResponse("current", "from=2026-11-05");
      await page.getByLabel("Từ ngày (UTC)").fill("2026-11-05");
      assert.equal((await (await pending).json()).total, 1204);
      pending = listResponse("current");
      await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
      await pending;
      pending = listResponse("archive");
      await page.getByLabel("Phạm vi nhật ký").selectOption("archive");
      body = await (await pending).json();
      assert.equal(body.total, 1205);
      assert.equal(body.page, 1);
      await shot("archive-desktop");
      let refreshes = 0;
      page.on("request", (request) => {
        if (request.url().endsWith("/api/auth/refresh")) refreshes++;
      });
      f.clock.advance(16 * 60000);
      pending = listResponse("archive");
      await page.getByRole("button", { name: "Tải lại", exact: true }).click();
      await pending;
      assert.equal(refreshes, 1);
      await unlink(a.file);
      await unlink(ssl);
      assert.equal((await sync()).state, "error");
      pending = listResponse("current");
      await page.getByLabel("Phạm vi nhật ký").selectOption("current");
      await pending;
      await page.getByRole("button", { name: "Tải lại", exact: true }).click();
      await page.getByText("Đồng bộ có lỗi", { exact: true }).waitFor();
      await page.getByText("1.205 bản ghi", { exact: true }).waitFor();
      await page.getByText("Bộ lọc nâng cao", { exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await shot("current-mobile");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      await page.getByText("Bộ lọc nâng cao", { exact: true }).click();
      pending = listResponse("current", "parseStatus=error");
      await page.getByLabel("Kết quả đọc", { exact: true }).selectOption("error");
      assert.equal((await (await pending).json()).total, 1);
      await page.getByRole("button", { name: "Xem bản ghi " + marker.id, exact: true }).click();
      await page.getByRole("dialog").getByText(marker.error_code, { exact: true }).waitFor();
      await shot("parse-marker-mobile");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Khách và sản phẩm", exact: true }).click();
      await page
        .getByText(analytics.catalogue.products.get(slug) + " · 1 khách", { exact: true })
        .waitFor();
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
