import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderContentGeneration } from "../dist/content/render/document.js";
import { buildSiteSitemap } from "../dist/content/render/sitemap.js";
import { makePublicSnapshot, makePublicAssets } from "./helpers/public-content.mjs";
const origin = "https://bibistudio.vn";
test("Article metadata and JSON-LD escape title injection and use the snapshot author", async (t) => {
  const snapshot = makePublicSnapshot({ postCount: 1 }),
    post = snapshot.posts[0];
  post.title = '</script><script>window.pwn=1</script> & "Bút"';
  post.seoDescription = '" onload="bad() <meta>';
  post.author = { kind: "account", name: "Nguyễn A & B" };
  const output = await renderContentGeneration(snapshot, makePublicAssets(), origin),
    bytes = output.files.get(output.manifest.routes["/blog/post-0"].file),
    html = Buffer.from(bytes).toString("utf8"),
    dom = new JSDOM(html);
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  assert.equal(doc.querySelector("h1").textContent, post.title);
  assert.equal(doc.querySelector('meta[name="description"]').content, post.seoDescription);
  assert.equal(doc.querySelectorAll('meta[name="description"]').length, 1);
  assert.equal(
    doc.querySelectorAll(
      "script:not([src]):not([type='application/ld+json']):not([type='application/json'])",
    ).length,
    0,
  );
  const graph = [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(
      (script) => {
        const value = JSON.parse(script.textContent);
        return value["@graph"] ?? [value];
      },
    ),
    article = graph.find((item) => item["@type"] === "BlogPosting"),
    breadcrumbs = graph.find((item) => item["@type"] === "BreadcrumbList");
  assert.equal(article.headline, post.title);
  assert.equal(article.author["@type"], "Person");
  assert.equal(article.author.name, post.author.name);
  assert.equal(article.datePublished, post.publishedAt);
  assert.equal(article.dateModified, post.modifiedAt);
  assert.ok(article.image.startsWith(origin + "/media/content/"));
  assert.equal(breadcrumbs.itemListElement.at(-1).item, origin + "/blog/post-0");
  assert.doesNotMatch(html, /<script>window\.pwn/);
});
test("legacy date precision, SEO fallbacks and organization author remain truthful", async (t) => {
  const snapshot = makePublicSnapshot({ postCount: 1 });
  snapshot.posts[0].publishedAt = "2026-08-25";
  snapshot.posts[0].modifiedAt = "2026-08-25";
  const output = await renderContentGeneration(snapshot, makePublicAssets(), origin),
    dom = new JSDOM(
      Buffer.from(output.files.get(output.manifest.routes["/blog/post-0"].file)).toString("utf8"),
    );
  t.after(() => dom.window.close());
  const doc = dom.window.document,
    graphs = [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
      const value = JSON.parse(script.textContent);
      return value["@graph"] ?? [value];
    }),
    article = graphs.find((item) => item["@type"] === "BlogPosting");
  assert.equal(doc.title, snapshot.posts[0].title + " — BiBi Studio");
  assert.equal(doc.querySelector('meta[name="description"]').content, snapshot.posts[0].excerpt);
  assert.equal(article.author["@type"], "Organization");
  assert.equal(article.datePublished, "2026-08-25");
  assert.ok(doc.querySelector('time[datetime="2026-08-25"]'));
});
test("static sitemap excludes Blog and private surfaces and emits valid canonical XML", () => {
  const xml = buildSiteSitemap(
      [
        { path: "/" },
        { path: "/products", lastmod: "2026-11-01T00:00:00Z" },
        { path: "/admin" },
        { path: "/api/health" },
        { path: "/preview/x" },
        { path: "/blog/post-0" },
      ],
      origin,
    ),
    dom = new JSDOM(xml, { contentType: "application/xml" });
  try {
    const locs = [...dom.window.document.querySelectorAll("loc")].map((node) => node.textContent);
    assert.deepEqual(locs, [origin + "/", origin + "/products"]);
    assert.match(xml, /2026-11-01/);
    assert.doesNotMatch(xml, /lovable|admin|api\/|preview|blog/);
  } finally {
    dom.window.close();
  }
});
