import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { createAuthFixture } from "./helpers/auth.mjs";

const directory = resolve("backend/content-migrations");

const sampleData = {
  posts: [
    {
      slug: "bai-1",
      title: "Bài viết 1",
      excerpt: "Tóm tắt",
      content: "<p>Nội dung 1</p>",
      categorySlug: "cam-hung",
      status: "published",
      publishAt: "2026-08-25",
      imageId: "journal-cover-bai-1",
      seoTitle: "",
      seoDescription: "",
    },
    {
      slug: "bai-2",
      title: "Bài viết 2",
      excerpt: "Tóm tắt 2",
      content: "<h2>Tiêu đề</h2><p>Nội dung 2</p>",
      categorySlug: "huong-dan",
      status: "published",
      publishAt: "2026-08-20",
      imageId: "journal-cover-bai-2",
      seoTitle: "",
      seoDescription: "",
    },
  ],
  products: [
    {
      productCode: "0001",
      name: "Sản phẩm A",
      slug: "san-pham-a",
      shortDescription: "Mô tả ngắn",
      description: "Mô tả A",
      productType: "notebook",
      collection: "motivation",
      categorySlug: "motivation",
      status: "published",
      imageIds: ["catalogue-image-san-pham-a-0"],
      tags: ["Việt Nam"],
      seoTitle: "",
      seoDescription: "",
    },
  ],
  productCategories: [{ slug: "motivation", name: "Tạo động lực", description: "Mô tả", position: 0 }],
  contentCategories: [
    { slug: "cam-hung", name: "Cảm hứng", position: 0 },
    { slug: "huong-dan", name: "Hướng dẫn", position: 1 },
  ],
};

test("seedContent inserts once, holds the author FK, and is idempotent", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
  const { seedContent, SYSTEM_AUTHOR_ID } = await import("../dist/content/seed.js");

  const first = await seedContent(f.pool, sampleData);
  assert.equal(first, 2 + 1 + 1 + 2);

  const [[{ n: postCount }]] = await f.pool.query("SELECT COUNT(*) n FROM posts");
  const [[{ n: productCount }]] = await f.pool.query("SELECT COUNT(*) n FROM products");
  assert.equal(postCount, 2);
  assert.equal(productCount, 1);

  const [[author]] = await f.pool.query("SELECT id, active FROM users WHERE id=?", [
    SYSTEM_AUTHOR_ID,
  ]);
  assert.equal(author.id, SYSTEM_AUTHOR_ID);
  assert.equal(author.active, 1);

  const [posts] = await f.pool.query(
    "SELECT category_id, author_id, status, publish_at FROM posts ORDER BY slug",
  );
  for (const post of posts) {
    assert.ok(post.category_id, "post category resolved by slug");
    assert.equal(post.author_id, SYSTEM_AUTHOR_ID);
    assert.equal(post.status, "published");
    assert.ok(post.publish_at);
  }
  const [products] = await f.pool.query("SELECT category_id, image_ids, tags FROM products");
  assert.ok(products[0].category_id, "product category resolved by slug");
  assert.deepEqual(products[0].image_ids, ["catalogue-image-san-pham-a-0"]);
  assert.deepEqual(products[0].tags, ["Việt Nam"]);

  const second = await seedContent(f.pool, sampleData);
  assert.equal(second, 0);
  const [[{ n: postCount2 }]] = await f.pool.query("SELECT COUNT(*) n FROM posts");
  const [[{ n: productCount2 }]] = await f.pool.query("SELECT COUNT(*) n FROM products");
  assert.equal(postCount2, 2);
  assert.equal(productCount2, 1);
});

test("seedContent seeds the generated legacy dataset idempotently", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
  const { seedContent } = await import("../dist/content/seed.js");
  const data = JSON.parse(await readFile(resolve("backend/content-seed.json"), "utf8"));

  const first = await seedContent(f.pool, data);
  assert.equal(
    first,
    data.posts.length +
      data.products.length +
      data.productCategories.length +
      data.contentCategories.length,
  );
  const second = await seedContent(f.pool, data);
  assert.equal(second, 0);
});
