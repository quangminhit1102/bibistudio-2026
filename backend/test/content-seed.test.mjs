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
      readTime: "5 phút đọc",
      coverImageId: "/assets/blog/test.jpg",
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
      readTime: "4 phút đọc",
      coverImageId: "/assets/blog/test2.jpg",
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
      nameEn: "Product A",
      shortDescriptionEn: "Short description",
      descriptionEn: "Description A",
      dimensions: "A5",
      pages: "100",
      materialVi: "Giấy",
      materialEn: "Paper",
      formatVi: "14x20cm",
      formatEn: "14x20cm",
      occasion: "womens-day-83",
      featured: true,
      sortOrder: 1,
      imageAltVi: "Sản phẩm A — sản phẩm BiBi Studio",
      imageAltEn: "Product A — a BiBi Studio paper good",
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
    "SELECT category_id, author_id, status, publish_at, content FROM posts ORDER BY slug",
  );
  for (const post of posts) {
    assert.ok(post.category_id, "post category resolved by slug");
    assert.equal(post.author_id, SYSTEM_AUTHOR_ID);
    assert.equal(post.status, "published");
    assert.ok(post.publish_at);
    const envelope = JSON.parse(post.content);
    assert.equal(envelope.format, "html-v1");
    assert.equal(typeof envelope.html, "string");
  }
  assert.match(JSON.parse(posts[0].content).html, /<p>Nội dung 1<\/p>/);
  const [postFields] = await f.pool.query(
    "SELECT read_time, cover_image_id FROM posts ORDER BY slug",
  );
  assert.equal(postFields[0].read_time, "5 phút đọc");
  assert.equal(postFields[0].cover_image_id, "/assets/blog/test.jpg");
  const [products] = await f.pool.query("SELECT category_id, image_ids, tags FROM products");
  assert.ok(products[0].category_id, "product category resolved by slug");
  assert.deepEqual(products[0].image_ids, ["catalogue-image-san-pham-a-0"]);
  assert.deepEqual(products[0].tags, ["Việt Nam"]);
  const [productFields] = await f.pool.query(
    "SELECT name_en, short_description_en, description_en, dimensions, pages, material_vi, material_en, format_vi, format_en, occasion, featured, sort_order, image_alt_vi, image_alt_en FROM products",
  );
  assert.equal(productFields[0].name_en, "Product A");
  assert.equal(productFields[0].description_en, "Description A");
  assert.equal(productFields[0].dimensions, "A5");
  assert.equal(productFields[0].pages, "100");
  assert.equal(productFields[0].material_vi, "Giấy");
  assert.equal(productFields[0].material_en, "Paper");
  assert.equal(productFields[0].format_vi, "14x20cm");
  assert.equal(productFields[0].occasion, "womens-day-83");
  assert.equal(productFields[0].featured, 1);
  assert.equal(productFields[0].sort_order, 1);
  assert.equal(productFields[0].image_alt_vi, "Sản phẩm A — sản phẩm BiBi Studio");
  assert.equal(productFields[0].image_alt_en, "Product A — a BiBi Studio paper good");

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
      data.productTypes.length +
      data.contentCategories.length,
  );
  const second = await seedContent(f.pool, data);
  assert.equal(second, 0);
});

const catalogueData = {
  ...sampleData,
  productTypes: [
    {
      code: "notebook",
      slug: "notebooks",
      name: "Sổ tay",
      description: "Giấy nhỏ",
      position: 0,
      translations: { vi: { name: "Sổ tay", plural: "Sổ tay" }, en: { name: "Notebook" } },
      image: "/catalogue/n.webp",
    },
    {
      code: "envelope",
      slug: "envelopes",
      name: "Bao thư",
      description: null,
      position: 1,
      translations: { vi: { name: "Bao thư" } },
      image: null,
    },
  ],
  productCategories: [
    {
      slug: "motivation",
      name: "Tạo động lực",
      description: "Mô tả",
      position: 0,
      translations: { vi: { name: "Tạo động lực", intro: "Mô tả" }, en: { name: "Motivation" } },
      image: "/catalogue/m.webp",
    },
    {
      slug: "ao-dai",
      name: "Áo dài",
      description: null,
      position: 1,
      translations: { vi: { name: "Áo dài" } },
      image: "/catalogue/a.webp",
    },
  ],
};

