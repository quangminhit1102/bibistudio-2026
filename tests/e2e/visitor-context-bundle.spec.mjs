import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { createProfileAuthFixture } from "./helpers/profile-fixture.mjs";
import { migrateVisitorContext } from "../../backend/dist/visitors/context-schema.js";
import { previewRelease } from "../../scripts/preview.mjs";

test(
  "exact compiled manifest6 bundle serves PHP, database readiness and protected responsive admin",
  { timeout: 120000 },
  async (t) => {
    const sha =
      process.env.GITHUB_SHA ??
      execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
    const id = process.env.GITHUB_RUN_ID ? `${sha}-${process.env.GITHUB_RUN_ID}` : `local-${sha}`;
    const bundle = resolve(process.env.BIBI_VERIFY_BUNDLE ?? join(".releases", id));
    const manifest = JSON.parse(await readFile(join(bundle, "manifest.json"), "utf8"));
    assert.equal(manifest.schemaVersion, 6);
    assert.ok(manifest.visitorContext);
    const cleanup = [];
    const f = await createProfileAuthFixture({ after: (fn) => cleanup.push(fn) });
    let preview, browser;
    try {
      await migrateVisitorContext(f.pool, join(bundle, "backend/visitor-context-migrations"));
      const secret = randomBytes(32).toString("base64url");
      preview = await previewRelease(bundle, {
        port: 0,
        runtimeEnv: {
          ...f.profileEnv,
          DB_HOST: f.dbConfig.host,
          DB_PORT: String(f.dbConfig.port),
          DB_NAME: f.dbConfig.database,
          DB_USER: f.dbConfig.user,
          DB_PASSWORD: f.dbConfig.password,
          AUTH_JWT_SECRET: f.config.jwtSecret,
          AUTH_JWT_ISSUER: f.config.jwtIssuer,
          AUTH_JWT_AUDIENCE: f.config.jwtAudience,
          AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
          ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
          ANALYTICS_RELAY_SECRET: secret,
          GEOIP_COUNTRY_FILE: join(bundle, "backend/geoip/country.mmdb"),
          CLIENT_IP_SOURCE_VERIFIED: "false",
        },
      });
      assert.equal((await fetch(preview.url + "/api/ready")).status, 200);
      assert.equal((await fetch(preview.url + "/api/customer-access")).status, 401);
      const version = await (await fetch(preview.url + "/api/version")).json();
      assert.equal(version.releaseId, manifest.releaseId);
      async function scan(dir) {
        for (const item of await readdir(dir, { withFileTypes: true })) {
          const file = join(dir, item.name);
          assert.ok(!item.name.endsWith(".mmdb") && !item.name.startsWith(".env"));
          if (item.isDirectory()) await scan(file);
          else if (/\.(js|css|html|json)$/.test(item.name)) {
            const text = await readFile(file, "utf8");
            assert.ok(!text.includes(secret), "runtime key must not be in frontend");
            assert.ok(
              !text.includes("ANALYTICS_RELAY_SECRET"),
              "backend configuration must not enter frontend chunks",
            );
          }
        }
      }
      await scan(join(bundle, "frontend"));
      browser = await chromium.launch();
      t.signal.addEventListener(
        "abort",
        () => {
          void browser.close().catch(() => {});
        },
        { once: true },
      );
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      await context.route(/^https:\/\/fonts\.googleapis\.com\//, (route) =>
        route.fulfill({ contentType: "text/css", body: "/* offline font fallback */" }),
      );
      const body = {
        paths: ["/products/da-lat-map-notebook"],
        products: ["da-lat-map-notebook"],
        lastPath: "/products/da-lat-map-notebook",
      };
      const post = () =>
        context.request.post(preview.url + "/api/analytics/relay/collect.php", {
          headers: {
            Origin: preview.url,
            "Content-Type": "application/json",
            "X-Bibi-Request": "1",
          },
          data: body,
        });
      assert.equal((await post()).status(), 202);
      assert.equal((await post()).status(), 204);
      const cookie = (await context.cookies()).find((c) => c.name === "bibi_visitor");
      assert.ok(cookie?.httpOnly);
      assert.equal(cookie.path, "/api/analytics");
      assert.equal(cookie.sameSite, "Lax");
      const [[row]] = await f.pool.query("SELECT COUNT(*) n FROM visitor_viewed_products");
      assert.equal(row.n, 1);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(preview.url + "/admin");
      await page.getByLabel("Tên tài khoản", { exact: true }).fill("user01");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(f.secrets.userPassword);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.getByRole("heading", { name: "Khách truy cập", exact: true }).waitFor();
      await page.getByText("1 bản ghi", { exact: true }).first().waitFor();
      assert.equal(
        await page
          .locator("#admin-sidebar")
          .getByRole("link", { name: "Danh sách sản phẩm", exact: true })
          .count(),
        0,
      );
      const evidence = resolve(".superpowers/e2e/visitor-context-bundle");
      await mkdir(evidence, { recursive: true });
      for (const [name, viewport] of [
        ["desktop", { width: 1366, height: 900 }],
        ["mobile", { width: 390, height: 844 }],
      ]) {
        await page.setViewportSize(viewport);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        await page.screenshot({ path: join(evidence, name + ".png"), fullPage: true });
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        "Compiled bundle acceptance passed: " +
          manifest.releaseId +
          "; private local peer remains unknown.",
      );
    } finally {
      await browser?.close();
      await preview?.close();
      for (const fn of cleanup.reverse()) await fn();
    }
  },
);
