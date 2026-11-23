import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";

const directory = resolve("backend/content-migrations");

const seed = {
  posts: [
    {
      slug: "post-old",
      title: "Post cũ",
      excerpt: "Tóm tắt cũ",
      content: "<p>Nội dung cũ</p>",
      categorySlug: "cam-hung",
      status: "published",
      publishAt: "2026-01-01",
      imageId: "cover-old",
      coverImageId: "/assets/blog/old.jpg",
      readTime: "5 phút đọc",
      seoTitle: "SEO cũ",
      seoDescription: "Mô tả cũ",
    },
    {
      slug: "post-new",
      title: "Post mới",
      excerpt: "Tóm tắt mới",
      content: "<p>Nội dung mới</p>",
      categorySlug: "huong-dan",
      status: "published",
      publishAt: "2026-02-01",
      imageId: "cover-new",
      seoTitle: "SEO mới",
      seoDescription: "Mô tả mới",
    },
    {
      slug: "post-scheduled",
      title: "Post hẹn giờ",
      excerpt: "Hẹn giờ",
      content: "<p>Hẹn giờ</p>",
      categorySlug: null,
      status: "published",
      publishAt: "2026-12-01T00:00:00Z",
      imageId: null,
      seoTitle: "",
      seoDescription: "",
    },
    {
      slug: "post-draft",
      title: "Post nháp",
      excerpt: "Nháp",
      content: "<p>Nháp</p>",
      categorySlug: null,
      status: "draft",
      publishAt: null,
      imageId: null,
      seoTitle: "",
      seoDescription: "",
    },
  ],
  products: [
    {
      productCode: "0001",
      name: "Sản phẩm A",
      slug: "san-pham-a",
      shortDescription: "Mô tả ngắn A",
      description: "Mô tả A",
      productType: "notebook",
      collection: "motivation",
      categorySlug: "motivation",
      status: "published",
      imageIds: ["image-a-0", "/catalogue/a.webp"],
      tags: ["Việt Nam"],
      seoTitle: "SEO A",
      seoDescription: "Mô tả A",
      nameEn: "Product A",
      shortDescriptionEn: "Short A",
      descriptionEn: "Description A",
      dimensions: "A5",
      pages: "80",
      materialVi: "Giấy",
      materialEn: "Paper",
      formatVi: "Khổ A5",
      formatEn: "A5 format",
      occasion: "birthday",
      featured: true,
      sortOrder: 3,
      imageAltVi: "Alt A",
      imageAltEn: "Alt A EN",
    },
    {
      productCode: "0002",
      name: "Sản phẩm B",
      slug: "san-pham-b",
      shortDescription: "Mô tả ngắn B",
      description: "Mô tả B",
      productType: "notebook",
      collection: "motivation",
      categorySlug: "motivation",
      status: "draft",
      imageIds: [],
      tags: [],
      seoTitle: "",
      seoDescription: "",
    },
  ],
  productCategories: [
    { slug: "motivation", name: "Tạo động lực", description: "Mô tả", position: 0 },
  ],
  contentCategories: [
    { slug: "cam-hung", name: "Cảm hứng", position: 0 },
    { slug: "huong-dan", name: "Hướng dẫn", position: 1 },
  ],
};

async function buildApp(t) {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
  const { seedContent } = await import("../dist/content/seed.js");
  await seedContent(f.pool, seed);
  const { createApp } = await import("../dist/app.js");
  const { serve } = await import("./helpers/http.mjs");
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      {
        db: f.pool,
        config: f.config,
        clock: f.clock,
        content: { schemaDirectory: directory },
      },
    ),
  );
  return { f, base };
}

