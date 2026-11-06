import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { createProfileAuthFixture } from "./helpers/profile-fixture.mjs";
import { createRuntime } from "../../backend/dist/runtime.js";
import { startServer } from "../../backend/dist/server.js";
import { createAccountService } from "../../backend/dist/accounts/service.js";
import { pngImage, jpegImage } from "../../backend/test/helpers/avatar-images.mjs";
test(
  "real browser/MySQL profile metadata, private avatars, permissions, races and responsive UI",
  { timeout: 240000 },
  async () => {
    const cleanup = [],
      f = await createProfileAuthFixture({ after: (fn) => cleanup.push(fn) });
    f.clock.set(new Date());
    let runtime, backend, frontend, browser;
    try {
      const root = await f.auth.login({ username: "admin", password: f.secrets.masterPassword }),
        actor = await f.auth.authenticate(root.accessToken),
        accounts = createAccountService({ pool: f.pool, clock: f.clock }),
        password = "Only-test-Profile!99";
      const user = await accounts.create(
        {
          username: "profile_user",
          displayName: "Khách kiểm thử",
          password,
          roleIds: ["system-user"],
        },
        actor,
      );
      const admin = await accounts.create(
        {
          username: "profile_admin",
          displayName: "Quản trị kiểm thử",
          password,
          roleIds: ["system-admin", "system-user"],
        },
        actor,
      );
      runtime = createRuntime(
        {
          ...f.profileEnv,
          DB_HOST: f.dbConfig.host,
          DB_PORT: String(f.dbConfig.port),
          DB_NAME: f.dbConfig.database,
          DB_USER: f.dbConfig.user,
          DB_PASSWORD: f.dbConfig.password,
          AUTH_JWT_SECRET: f.config.jwtSecret,
          AUTH_ALLOWED_ORIGINS: "http://127.0.0.1:1",
          ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
        },
        f.clock,
      );
      backend = await startServer({
        host: "127.0.0.1",
        port: 0,
        release: { releaseId: "profile-e2e", sourceSha: "test", schemaVersion: 4 },
        appOptions: runtime.appOptions,
      });
      const previous = process.env.BACKEND_PORT;
      process.env.BACKEND_PORT = String(backend.address().port);
      try {
        frontend = await createViteServer({
          configFile: resolve("vite.local.config.ts"),
          cacheDir: resolve(".superpowers/e2e/profile-vite"),
          server: { host: "127.0.0.1", port: 0 },
          logLevel: "error",
        });
      } finally {
        if (previous === undefined) delete process.env.BACKEND_PORT;
        else process.env.BACKEND_PORT = previous;
      }
      console.log("profile: frontend starting");
      await frontend.listen();
      await frontend.warmupRequest("/src/main.tsx");
      await frontend.warmupRequest("/src/features/admin/shell/admin-entry.tsx");
      const base = "http://127.0.0.1:" + frontend.httpServer.address().port;
      runtime.appOptions.config.allowedOrigins.splice(0, 1, base);
      console.log("profile: launching Chromium");
      browser = await chromium.launch();
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
        page = await context.newPage(),
        errors = [];
      page.setDefaultTimeout(20000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route(/^https:\/\/fonts\.googleapis\.com\//, (route) =>
        route.fulfill({ contentType: "text/css", body: "/* offline fallback */" }),
      );
      const evidence = resolve(".superpowers/e2e/profile");
      await mkdir(evidence, { recursive: true });
      const shot = async (name) => {
        await page.screenshot({ path: resolve(evidence, name + ".png"), fullPage: false });
      };
      const pending = new Set();
      page.on("request", (r) => pending.add(new URL(r.url()).pathname));
      page.on("requestfinished", (r) => pending.delete(new URL(r.url()).pathname));
      page.on("requestfailed", (r) => pending.delete(new URL(r.url()).pathname));
      const login = async (name, secret = password) => {
        console.log("profile: login navigation", name);
        try {
          await page.goto(base + "/admin/settings/profile");
        } catch (error) {
          console.log("profile: pending requests", [...pending]);
          await page
            .screenshot({ path: resolve(evidence, "navigation-failure.png"), timeout: 5000 })
            .catch(() => {});
          throw error;
        }
        await page.getByLabel("Tên tài khoản", { exact: true }).fill(name);
        await page.getByLabel("Mật khẩu", { exact: true }).fill(secret);
        await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
        await page.getByRole("heading", { name: "Hồ sơ", exact: true }).waitFor();
        await page.getByLabel("Tên hiển thị", { exact: true }).waitFor();
      };
      const logout = async () => {
        await page
          .locator(".a-topbar")
          .getByRole("button", { name: /Tài khoản/ })
          .click();
        await page.getByRole("menuitem", { name: "Đăng xuất", exact: true }).click();
        await page.getByRole("button", { name: "Đăng nhập", exact: true }).waitFor();
      };
      await login("profile_user");
      assert.equal(
        await page.getByLabel("Tên tài khoản", { exact: true }).getAttribute("readonly"),
        "",
      );
      assert.equal(await page.getByLabel("Mật khẩu mới").count(), 0);
      await page.getByLabel("Tên hiển thị", { exact: true }).fill("Khách đã cập nhật");
      await page.getByLabel("Email", { exact: true }).fill("profile@example.test");
      await page.getByLabel("Số điện thoại", { exact: true }).fill("0392 969 000");
      const save = page.waitForResponse(
        (r) => r.url().endsWith("/api/profile") && r.request().method() === "PATCH",
      );
      await page.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
      assert.equal((await save).status(), 200);
      await page.getByRole("button", { name: "Tài khoản Khách đã cập nhật" }).first().waitFor();
      await page.reload();
      await page.getByLabel("Số điện thoại", { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Số điện thoại", { exact: true }).inputValue(),
        "0392969000",
      );
      let uploads = 0;
      page.on("request", (r) => {
        if (r.method() === "PUT" && r.url().endsWith("/api/profile/avatar")) uploads++;
      });
      const choose = async (buffer, type = "image/png") =>
        page.getByLabel("Chọn ảnh đại diện", { exact: true }).setInputFiles({
          name: type === "image/png" ? "avatar.png" : "avatar.jpg",
          mimeType: type,
          buffer,
        });
      const upload = async (buffer, type = "image/png") => {
        await choose(buffer, type);
        await page.getByAltText("Xem trước ảnh đại diện").waitFor();
        const response = page.waitForResponse(
          (r) => r.url().endsWith("/api/profile/avatar") && r.request().method() === "PUT",
        );
        await page.getByRole("button", { name: "Lưu ảnh", exact: true }).click();
        assert.equal((await response).status(), 200);
        await page.getByAltText("Xem trước ảnh đại diện").waitFor({ state: "detached" });
        await page.locator('.a-topbar img[src^="blob:"]').waitFor();
      };
      await choose(pngImage());
      assert.equal(uploads, 0);
      await page.getByRole("button", { name: "Hủy chọn ảnh", exact: true }).click();
      await upload(pngImage());
      await shot("user-avatar-desktop");
      await upload(jpegImage(), "image/jpeg");
      await page.route("**/api/profile/avatar", (route) =>
        route.request().method() === "PUT"
          ? route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                error: { code: "CONTROLLED", message: "Lỗi tải ảnh kiểm thử" },
              }),
            })
          : route.continue(),
      );
      await choose(pngImage());
      await page.getByRole("button", { name: "Lưu ảnh", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "Lỗi tải ảnh kiểm thử" }).waitFor();
      assert.equal(await page.locator('.a-topbar img[src^="blob:"]').count(), 1);
      await page.getByRole("button", { name: "Hủy chọn ảnh", exact: true }).click();
      await page.unroute("**/api/profile/avatar");
      await page.getByLabel("Tên hiển thị", { exact: true }).fill("Nháp không mất");
      assert.equal(await page.getByLabel("Chọn ảnh đại diện", { exact: true }).isDisabled(), true);
      await f.pool.query(
        "UPDATE users SET display_name='Thay đổi ở tab khác',revision=revision+1 WHERE id=?",
        [user.id],
      );
      const conflict = page.waitForResponse(
        (r) => r.url().endsWith("/api/profile") && r.request().method() === "PATCH",
      );
      await page.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
      assert.equal((await conflict).status(), 409);
      assert.equal(
        await page.getByLabel("Tên hiển thị", { exact: true }).inputValue(),
        "Nháp không mất",
      );
      await shot("revision-conflict");
      await page.getByRole("button", { name: "Tải lại dữ liệu", exact: true }).click();
      await page.getByLabel("Tên hiển thị", { exact: true }).filter({ visible: true }).waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector('input[autocomplete="username"]') &&
          document.querySelector('input[type="tel"]').value === "0392969000",
      );
      console.log("profile: parallel unauthorized responses");
      let refreshes = 0,
        expiredCount = 0,
        releaseExpired;
      const expiredBarrier = new Promise((done) => (releaseExpired = done)),
        expiredTimeout = setTimeout(() => releaseExpired(), 5000);
      const refreshListener = (r) => {
        if (r.method() === "POST" && r.url().endsWith("/api/auth/refresh")) refreshes++;
      };
      page.on("request", refreshListener);
      const expiredRoutes = new Set();
      const expire = async (route) => {
        const key = new URL(route.request().url()).pathname;
        if (route.request().method() !== "GET" || expiredRoutes.has(key)) return route.continue();
        expiredRoutes.add(key);
        expiredCount++;
        if (expiredCount === 2) {
          clearTimeout(expiredTimeout);
          releaseExpired();
        }
        await expiredBarrier;
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "EXPIRED" } }),
        });
      };
      await page.route("**/api/profile", expire);
      await page.route("**/api/profile/avatar/*", expire);
      await page.reload();
      await page.getByLabel("Tên hiển thị", { exact: true }).waitFor();
      await page.locator('.a-topbar img[src^="blob:"]').waitFor();
      assert.equal(expiredCount, 2);
      assert.equal(refreshes, 2, "one initial session restore plus one shared401 refresh");
      clearTimeout(expiredTimeout);
      page.off("request", refreshListener);
      await page.unroute("**/api/profile", expire);
      await page.unroute("**/api/profile/avatar/*", expire);
      for (const width of [1440, 900, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate(
            (theme) => localStorage.setItem("bibi-admin:theme", JSON.stringify(theme)),
            theme,
          );
          await page.reload();
          await page.getByLabel("Tên hiển thị", { exact: true }).waitFor();
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          await shot(`profile-${width}-${theme}`);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      console.log("profile: account switch while image response pending");
      let releaseImage, imageStarted;
      const imageBarrier = new Promise((done) => (releaseImage = done)),
        imageRequest = new Promise((done) => (imageStarted = done));
      const suspendImage = async (route) => {
        imageStarted();
        await imageBarrier;
        await route.fulfill({ contentType: "image/png", body: pngImage() }).catch(() => {});
      };
      await page.route("**/api/profile/avatar/*", suspendImage);
      await page.reload();
      await page.getByLabel("Tên hiển thị", { exact: true }).waitFor();
      await imageRequest;
      await logout();
      await login("profile_admin");
      releaseImage();
      await page.unroute("**/api/profile/avatar/*", suspendImage);
      assert.equal(await page.locator(".a-topbar img").count(), 0);
      await page.getByLabel("Tên hiển thị", { exact: true }).fill("Quản trị tự cập nhật");
      const adminSaved = page.waitForResponse(
        (r) => r.url().endsWith("/api/profile") && r.request().method() === "PATCH",
      );
      await page.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
      assert.equal((await adminSaved).status(), 200);
      const [[ownRoles]] = await f.pool.query("SELECT COUNT(*) n FROM user_roles WHERE user_id=?", [
        admin.id,
      ]);
      assert.equal(ownRoles.n, 2);
      await logout();
      await login("profile_user");
      const removed = page.waitForResponse(
        (r) => r.request().method() === "DELETE" && r.url().endsWith("/api/profile/avatar"),
      );
      await page.getByRole("button", { name: "Xóa ảnh", exact: true }).click();
      assert.equal((await removed).status(), 200);
      await page.locator(".a-topbar img").waitFor({ state: "detached" });
      await page.goto(base + "/admin/accounts/users");
      await page
        .getByText("Vai trò hiện tại không có quyền truy cập module này.", { exact: true })
        .waitFor();
      await logout();
      await login("profile_admin");
      await page.goto(base + "/admin/accounts/users/" + user.id);
      await page.getByLabel("Tên hiển thị", { exact: true }).waitFor();
      await page.getByLabel("Số điện thoại", { exact: true }).fill("+84 392 969 000");
      const managed = page.waitForResponse(
        (r) => r.request().method() === "PUT" && r.url().includes("/api/accounts/" + user.id),
      );
      await page.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
      assert.equal((await managed).status(), 200);
      const [[roles]] = await f.pool.query("SELECT COUNT(*) n FROM user_roles WHERE user_id=?", [
        user.id,
      ]);
      assert.equal(roles.n, 1);
      await shot("managed-account-desktop");
      await logout();
      await login("admin", f.secrets.masterPassword);
      await page.getByText("Tài khoản quản trị gốc được bảo vệ", { exact: true }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Lưu thông tin", exact: true }).count(),
        0,
      );
      assert.equal(await page.getByLabel("Chọn ảnh đại diện", { exact: true }).count(), 0);
      await shot("master-readonly");
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
      for (const close of cleanup.reverse()) await close();
    }
  },
);
