import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { renderContentGeneration } from "../dist/content/render/document.js";
import { planPublicRoutes } from "../dist/content/render/routes.js";
import { makePublicSnapshot, makePublicAssets } from "./helpers/public-content.mjs";
const origin = "https://bibistudio.vn",
  digest = (value) => createHash("sha256").update(value).digest("hex");
function page(t, output, path) {
  const route = output.manifest.routes[path];
  assert.equal(route.kind, "html");
  const bytes = output.files.get(route.file);
  assert.ok(bytes);
  const dom = new JSDOM(Buffer.from(bytes).toString("utf8"), { url: origin + path });
  t.after(() => dom.window.close());
  return dom.window.document;
}
test("ten published articles create nine plus one and a canonical route", async (t) => {
  const snapshot = makePublicSnapshot(),
    output = await renderContentGeneration(snapshot, makePublicAssets(), origin),
    one = page(t, output, "/blog"),
    two = page(t, output, "/blog/page/2");
  assert.equal(one.querySelectorAll("[data-post-card]").length, 9);
  assert.equal(two.querySelectorAll("[data-post-card]").length, 1);
  assert.equal(one.querySelectorAll("h1").length, 1);
  assert.equal(two.querySelector('link[rel="canonical"]').href, origin + "/blog/page/2");
  assert.ok(one.querySelector('a[href="/blog/page/2"]'));
  assert.deepEqual(output.manifest.routes["/blog?page=2"], {
    kind: "redirect",
    status: 301,
    location: "/blog/page/2",
  });
  assert.equal(output.manifest.routes["/blog/page/1"].location, "/blog");
  assert.equal(output.manifest.routes["/blog/page/2/"].location, "/blog/page/2");
  const frame = one.querySelector("[data-post-card] [data-media-frame]");
  assert.equal(frame.style.aspectRatio.replace(/\s/g, ""), "1/1");
  for (const [file, hash] of Object.entries(output.manifest.fileHashes))
    assert.equal(digest(output.files.get(file)), hash);
  for (const route of Object.values(output.manifest.routes))
    if (route.kind === "html") assert.equal(route.sha256, output.manifest.fileHashes[route.file]);
});
test("article is a complete native document with visible body and responsive managed photos", async (t) => {
  const snapshot = makePublicSnapshot(),
    post = snapshot.posts[0],
    output = await renderContentGeneration(snapshot, makePublicAssets(), origin),
    doc = page(t, output, "/blog/" + post.slug);
  assert.equal(doc.querySelectorAll("h1").length, 1);
  assert.equal(doc.querySelector("h1").textContent, post.title);
  assert.match(doc.querySelector("main").textContent, /Nội dung công khai 0/);
  assert.match(doc.querySelector("main").textContent, /Chú thích 0/);
  assert.equal(doc.documentElement.lang, "vi");
  assert.equal(doc.querySelector('link[rel="canonical"]').href, origin + "/blog/" + post.slug);
  assert.equal(
    doc.querySelector('script[type="module"]').getAttribute("src"),
    makePublicAssets().script,
  );
  assert.equal(doc.getElementById("root"), null);
  const articleImages = doc.querySelectorAll("[data-cover] img,[data-article-body] img");
  assert.equal(articleImages.length, 2);
  for (const image of articleImages) {
    assert.match(image.getAttribute("src"), /^\/media\/content\/[a-f0-9]{64}\.webp$/);
    assert.ok(Number(image.getAttribute("width")) > 0);
    assert.ok(Number(image.getAttribute("height")) > 0);
    assert.match(image.getAttribute("srcset"), /480w.*960w.*1600w.*2400w/);
    const frame = image.closest("[data-media-frame]");
    assert.equal(frame.style.aspectRatio.replace(/\s/g, ""), "3/2");
  }
  assert.ok(doc.querySelector("table").closest("[data-table-scroll]"));
  assert.ok(doc.querySelector('a[href="/blog/category/but-va-giay"]'));
  assert.equal(doc.querySelectorAll("[data-related-post]").length, 3);
  assert.doesNotMatch(
    doc.documentElement.outerHTML,
    /lovable\.app|tinymce|admin-entry|bibi-media:|blob:/i,
  );
});
test("category hierarchy has flat slug URLs and empty archives stay usable but noindex", async (t) => {
  const snapshot = makePublicSnapshot(),
    output = await renderContentGeneration(snapshot, makePublicAssets(), origin),
    parent = page(t, output, "/blog/category/huong-dan"),
    child = page(t, output, "/blog/category/but-va-giay"),
    empty = page(t, output, "/blog/category/cam-hung");
  assert.equal(parent.querySelectorAll("[data-post-card]").length, 9);
  assert.ok(child.querySelector('a[href="/blog/category/viet-tay"]'));
  assert.match(empty.querySelector('meta[name="robots"]').content, /noindex/);
  assert.match(empty.querySelector("main").textContent, /chưa có bài/i);
  assert.equal(output.manifest.routes["/blog/category/huong-dan/viet-tay"], undefined);
  const xml = Buffer.from(
    output.files.get(output.manifest.routes["/sitemaps/blog.xml"].file),
  ).toString("utf8");
  assert.doesNotMatch(xml, /category\/cam-hung/);
  assert.match(xml, /category\/but-va-giay/);
});
test("aliases flatten to one hop and cannot steal a current canonical route", () => {
  const snapshot = makePublicSnapshot();
  snapshot.redirects = { "/blog/old-one": "/blog/old-two", "/blog/old-two": "/blog/post-0" };
  const routes = planPublicRoutes(snapshot);
  assert.deepEqual(routes["/blog/old-one"], {
    kind: "redirect",
    status: 301,
    location: "/blog/post-0",
  });
  assert.throws(
    () => planPublicRoutes({ ...snapshot, redirects: { "/blog/post-1": "/blog/post-0" } }),
    /canonical|collision|owner/i,
  );
  assert.throws(
    () =>
      planPublicRoutes({ ...snapshot, redirects: { "/blog/a": "/blog/b", "/blog/b": "/blog/a" } }),
    /cycle|alias|redirect/i,
  );
});
test("working draft flags and unpublished extra data are rejected before rendering", async () => {
  const snapshot = makePublicSnapshot();
  await assert.rejects(
    renderContentGeneration(
      { ...snapshot, drafts: [{ title: "raw draft secret" }] },
      makePublicAssets(),
      origin,
    ),
    /snapshot|public|invalid/i,
  );
  snapshot.posts[0].status = "draft";
  await assert.rejects(
    renderContentGeneration(snapshot, makePublicAssets(), origin),
    /snapshot|public|invalid/i,
  );
});
test("unsanitized body markup cannot enter a public document", async () => {
  const snapshot = makePublicSnapshot({ postCount: 1 });
  snapshot.posts[0].html = '<p onclick="bad()">Text</p>';
  await assert.rejects(
    renderContentGeneration(snapshot, makePublicAssets(), origin),
    /html|snapshot|public|invalid/i,
  );
});