test("public posts endpoints serve only published posts with full shape", async (t) => {
  const { base } = await buildApp(t);

  const list = await fetch(base + "/api/public/posts");
  assert.equal(list.status, 200);
  const posts = await list.json();
  assert.equal(posts.length, 2);
  assert.deepEqual(
    posts.map((post) => post.slug),
    ["post-new", "post-old"],
  );
  for (const post of posts) assert.equal(post.status, undefined, "status not leaked");
  for (const post of posts) assert.equal("content" in post, false, "list carries no article body");
  assert.equal(posts[0].excerpt, "Tóm tắt mới");
  assert.equal(posts[0].seo_title, "SEO mới");

  const detail = await fetch(base + "/api/public/posts/post-old");
  assert.equal(detail.status, 200);
  const post = await detail.json();
  assert.equal(post.slug, "post-old");
  assert.equal(post.title, "Post cũ");
  assert.equal(post.seo_title, "SEO cũ");
  assert.equal(post.category_name, "Cảm hứng");
  assert.equal(post.author_name, "BiBi Studio");
  assert.equal(post.read_time, "5 phút đọc");
  assert.equal(post.cover_url, "/assets/blog/old.jpg");
  assert.match(post.content, /Nội dung cũ/);

  const fresh = await (await fetch(base + "/api/public/posts/post-new")).json();
  assert.equal(fresh.category_name, "Hướng dẫn");
  assert.equal(fresh.author_name, "BiBi Studio");
  assert.equal(fresh.cover_url, "/api/media/cover-new");

  assert.equal((await fetch(base + "/api/public/posts/post-draft")).status, 404);
  assert.equal((await fetch(base + "/api/public/posts/missing-slug")).status, 404);
});

test("published posts dated in the future stay hidden until their publish time", async (t) => {
  const { f, base } = await buildApp(t);
  const slugs = async () =>
    (await (await fetch(base + "/api/public/posts")).json()).map((post) => post.slug);

  assert.deepEqual(await slugs(), ["post-new", "post-old"]);
  assert.equal((await fetch(base + "/api/public/posts/post-scheduled")).status, 404);

  f.clock.set("2026-11-30T23:59:59Z");
  assert.equal((await fetch(base + "/api/public/posts/post-scheduled")).status, 404);

  f.clock.set("2026-12-01T00:00:00Z");
  assert.deepEqual(await slugs(), ["post-scheduled", "post-new", "post-old"]);
  assert.equal((await fetch(base + "/api/public/posts/post-scheduled")).status, 200);
});

test("public products endpoints serve only published products with full shape", async (t) => {
  const { base } = await buildApp(t);

  const list = await fetch(base + "/api/public/products");
  assert.equal(list.status, 200);
  const products = await list.json();
  assert.equal(products.length, 1);
  assert.equal(products[0].slug, "san-pham-a");
  assert.deepEqual(products[0].images, ["/api/media/image-a-0", "/catalogue/a.webp"]);

  const detail = await fetch(base + "/api/public/products/san-pham-a");
  assert.equal(detail.status, 200);
  const product = await detail.json();
  assert.equal(product.slug, "san-pham-a");
  assert.deepEqual(product.name, { vi: "Sản phẩm A", en: "Product A" });
  assert.deepEqual(product.description, { vi: "Mô tả A", en: "Description A" });
  assert.equal(product.short_description, "Mô tả ngắn A");
  assert.equal(product.product_type, "notebook");
  assert.equal(product.collection, "motivation");
  assert.equal(product.price, 0);
  assert.equal(product.compare_at, 0);
  assert.deepEqual(product.images, ["/api/media/image-a-0", "/catalogue/a.webp"]);
  assert.deepEqual(product.image_alt, { vi: "Alt A", en: "Alt A EN" });
  assert.equal(product.dimensions, "A5");
  assert.equal(product.pages, "80");
  assert.deepEqual(product.material, { vi: "Giấy", en: "Paper" });
  assert.deepEqual(product.format, { vi: "Khổ A5", en: "A5 format" });
  assert.equal(product.occasion, "birthday");
  assert.equal(product.featured, true);
  assert.equal(product.sort_order, 3);
  assert.equal(product.seo_title, "SEO A");
  assert.equal(product.seo_description, "Mô tả A");

  assert.equal((await fetch(base + "/api/public/products/san-pham-b")).status, 404);
  assert.equal((await fetch(base + "/api/public/products/missing-slug")).status, 404);
});

