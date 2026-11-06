import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { chromium } from "playwright";
import { createAuthFixture } from "../../backend/test/helpers/auth.mjs";
import { createRuntime } from "../../backend/dist/runtime.js";
import { startServer } from "../../backend/dist/server.js";

test(
  "admin usability: real auth, slip editing, TinyMCE guard, tooltips and accessible badges",
  { timeout: 240000 },
  async () => {
    const cleanup = [],
      f = await createAuthFixture({ after: (fn) => cleanup.push(fn) });
    console.log("usability: isolated auth fixture ready");
    f.clock.set(new Date());
    let runtime, backend, frontend, browser;
    const username = "ui_" + randomBytes(8).toString("hex"),
      password = randomBytes(24).toString("hex");
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
        },
        f.clock,
      );
      backend = await startServer({
        host: "127.0.0.1",
        port: 0,
        release: { releaseId: "e2e-usability", sourceSha: "test" },
        appOptions: runtime.appOptions,
      });
      console.log("usability: backend ready");
      const previous = process.env.BACKEND_PORT;
      process.env.BACKEND_PORT = String(backend.address().port);
      try {
        frontend = await createViteServer({
          configFile: resolve("vite.local.config.ts"),
          cacheDir: resolve(".superpowers/e2e/usability-vite"),
          server: { host: "127.0.0.1", port: 0 },
          logLevel: "error",
        });
      } finally {
        if (previous === undefined) delete process.env.BACKEND_PORT;
        else process.env.BACKEND_PORT = previous;
      }
      await frontend.listen();
      console.log("usability: frontend ready");
      const base = "http://127.0.0.1:" + frontend.httpServer.address().port;
      runtime.appOptions.config.allowedOrigins.splice(0, 1, base);
      browser = await chromium.launch();
      console.log("usability: browser ready");
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.setDefaultTimeout(15000);
      // Functional acceptance must not depend on the availability of Google Fonts.
      // Keep the real local styles/editor; the browser uses the CSS font fallback.
      await page.route(/^https:\/\/fonts\.googleapis\.com\//, (route) =>
        route.fulfill({
          contentType: "text/css",
          body: "/* Browser CSS font fallback for offline acceptance. */",
        }),
      );
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const directory = resolve(".superpowers/e2e/admin-usability");
      await mkdir(directory, { recursive: true });
      const shot = async (name) => {
        await page.waitForFunction(() =>
          document
            .getAnimations()
            .every(
              (a) =>
                a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity,
            ),
        );
        await page.screenshot({ path: resolve(directory, name + ".png"), fullPage: false });
      };
      const unloadBlocked = () =>
        page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })));
      const heading = (name) => page.getByRole("heading", { name, exact: true });
      const go = async (path) => {
        console.log("usability: opening " + path);
        await page.goto(base + path, { waitUntil: "domcontentloaded" });
      };
      const noOverflow = async () =>
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
      await go("/admin");
      await page.getByLabel("Tên tài khoản", { exact: true }).fill("admin");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(f.secrets.masterPassword);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await heading("Bảng điều khiển").waitFor();
      console.log("usability: login verified");

      // A fresh random origin and browser context isolate all IndexedDB catalogue/business data.
      await go("/admin/sales/slips/PMH-2026-0002/edit?returnTo=%2Fadmin%2Fsales%2Fslips%3F");
      await heading("Chỉnh sửa phiếu mua hàng").waitFor();
      await page.getByRole("button", { name: "Hủy", exact: true }).click();
      await heading("Phiếu mua hàng").waitFor();
      await page.getByRole("link", { name: "PMH-2026-0002", exact: true }).click();
      await heading("PMH-2026-0002").waitFor();
      await page.getByRole("link", { name: "Chỉnh sửa", exact: true }).click();
      await heading("Chỉnh sửa phiếu mua hàng").waitFor();
      await shot("slip-edit-desktop");

      for (const [path, title, iframe] of [
        ["/admin/products/create", "Thêm sản phẩm", "Mô tả chi tiết sản phẩm"],
        ["/admin/content/posts/create", "Thêm bài viết", "Nội dung bài viết"],
      ]) {
        await go(path);
        await heading(title).waitFor();
        const body = page.frameLocator(`iframe[title="${iframe}"]`).locator("body");
        await body.waitFor();
        assert.equal(await unloadBlocked(), false);
        await page.getByRole("button", { name: "Đổi giao diện sáng tối" }).click();
        await body.waitFor();
        await page.getByRole("button", { name: "Quay lại", exact: true }).click();
        await page.waitForURL((url) => !url.pathname.endsWith("/create"));
        assert.equal(await page.getByRole("dialog").count(), 0);
        await go(path);
        await body.waitFor();
        await body.click();
        await body.pressSequentially("Nội dung kiểm chứng chưa lưu", { delay: 15 });
        assert.equal(await unloadBlocked(), true);
        await shot(title === "Thêm bài viết" ? "post-editor-desktop" : "product-editor-desktop");
        await page.getByRole("button", { name: "Quay lại", exact: true }).click();
        await page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" }).waitFor();
        await page.keyboard.press("Escape");
        await body.fill("");
        await page.waitForFunction(() =>
          window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
        );
        assert.equal(await unloadBlocked(), false);
        await page.getByRole("button", { name: "Quay lại", exact: true }).click();
        await page.waitForURL((url) => !url.pathname.endsWith("/create"));
        assert.equal(await page.getByRole("dialog").count(), 0);
      }

      await go("/admin/settings/profile");
      await page.getByText("Tài khoản quản trị gốc được bảo vệ", { exact: true }).waitFor();
      const readOnly = page.locator("input[readonly]").first();
      await readOnly.focus();
      const initial = await readOnly.inputValue();
      await page.keyboard.type("Không được sửa");
      assert.equal(await readOnly.inputValue(), initial);
      assert.equal(
        await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).count(),
        0,
      );
      await shot("protected-profile-desktop");

      await page.getByRole("button", { name: "Thu gọn thanh bên" }).click();
      const link = page
        .locator("#admin-sidebar")
        .getByRole("link", { name: "Bảng điều khiển", exact: true });
      await link.hover();
      const tip = page.getByRole("tooltip", { name: "Bảng điều khiển", exact: true });
      await tip.waitFor();
      const b = await tip.boundingBox(),
        l = await link.boundingBox();
      assert.ok(
        b.x >= l.x + l.width && b.x + b.width <= 1440 && b.y >= 0 && b.y + b.height <= 1000,
      );
      await page.keyboard.press("Escape");
      await tip.waitFor({ state: "hidden" });
      await page.mouse.move(900, 100);
      await link.focus();
      await tip.waitFor();
      await shot("sidebar-tooltip-desktop");
      await page.keyboard.press("Escape");
      const last = page.locator("#admin-sidebar .a-nav-link").last();
      await last.scrollIntoViewIfNeeded();
      await last.hover();
      await page.getByRole("tooltip").waitFor();
      const lastBounds = await page.getByRole("tooltip").boundingBox();
      assert.ok(lastBounds.y >= 0 && lastBounds.y + lastBounds.height <= 1000);
      await page.keyboard.press("Escape");

      await go("/admin/components/data-display");
      await page.locator(".a-badge-privilege").first().waitFor();
      await page.locator(".a-badge-privilege").first().scrollIntoViewIfNeeded();
      for (const theme of ["light", "dark"]) {
        const dark = await page
          .locator(".admin-root")
          .evaluate((el) => el.classList.contains("dark"));
        if (dark !== (theme === "dark"))
          await page.getByRole("button", { name: "Đổi giao diện sáng tối" }).click();
        const ratios = await page.locator(".a-badge").evaluateAll((nodes) => {
          const luminance = (color) => {
            const rgb = color
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number)
              .map((n) => {
                const v = n / 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          };
          return nodes.map((el) => {
            const s = getComputedStyle(el),
              a = luminance(s.color),
              b = luminance(s.backgroundColor);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          });
        });
        assert.ok(
          ratios.length >= 6 && ratios.every((ratio) => ratio >= 4.5),
          JSON.stringify(ratios),
        );
        await shot("badges-" + theme + "-desktop");
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow();
      await page.locator(".a-badge-privilege").first().scrollIntoViewIfNeeded();
      await shot("badges-mobile");
      await page.getByRole("button", { name: "Mở menu quản trị" }).click();
      assert.equal(await page.getByRole("tooltip").count(), 0);
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Danh sách sản phẩm", exact: true })
        .waitFor();
      await shot("navigation-mobile");
      await page.keyboard.press("Escape");
      await go("/admin/sales/slips/PMH-2026-0002/edit");
      await heading("Chỉnh sửa phiếu mua hàng").waitFor();
      await noOverflow();
      await shot("slip-edit-mobile");
      await go("/admin/content/posts/create");
      await page.frameLocator('iframe[title="Nội dung bài viết"]').locator("body").waitFor();
      await noOverflow();
      await shot("post-editor-mobile");
      assert.deepEqual(errors, []);
    } catch (error) {
      console.error(error);
      throw error;
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
