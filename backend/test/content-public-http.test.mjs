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
      imageIds: ["image-a-0"],
      tags: ["Việt Nam"],
      seoTitle: "SEO A",
      seoDescription: "Mô tả A",
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

test("public posts endpoints serve only published posts without auth", async (t) => {
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

  const detail = await fetch(base + "/api/public/posts/post-old");
  assert.equal(detail.status, 200);
  const post = await detail.json();
  assert.equal(post.slug, "post-old");
  assert.equal(post.title, "Post cũ");
  assert.equal(post.seo_title, "SEO cũ");

  assert.equal((await fetch(base + "/api/public/posts/post-draft")).status, 404);
  assert.equal((await fetch(base + "/api/public/posts/missing-slug")).status, 404);
});

test("public products endpoints serve only published products without auth", async (t) => {
  const { base } = await buildApp(t);

  const list = await fetch(base + "/api/public/products");
  assert.equal(list.status, 200);
  const products = await list.json();
  assert.equal(products.length, 1);
  assert.equal(products[0].slug, "san-pham-a");
  assert.deepEqual(products[0].image_ids, ["image-a-0"]);

  const detail = await fetch(base + "/api/public/products/san-pham-a");
  assert.equal(detail.status, 200);
  const product = await detail.json();
  assert.equal(product.slug, "san-pham-a");
  assert.equal(product.product_type, "notebook");

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
