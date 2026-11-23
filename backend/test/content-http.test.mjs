import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";

const directory = resolve("backend/content-migrations");

test("content admin API requires auth, serves authorized lists and 404s unknown ids", async (t) => {
  const f = await createAuthFixture(t);
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
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
  const grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const authHeaders = { Authorization: `Bearer ${grant.accessToken}` };
  const list = (path) =>
    fetch(base + "/api" + path, {
      method: "GET",
      headers: authHeaders,
    });
  const write = (path, method, body) =>
    fetch(base + "/api" + path, {
      method,
      headers: {
        ...authHeaders,
        Origin: f.config.allowedOrigins[0],
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
      },
      body: JSON.stringify(body),
    });

  for (const path of [
    "/customers",
    "/posts",
    "/products",
    "/product-categories",
    "/product-types",
    "/content-categories",
  ])
    assert.equal((await fetch(base + "/api" + path)).status, 401, `${path} unauthenticated`);

  // Lists must accept the frontend admin client's exact query shape
  // (page/size/q/sort=<field>/dir/<f_key> filters) without a 400.
  for (const path of [
    "/customers",
    "/posts",
    "/products",
    "/product-categories",
    "/product-types",
    "/content-categories",
  ]) {
    const response = await list(
      `${path}?page=1&size=10&q=test&sort=name&dir=asc&f_status=published`,
    );
    assert.equal(response.status, 200, path);
    const body = await response.json();
    assert.equal(body.total, 0, path);
    assert.deepEqual(body.items, [], path);
  }

  assert.equal((await list("/customers/00000000-0000-4000-8000-000000000000")).status, 404);

  // Product types and collections first: a product may only name existing ones.
  const type = await write("/product-types", "POST", {
    code: "book",
    name: "Sách",
    slug: "books",
    translations: { vi: { name: "Sách", plural: "Sách" }, en: { name: "Book" } },
    image: "/catalogue/book.webp",
  });
  assert.equal(type.status, 201);
  const typeBody = await type.json();
  assert.equal(typeBody.code, "book");
  assert.deepEqual(typeBody.translations.en, { name: "Book" });
  assert.equal(
    (await write("/product-types", "POST", { code: "Book 2", name: "X", slug: "x" })).status,
    400,
    "a code is a lowercase slug",
  );
  assert.equal(
    (
      await write(`/product-types/${typeBody.id}`, "PUT", {
        revision: typeBody.revision,
        code: "novel",
      })
    ).status,
    400,
    "a code cannot be changed",
  );
  const typeUpdate = await write(`/product-types/${typeBody.id}`, "PUT", {
    revision: typeBody.revision,
    slug: "sach",
    position: 2,
  });
  assert.equal(typeUpdate.status, 200);
  assert.equal((await typeUpdate.json()).slug, "sach");
  assert.equal(
    (await write("/product-types", "POST", { code: "notebook", name: "Sổ", slug: "notebooks" }))
      .status,
    201,
  );
  for (const [slug, name] of [
    ["featured", "Nổi bật"],
    ["motivation", "Động lực"],
  ]) {
    const category = await write("/product-categories", "POST", {
      name,
      slug,
      translations: { en: { name: slug, intro: "Intro" } },
      image: `/catalogue/${slug}.webp`,
    });
    assert.equal(category.status, 201);
    assert.equal((await category.json()).image, `/catalogue/${slug}.webp`);
  }
  assert.equal(
    (
      await write("/content-categories", "POST", {
        name: "Tin",
        slug: "tin",
        image: "/x.webp",
      })
    ).status,
    400,
    "content categories have no image",
  );
  assert.equal(
    (await write("/product-categories", "POST", { name: "Dài", slug: "a".repeat(51) })).status,
    400,
    "a collection slug must fit the column a product stores it in",
  );
  assert.equal(
    (await write("/content-categories", "POST", { name: "Dài", slug: "a".repeat(51) })).status,
    201,
  );
  const unknownType = await write("/products", "POST", {
    productCode: "1000",
    name: "Sản phẩm",
    slug: "san-pham-0",
    description: "<p>Mô tả</p>",
    productType: "books",
    collection: "featured",
  });
  assert.equal(unknownType.status, 400);
  assert.deepEqual((await unknownType.json()).error.details, [
    { field: "productType", message: "Giá trị không tồn tại" },
  ]);

  // A non-digit productCode must be rejected with 400 (spec §2).
  const badProduct = await write("/products", "POST", {
    productCode: "abc-1",
    name: "Sản phẩm",
    slug: "san-pham",
    description: "<p>Mô tả</p>",
    productType: "book",
    collection: "featured",
  });
  assert.equal(badProduct.status, 400, "non-digit productCode is rejected");

  // A valid product with status=published is returned by the f_status filter.
  const created = await write("/products", "POST", {
    productCode: "1001",
    name: "Sản phẩm",
    slug: "san-pham",
    description: "<p>Mô tả</p>",
    productType: "book",
    collection: "featured",
    status: "published",
  });
  assert.equal(created.status, 201, "valid product is created");

  const published = await (await list("/products?page=1&size=10&f_status=published")).json();
  assert.equal(published.total, 1);
  assert.equal(published.items[0].productCode, "1001");

  const drafts = await (await list("/products?page=1&size=10&f_status=draft")).json();
  assert.equal(drafts.total, 0);

  const searched = await (
    await list(`/products?page=1&size=10&q=${encodeURIComponent("phẩm")}`)
  ).json();
  assert.equal(searched.total, 1);
  assert.equal(searched.items[0].productCode, "1001");

  // New v9 fields round-trip through the Zod schemas and are echoed back.
  const productV9 = await write("/products", "POST", {
    productCode: "1002",
    name: "Sản phẩm song ngữ",
    slug: "san-pham-song-ngu",
    description: "<p>Mô tả</p>",
    productType: "notebook",
    collection: "motivation",
    nameEn: "Bilingual product",
    descriptionEn: "English description",
    dimensions: "15 x 21 cm",
    materialVi: "Giấy mỹ thuật",
    materialEn: "Fine paper",
    formatVi: "Bìa cứng",
    formatEn: "Hardcover",
    occasion: "tet",
    featured: true,
    sortOrder: 7,
    imageAltVi: "Ảnh song ngữ",
    imageAltEn: "Bilingual image",
  });
  assert.equal(productV9.status, 201, "product with v9 fields is created");
  const productV9Body = await productV9.json();
  assert.equal(productV9Body.nameEn, "Bilingual product");
  assert.equal(productV9Body.descriptionEn, "English description");
  assert.equal(productV9Body.materialEn, "Fine paper");
  assert.equal(productV9Body.featured, true);
  assert.equal(productV9Body.sortOrder, 7);
  assert.deepEqual(productV9Body.attributes, {
    dimensions: "15 x 21 cm",
    material: { vi: "Giấy mỹ thuật", en: "Fine paper" },
    format: { vi: "Bìa cứng", en: "Hardcover" },
    occasion: "tet",
  });
  const withAttributes = await write(`/products/${productV9Body.id}`, "PUT", {
    revision: productV9Body.revision,
    attributes: { pages: "120", binding: "Khâu chỉ" },
  });
  assert.equal(withAttributes.status, 200);
  const withAttributesBody = await withAttributes.json();
  assert.deepEqual(withAttributesBody.attributes, { pages: "120", binding: "Khâu chỉ" });
  assert.equal(withAttributesBody.pages, "120");
  assert.equal(withAttributesBody.occasion, null);
  assert.equal(
    (
      await write(`/products/${productV9Body.id}`, "PUT", {
        revision: withAttributesBody.revision,
        attributes: { pages: 120 },
      })
    ).status,
    400,
    "an attribute is text or a vi/en pair",
  );

  const postV9 = await write("/posts", "POST", {
    slug: "bai-v9",
    title: "Bài v9",
    content: "<p>Nội dung</p>",
    readTime: "5 phút đọc",
    coverImageId: "journal-cover-v9",
  });
  assert.equal(postV9.status, 201, "post with v9 fields is created");
  const postV9Body = await postV9.json();
  assert.equal(postV9Body.readTime, "5 phút đọc");
  assert.equal(postV9Body.coverImageId, "journal-cover-v9");
});
