import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { postInput } from "../../../backend/test/helpers/content-publication.mjs";

async function browserContext(browser, options) {
  const context = await browser.newContext(options);
  // External font availability is outside the local API/PHP acceptance boundary.
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());
  return context;
}
export async function contentRequest(f, token, path, method = "GET", body) {
  return fetch(f.baseUrl + "/api/content" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Origin: f.baseUrl,
      "X-Bibi-Request": "1",
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
export async function waitForContentJob(f, token, id) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const response = await contentRequest(f, token, "/publications/" + id);
    assert.equal(response.status, 200);
    const job = await response.json();
    if (["failed", "succeeded"].includes(job.status)) {
      assert.equal(job.status, "succeeded", JSON.stringify(job.error));
      return job;
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw Error("Owned CMS publication did not finish");
}
async function loginPage(page, f, credentials) {
  await page.goto(f.baseUrl + "/admin", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Tên tài khoản", { exact: true }).fill(credentials.username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(credentials.password);
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/login" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.getByLabel("Tên tài khoản", { exact: true }).waitFor({ state: "hidden" });
}
export async function verifyBridgeBrowser(t, f, { postId, evidenceDir }) {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(30000);
  await loginPage(page, f, f.adminCredentials);
  await page.goto(f.baseUrl + "/admin/content/posts/" + postId + "/edit");
  await page.getByText(/Nội dung đang ở chế độ chỉ đọc/).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Lưu nháp", exact: true }).isDisabled(),
    true,
  );
  await page.screenshot({ path: join(evidenceDir, "bridge-read-only.png") });
  await browser.close();
}
export async function verifyCmsBrowser(t, f, { evidenceDir, mode }) {
  await mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  t.after(() => browser.close());
  const admin = await browserContext(browser, { viewport: { width: 1440, height: 1000 } }),
    editor = await browserContext(browser),
    noJs = await browserContext(browser, {
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    }),
    page = await admin.newPage(),
    editorPage = await editor.newPage(),
    documentPage = await noJs.newPage(),
    jobs = [];
  page.setDefaultTimeout(30000);
  editorPage.setDefaultTimeout(30000);
  const { bytes } = await f.preparePost(),
    token = await f.login(),
    editorToken = await f.login(f.editorCredentials);
  const publication = async (label) => {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/content/publications" &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: label, exact: true }).click();
    const result = await response;
    assert.equal(result.status(), 202);
    const job = await result.json(),
      done = await waitForContentJob(f, token, job.id);
    jobs.push(done);
    await page.getByText("Xuất bản thành công", { exact: true }).waitFor();
    return done;
  };
  await loginPage(page, f, f.adminCredentials);
  await page.goto(f.baseUrl + "/admin/content/categories");
  await page.getByRole("heading", { name: "Danh mục bài viết", exact: true }).waitFor();
  let parent = null;
  for (let level = 1; level <= 3; level++) {
    await page.getByRole("button", { name: "Thêm danh mục", exact: true }).click();
    await page.getByLabel("Tên danh mục", { exact: true }).fill("SEO Cấp " + level);
    await page.getByLabel(/^Đường dẫn danh mục/).fill("seo-cap-" + level);
    await page.getByRole("combobox", { name: /^Danh mục cha/ }).selectOption(parent ?? "");
    const saving = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/content/categories" && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Lưu danh mục", exact: true }).click();
    const saved = await saving;
    assert.equal(saved.status(), 201);
    const category = await saved.json();
    assert.equal(category.parentId, parent, "saved category retains the chosen parent");
    parent = category.id;
    await publication("Áp dụng lên website");
  }
  await page.getByRole("button", { name: "Thêm danh mục", exact: true }).click();
  const forbiddenParent = page
    .getByRole("combobox", { name: /^Danh mục cha/ })
    .locator("option:disabled")
    .filter({ hasText: "SEO Cấp 3" });
  await forbiddenParent.waitFor({ state: "attached" });
  // Playwright follows the wrapping label to its enabled select for isDisabled().
  assert.equal(await forbiddenParent.evaluate((option) => option.disabled), true);
  const fourth = await contentRequest(f, token, "/categories", "POST", {
    input: {
      name: "SEO Cấp 4",
      slug: "seo-cap-4",
      description: "",
      parentId: parent,
      position: 0,
      active: true,
      seoTitle: "",
      seoDescription: "",
    },
  });
  assert.equal(fourth.status, 400);
  await fourth.arrayBuffer();
  await page.goto(f.baseUrl + "/admin/content/posts/create");
  await page.getByRole("heading", { name: "Thêm bài viết", exact: true }).waitFor();
  await page.getByLabel("Tiêu đề", { exact: true }).fill("SEO fixture");
  await page.getByLabel(/^Đường dẫn/).fill("seo-fixture");
  await page.getByLabel("Tóm tắt", { exact: true }).fill("Bài kiểm chứng CMS và HTML công khai.");
  await page.getByRole("combobox", { name: /^Danh mục/ }).selectOption(parent);
  const body = page.frameLocator('iframe[title="Nội dung bài viết"]').locator("body");
  await body.waitFor();
  await body.click();
  await body.pressSequentially("Nội dung đầy đủ trước khi chạy JavaScript.");
  const uploadResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/content/media" && r.request().method() === "POST",
  );
  await page
    .getByLabel(/^Tải ảnh lên/)
    .setInputFiles({ name: "seo-fixture.png", mimeType: "image/png", buffer: bytes });
  const uploaded = await uploadResponse;
  assert.equal(uploaded.status(), 201);
  const image = await uploaded.json(),
    publicMedia = "/media/content/" + image.variants[0].hash + ".webp";
  assert.equal((await fetch(f.baseUrl + publicMedia)).status, 404);
  await page.getByLabel("Mô tả ảnh bìa", { exact: true }).fill("Sổ giấy kiểm chứng");
  const saveResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/content/posts" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
  const saved = await saveResponse;
  assert.equal(saved.status(), 201);
  let post = await saved.json();
  await page.waitForURL((url) => url.pathname === "/admin/content/posts/" + post.id + "/edit");
  assert.equal((await fetch(f.baseUrl + "/blog/seo-fixture")).status, 404);
  await loginPage(editorPage, f, f.editorCredentials);
  await editorPage.goto(f.baseUrl + "/admin/content/posts/" + post.id + "/edit");
  await editorPage.getByLabel("Tiêu đề", { exact: true }).waitFor();
  assert.equal(await editorPage.getByLabel("Tiêu đề", { exact: true }).inputValue(), "SEO fixture");
  assert.equal(await editorPage.getByRole("button", { name: "Đăng bài", exact: true }).count(), 0);
  assert.equal(
    (
      await contentRequest(f, editorToken, "/publications", "POST", {
        action: "publish",
        targetId: post.id,
        expectedRevision: post.revision,
        idempotencyKey: randomUUID(),
      })
    ).status,
    403,
  );
  await page.getByLabel("Mô tả ảnh bìa", { exact: true }).fill("");
  await page.getByRole("button", { name: "Đăng bài", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Tiêu đề", { exact: true }).inputValue(), "SEO fixture");
  assert.equal((await fetch(f.baseUrl + "/blog/seo-fixture")).status, 404);
  await page.getByLabel("Mô tả ảnh bìa", { exact: true }).fill("Sổ giấy kiểm chứng");
  await publication("Đăng bài");
  const response = await fetch(f.baseUrl + "/blog/seo-fixture"),
    html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<h1[^>]*>SEO fixture<\/h1>/);
  assert.doesNotMatch(html, /id="root"/);
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
  assert.match(html, /BlogPosting/);
  assert.match(html, /rel="canonical"/);
  assert.equal((await fetch(f.baseUrl + publicMedia)).status, 200);
  await documentPage.goto(f.baseUrl + "/blog/seo-fixture");
  assert.equal(await documentPage.locator("h1").textContent(), "SEO fixture");
  assert.equal(
    await documentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
  );
  const cover = await documentPage
    .locator('[data-cover] [data-media-frame="article"]')
    .boundingBox();
  assert.ok(cover && Math.abs(cover.width / cover.height - 1.5) < 0.03);
  await documentPage.screenshot({
    path: join(evidenceDir, "article-no-js-mobile.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: join(evidenceDir, "editor-published.png"),
    mask: [page.locator('input[type="password"]')],
  });
  for (const signal of ["opt-out", "DNT", "GPC"]) {
    const privateContext = await browserContext(browser);
    await privateContext.addInitScript((signal) => {
      if (signal === "opt-out") {
        try {
          localStorage.setItem("bibi.analytics.disabled", "true");
        } catch {}
      } else
        Object.defineProperty(navigator, signal === "GPC" ? "globalPrivacyControl" : "doNotTrack", {
          configurable: true,
          value: signal === "GPC" ? true : "1",
        });
    }, signal);
    const privatePage = await privateContext.newPage();
    await privatePage.clock.install({ time: Date.now() });
    let sent = 0;
    privatePage.on("request", (request) => {
      if (
        /\/api\/analytics\/(?:relay\/collect\.php|collect)$/.test(new URL(request.url()).pathname)
      )
        sent++;
    });
    await privatePage.goto(f.baseUrl + "/blog/seo-fixture", { waitUntil: "networkidle" });
    await privatePage.clock.fastForward(60000);
    await privatePage.waitForTimeout(100);
    assert.equal(sent, 0, signal + " must suppress native collection");
    await privateContext.close();
  }
  const publicContext = await browserContext(browser, { viewport: { width: 390, height: 844 } }),
    publicPage = await publicContext.newPage();
  await publicPage.clock.install({ time: Date.now() });
  await publicPage.goto(f.baseUrl + "/blog/seo-fixture", { waitUntil: "networkidle" });
  let tracked = 0;
  for (let attempt = 0; attempt < 3 && tracked === 0; attempt++) {
    const collection = publicPage.waitForResponse(
      (r) =>
        /\/api\/analytics\/(?:relay\/collect\.php|collect)$/.test(new URL(r.url()).pathname) &&
        r.request().method() === "POST",
    );
    await publicPage.clock.fastForward(16000);
    const acknowledgement = await collection;
    assert.ok([202, 204].includes(acknowledgement.status()));
    await acknowledgement.finished();
    const [[row]] = await f.pool.execute(
      "SELECT COUNT(*) n FROM visitor_session_pages WHERE path=?",
      ["/blog/seo-fixture"],
    );
    tracked = row.n;
  }
  assert.ok(tracked > 0, "cookie bootstrap and accepted batch record the published dynamic path");
  await publicPage.goto(f.baseUrl + "/");
  const highlight = publicPage.locator('a[href="/blog/seo-fixture"]').first();
  await highlight.waitFor();
  await publicPage.evaluate(() => {
    window.__cmsDocumentBoundary = "home";
  });
  await Promise.all([
    publicPage.waitForNavigation({ waitUntil: "domcontentloaded" }),
    highlight.click(),
  ]);
  assert.equal(await publicPage.evaluate(() => window.__cmsDocumentBoundary), undefined);
  await publicPage.goBack();
  assert.equal(new URL(publicPage.url()).pathname, "/");
  await publicPage.goForward();
  assert.equal(new URL(publicPage.url()).pathname, "/blog/seo-fixture");
  await publicPage.goto(f.baseUrl + "/blog", { waitUntil: "networkidle" });
  const card = await publicPage
    .locator('[data-post-card] [data-media-frame="card"]')
    .first()
    .boundingBox();
  assert.ok(card && Math.abs(card.width / card.height - 1) < 0.03);
  assert.equal(
    await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
  );
  await publicPage.screenshot({ path: join(evidenceDir, "listing-mobile.png"), fullPage: true });
  const categoryResponse = await fetch(f.baseUrl + "/blog/category/seo-cap-3");
  assert.equal(categoryResponse.status, 200);
  assert.match(await categoryResponse.text(), /SEO fixture/);
  await publicContext.close();
  // Subsequent saves stay private until a separate successful job.
  post = await (await contentRequest(f, token, "/posts/" + post.id)).json();
  const draftResponse = await contentRequest(f, token, "/posts/" + post.id, "PUT", {
    input: postInput(post, { title: "Nháp riêng chưa đăng" }),
    expectedRevision: post.revision,
  });
  assert.equal(draftResponse.status, 200);
  post = await draftResponse.json();
  assert.match(
    await (await fetch(f.baseUrl + "/blog/seo-fixture")).text(),
    /<h1[^>]*>SEO fixture<\/h1>/,
  );
  await page.reload();
  await page.getByLabel("Tiêu đề", { exact: true }).waitFor();
  await publication("Cập nhật bài");
  assert.match(await (await fetch(f.baseUrl + "/blog/seo-fixture")).text(), /Nháp riêng chưa đăng/);
  for (const slug of ["seo-fixture-two", "seo-fixture-final"]) {
    post = await (await contentRequest(f, token, "/posts/" + post.id)).json();
    const save = await contentRequest(f, token, "/posts/" + post.id, "PUT", {
      input: postInput(post, { slug }),
      expectedRevision: post.revision,
    });
    assert.equal(save.status, 200);
    post = await save.json();
    const requested = await contentRequest(f, token, "/publications", "POST", {
      action: "publish",
      targetId: post.id,
      expectedRevision: post.revision,
      idempotencyKey: randomUUID(),
    });
    assert.equal(requested.status, 202);
    jobs.push(await waitForContentJob(f, token, (await requested.json()).id));
  }
  for (const slug of ["seo-fixture", "seo-fixture-two"]) {
    const alias = await fetch(f.baseUrl + "/blog/" + slug, { redirect: "manual" });
    assert.equal(alias.status, 301);
    assert.equal(
      new URL(alias.headers.get("location"), f.baseUrl).href,
      f.baseUrl + "/blog/seo-fixture-final",
    );
  }
  const finalResponse = await fetch(f.baseUrl + "/blog/seo-fixture-final", { redirect: "manual" });
  assert.equal(finalResponse.status, 200);
  await finalResponse.arrayBuffer();
  assert.match(await (await fetch(f.baseUrl + "/sitemaps/blog.xml")).text(), /seo-fixture-final/);
  await page.reload();
  await page.getByRole("button", { name: "Gỡ về nháp", exact: true }).waitFor();
  await publication("Gỡ về nháp");
  assert.equal((await fetch(f.baseUrl + "/blog/seo-fixture-final")).status, 404);
  assert.doesNotMatch(
    await (await fetch(f.baseUrl + "/sitemaps/blog.xml")).text(),
    /seo-fixture-final/,
  );
  assert.equal((await fetch(f.baseUrl + publicMedia)).status, 200);
  post = await (await contentRequest(f, token, "/posts/" + post.id)).json();
  const trashed = await contentRequest(f, token, "/posts/" + post.id + "/trash", "POST", {
    expectedRevision: post.revision,
  });
  assert.equal(trashed.status, 200);
  await trashed.arrayBuffer();
  await page.goto(f.baseUrl + "/admin/content/posts");
  await page.getByRole("combobox", { name: /^Trạng thái/ }).selectOption("trash");
  const restoring = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/content/posts/" + post.id + "/restore" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Khôi phục", exact: true }).click();
  assert.equal((await restoring).status(), 200);
  const restored = await (await contentRequest(f, token, "/posts/" + post.id)).json();
  assert.equal(restored.trashedAt, null);
  assert.equal(restored.public, null);
  assert.equal((await fetch(f.baseUrl + "/blog/seo-fixture-final")).status, 404);
  await writeFile(
    join(evidenceDir, "publication.json"),
    JSON.stringify(
      {
        mode,
        postId: post.id,
        jobs: jobs.map(({ id, status, generationId }) => ({ id, status, generationId })),
        initialHtml: { status: 200, h1: "SEO fixture", jsDisabled: true },
        unpublishStatus: 404,
        publicMediaRetained: true,
      },
      null,
      2,
    ),
  );
  await browser.close();
  return {
    postId: post.id,
    jobs,
    checks: {
      sharedDraft: true,
      permissionBoundary: true,
      categoriesThreeLevels: true,
      draftPrivate: true,
      publication: true,
      draftIsolation: true,
      update: true,
      redirectsOneHop: true,
      unpublish404: true,
      restoreDraft: true,
      publicMediaRetained: true,
      initialHtml: true,
      jsDisabled: true,
      documentNavigation: true,
      dynamicAnalytics: true,
      privacy: true,
      mobile: true,
    },
  };
}