test("public categories endpoints list categories by scope", async (t) => {
  const { base } = await buildApp(t);

  const content = await (await fetch(base + "/api/public/categories?scope=content")).json();
  assert.deepEqual(
    content.map((cat) => cat.slug),
    ["cam-hung", "huong-dan"],
  );

  const product = await (await fetch(base + "/api/public/categories?scope=product")).json();
  assert.deepEqual(
    product.map((cat) => cat.slug),
    ["motivation"],
  );

  const defaults = await (await fetch(base + "/api/public/categories")).json();
  assert.deepEqual(
    defaults.map((cat) => cat.slug),
    ["motivation"],
  );
});

test("public collections endpoint returns name/slug/tagline", async (t) => {
  const { base } = await buildApp(t);

  const collections = await (await fetch(base + "/api/public/collections")).json();
  assert.deepEqual(collections, [{ slug: "motivation", name: "Tạo động lực", tagline: "Mô tả" }]);
});

test("successful public reads are cacheable for a minute, misses are not", async (t) => {
  const { base } = await buildApp(t);

  for (const path of [
    "/api/public/posts",
    "/api/public/posts/post-old",
    "/api/public/products",
    "/api/public/products/san-pham-a",
    "/api/public/categories",
    "/api/public/collections",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60", path);
  }
  for (const path of ["/api/public/posts/missing-slug", "/api/public/products/san-pham-b"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
  }
  assert.equal((await fetch(base + "/api/health")).headers.get("cache-control"), "no-store");
});

test("public lists stop at the row limit", async (t) => {
  const { f, base } = await buildApp(t);
  const { PUBLIC_LIST_LIMIT } = await import("../dist/content/public-service.js");
  assert.equal(PUBLIC_LIST_LIMIT, 500);

  const [[category]] = await f.pool.query("SELECT id FROM product_categories LIMIT 1");
  const [[template]] = await f.pool.query("SELECT * FROM products WHERE slug='san-pham-a'");
  const [[post]] = await f.pool.query("SELECT * FROM posts WHERE slug='post-old'");
  const { randomUUID } = await import("node:crypto");
  const rows = (source, patch) =>
    Array.from({ length: PUBLIC_LIST_LIMIT + 5 }, (_, i) =>
      Object.values({ ...source, id: randomUUID(), ...patch(i) }).map((value) =>
        value !== null && typeof value === "object" && !(value instanceof Date)
          ? JSON.stringify(value)
          : value,
      ),
    );
  assert.ok(category);
  await f.pool.query(
    `INSERT INTO products (${Object.keys(template)
      .map((key) => "`" + key + "`")
      .join(",")}) VALUES ?`,
    [
      rows(template, (i) => ({
        slug: `bulk-${i}`,
        product_code: `B${String(i).padStart(4, "0")}`,
        sort_order: 100 + i,
      })),
    ],
  );
  await f.pool.query(
    `INSERT INTO posts (${Object.keys(post)
      .map((key) => "`" + key + "`")
      .join(",")}) VALUES ?`,
    [rows(post, (i) => ({ slug: `bulk-${i}`, publish_at: "2025-01-01 00:00:00" }))],
  );

  const products = await (await fetch(base + "/api/public/products")).json();
  assert.equal(products.length, PUBLIC_LIST_LIMIT);
  assert.equal(products[0].slug, "san-pham-a", "lowest sort order first");
  const posts = await (await fetch(base + "/api/public/posts")).json();
  assert.equal(posts.length, PUBLIC_LIST_LIMIT);
  assert.deepEqual(
    posts.slice(0, 2).map((item) => item.slug),
    ["post-new", "post-old"],
    "newest first",
  );
});