test("a first seed writes product types, category translations and product attributes", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
  const { seedContent } = await import("../dist/content/seed.js");
  assert.equal(await seedContent(f.pool, catalogueData), 2 + 1 + 2 + 2 + 2);
  const [types] = await f.pool.query(
    "SELECT code,slug,name,description,position,active,translations,image FROM product_types ORDER BY position",
  );
  assert.deepEqual(
    { ...types[0] },
    {
      code: "notebook",
      slug: "notebooks",
      name: "Sổ tay",
      description: "Giấy nhỏ",
      position: 0,
      active: 1,
      translations: { vi: { name: "Sổ tay", plural: "Sổ tay" }, en: { name: "Notebook" } },
      image: "/catalogue/n.webp",
    },
  );
  assert.equal(types[1].code, "envelope");
  const [[category]] = await f.pool.query(
    "SELECT translations,image FROM product_categories WHERE slug='motivation'",
  );
  assert.deepEqual(category.translations.en, { name: "Motivation" });
  assert.equal(category.image, "/catalogue/m.webp");
  const [[product]] = await f.pool.query("SELECT attributes FROM products");
  assert.deepEqual(product.attributes, {
    dimensions: "A5",
    pages: "100",
    material: { vi: "Giấy", en: "Paper" },
    format: { vi: "14x20cm", en: "14x20cm" },
    occasion: "womens-day-83",
  });
  assert.equal(await seedContent(f.pool, catalogueData), 0);
});

test("a database seeded before version 3 is filled once and admin edits are kept", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
  const { seedContent } = await import("../dist/content/seed.js");
  await seedContent(f.pool, catalogueData);
  // The state production is in right after migration 3: rows exist, new columns are NULL.
  await f.pool.query("DELETE FROM product_types");
  await f.pool.query("UPDATE product_categories SET translations=NULL, image=NULL");
  await f.pool.query("UPDATE products SET attributes=NULL");
  await f.pool.query(
    "UPDATE product_categories SET image='/uploaded-by-admin.webp' WHERE slug='ao-dai'",
  );
  await f.pool.query(
    "INSERT INTO products (id,product_code,name,slug,description,product_type,collection,image_ids,tags,material_en,created_at,updated_at) VALUES('p2','0002','Thiệp','thiep','','greeting-card','ao-dai','[]','[]','Card',NOW(3),NOW(3)),('p3','0003','Trống','trong','','greeting-card','ao-dai','[]','[]',NULL,NOW(3),NOW(3))",
  );

  // 2 product types + 1 category + 3 products.
  assert.equal(await seedContent(f.pool, catalogueData), 2 + 1 + 3);

  const [[{ n: types }]] = await f.pool.query("SELECT COUNT(*) n FROM product_types");
  assert.equal(types, 2);
  const [categories] = await f.pool.query(
    "SELECT slug,translations,image FROM product_categories ORDER BY slug",
  );
  assert.deepEqual(
    categories.map((c) => ({ ...c })),
    [
      { slug: "ao-dai", translations: null, image: "/uploaded-by-admin.webp" },
      {
        slug: "motivation",
        translations: { vi: { name: "Tạo động lực", intro: "Mô tả" }, en: { name: "Motivation" } },
        image: "/catalogue/m.webp",
      },
    ],
  );
  const [products] = await f.pool.query("SELECT slug,attributes FROM products ORDER BY slug");
  assert.deepEqual(
    products.map((p) => ({ ...p })),
    [
      {
        slug: "san-pham-a",
        attributes: {
          dimensions: "A5",
          pages: "100",
          material: { vi: "Giấy", en: "Paper" },
          format: { vi: "14x20cm", en: "14x20cm" },
          occasion: "womens-day-83",
        },
      },
      { slug: "thiep", attributes: { material: { vi: "", en: "Card" } } },
      { slug: "trong", attributes: {} },
    ],
  );

  assert.equal(await seedContent(f.pool, catalogueData), 0);
  // An admin who removed a seeded type keeps it removed as long as any type is left.
  await f.pool.query("DELETE FROM product_types WHERE code='envelope'");
  assert.equal(await seedContent(f.pool, catalogueData), 0);
});
