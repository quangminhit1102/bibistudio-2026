import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createAuthFixture } from "./helpers/auth.mjs";

const directory = resolve("backend/content-migrations");

async function setup(t) {
  const f = await createAuthFixture(t);
  const { migrateContent } = await import("../dist/content/schema.js");
  await migrateContent(f.pool, directory);
  const { createContentService } = await import("../dist/content/service.js");
  const service = createContentService(f.pool, f.clock);
  const grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  const actor = await f.auth.authenticate(grant.accessToken);
  const userGrant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  const userActor = await f.auth.authenticate(userGrant.accessToken);
  return { ...f, service, actor, userActor };
}

test("content service CRUDs customers with revision concurrency and permission checks", async (t) => {
  const { service, actor, userActor } = await setup(t);

  await assert.rejects(service.listCustomers({}, userActor), { status: 403 });
  await assert.rejects(
    service.createCustomer({ name: "X", kind: "bookstore", vatRate: 8 }, userActor),
    { status: 403 },
  );

  const created = await service.createCustomer(
    { name: "Nhà sách A", kind: "bookstore", vatRate: 8 },
    actor,
  );
  assert.equal(created.name, "Nhà sách A");
  assert.equal(created.kind, "bookstore");
  assert.equal(created.vatRate, 8);
  assert.equal(created.active, true);
  assert.equal(created.revision, 1);

  const { items, total, page, pageSize } = await service.listCustomers({}, actor);
  assert.equal(total, 1);
  assert.equal(page, 1);
  assert.equal(pageSize, 20);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Nhà sách A");

  const got = await service.getCustomer(created.id, actor);
  assert.equal(got.name, "Nhà sách A");
  assert.equal(got.revision, 1);

  const updated = await service.updateCustomer(
    created.id,
    { name: "Nhà sách B", vatRate: 10 },
    created.revision,
    actor,
  );
  assert.equal(updated.name, "Nhà sách B");
  assert.equal(updated.vatRate, 10);
  assert.equal(updated.revision, 2);

  await assert.rejects(service.updateCustomer(created.id, { name: "Z" }, 1, actor), {
    status: 409,
    code: "CONFLICT",
  });
  await assert.rejects(service.deleteCustomer(created.id, 1, actor), {
    status: 409,
    code: "CONFLICT",
  });

  const { items: found } = await service.listCustomers({ search: "sách B" }, actor);
  assert.equal(found.length, 1);

  const deleted = await service.deleteCustomer(created.id, updated.revision, actor);
  assert.equal(deleted.id, created.id);
  await assert.rejects(service.getCustomer(created.id, actor), { status: 404 });
  assert.equal((await service.listCustomers({}, actor)).total, 0);
});

test("content service CRUDs posts/products/categories with JSON columns and FK delete protection", async (t) => {
  const { service, actor } = await setup(t);

  const cat = await service.createContentCategory({ name: "Tin tức", slug: "tin-tuc" }, actor);
  assert.equal(cat.revision, 1);
  const pcat = await service.createProductCategory({ name: "Sách", slug: "sach" }, actor);
  assert.equal(pcat.revision, 1);
  const collection = await service.createProductCategory(
    { name: "Nổi bật", slug: "featured" },
    actor,
  );
  await service.createProductType({ code: "book", name: "Sách", slug: "books" }, actor);

  const post = await service.createPost(
    {
      slug: "bai-1",
      title: "Bài viết 1",
      excerpt: "Tóm tắt",
      content: "<p>Nội dung</p>",
      status: "published",
      categoryId: cat.id,
      readTime: "5 phút đọc",
      coverImageId: "journal-cover-bai-1",
    },
    actor,
  );
  assert.equal(post.authorId, actor.principal.id);
  assert.equal(post.status, "published");
  assert.equal(post.content, "<p>Nội dung</p>");
  assert.equal(post.readTime, "5 phút đọc");
  assert.equal(post.coverImageId, "journal-cover-bai-1");
  assert.equal(post.revision, 1);

  const gotPost = await service.getPost(post.id, actor);
  assert.equal(gotPost.readTime, "5 phút đọc");
  assert.equal(gotPost.coverImageId, "journal-cover-bai-1");

  const updatedPost = await service.updatePost(
    post.id,
    { readTime: "7 phút đọc", coverImageId: "journal-cover-bai-1b" },
    post.revision,
    actor,
  );
  assert.equal(updatedPost.readTime, "7 phút đọc");
  assert.equal(updatedPost.coverImageId, "journal-cover-bai-1b");

  const published = await service.listPosts({ filters: { status: "published" } }, actor);
  assert.equal(published.total, 1);
  assert.equal(published.items[0].title, "Bài viết 1");

  const product = await service.createProduct(
    {
      productCode: "1001",
      name: "Sản phẩm A",
      slug: "san-pham-a",
      description: "<p>Mô tả</p>",
      productType: "book",
      collection: "featured",
      categoryId: pcat.id,
      imageIds: ["img-1", "img-2"],
      tags: ["mới", "hot"],
      price: 100000,
      nameEn: "Product A",
      shortDescriptionEn: "Short EN",
      descriptionEn: "Desc EN",
      dimensions: "15 x 21 cm",
      pages: "200",
      materialVi: "Giấy mỹ thuật",
      materialEn: "Fine paper",
      formatVi: "Bìa cứng",
      formatEn: "Hardcover",
      occasion: "tet",
      featured: true,
      sortOrder: 5,
      imageAltVi: "Ảnh sản phẩm A",
      imageAltEn: "Product A image",
    },
    actor,
  );
  assert.deepEqual(product.imageIds, ["img-1", "img-2"]);
  assert.deepEqual(product.tags, ["mới", "hot"]);
  assert.equal(product.price, 100000);
  assert.equal(product.productCode, "1001");
  assert.equal(product.nameEn, "Product A");
  assert.equal(product.shortDescriptionEn, "Short EN");
  assert.equal(product.descriptionEn, "Desc EN");
  assert.equal(product.dimensions, "15 x 21 cm");
  assert.equal(product.pages, "200");
  assert.equal(product.materialVi, "Giấy mỹ thuật");
  assert.equal(product.materialEn, "Fine paper");
  assert.equal(product.formatVi, "Bìa cứng");
  assert.equal(product.formatEn, "Hardcover");
  assert.equal(product.occasion, "tet");
  assert.equal(product.featured, true);
  assert.equal(product.sortOrder, 5);
  assert.equal(product.imageAltVi, "Ảnh sản phẩm A");
  assert.equal(product.imageAltEn, "Product A image");

  const gotProduct = await service.getProduct(product.id, actor);
  assert.deepEqual(gotProduct.imageIds, ["img-1", "img-2"]);
  assert.deepEqual(gotProduct.tags, ["mới", "hot"]);
  assert.equal(gotProduct.nameEn, "Product A");
  assert.equal(gotProduct.descriptionEn, "Desc EN");
  assert.equal(gotProduct.materialVi, "Giấy mỹ thuật");
  assert.equal(gotProduct.formatEn, "Hardcover");
  assert.equal(gotProduct.occasion, "tet");
  assert.equal(gotProduct.featured, true);
  assert.equal(gotProduct.sortOrder, 5);
  assert.equal(gotProduct.imageAltEn, "Product A image");

  const updatedProduct = await service.updateProduct(
    product.id,
    {
      tags: ["cũ", "mới"],
      price: 120000,
      featured: false,
      sortOrder: 9,
      nameEn: "Product A2",
    },
    product.revision,
    actor,
  );
  assert.deepEqual(updatedProduct.tags, ["cũ", "mới"]);
  assert.equal(updatedProduct.price, 120000);
  assert.equal(updatedProduct.featured, false);
  assert.equal(updatedProduct.sortOrder, 9);
  assert.equal(updatedProduct.nameEn, "Product A2");
  assert.equal(updatedProduct.revision, 2);

  await assert.rejects(service.deleteContentCategory(cat.id, cat.revision, actor), {
    status: 409,
    code: "REFERENCED",
  });
  await assert.rejects(service.deleteProductCategory(pcat.id, pcat.revision, actor), {
    status: 409,
    code: "REFERENCED",
  });

  await service.deletePost(post.id, updatedPost.revision, actor);
  await service.deleteContentCategory(cat.id, cat.revision, actor);

  // A collection is also held by the products that name it in `collection`.
  await assert.rejects(service.deleteProductCategory(collection.id, collection.revision, actor), {
    status: 409,
    code: "REFERENCED",
  });
  await service.deleteProduct(product.id, updatedProduct.revision, actor);
  await service.deleteProductCategory(pcat.id, pcat.revision, actor);
  await service.deleteProductCategory(collection.id, collection.revision, actor);

  assert.equal((await service.listPosts({}, actor)).total, 0);
  assert.equal((await service.listProducts({}, actor)).total, 0);
  assert.equal((await service.listContentCategories({}, actor)).total, 0);
  assert.equal((await service.listProductCategories({}, actor)).total, 0);
});

test("product types are managed with the product permissions and protected while in use", async (t) => {
  const { service, actor, userActor } = await setup(t);
  await assert.rejects(service.listProductTypes({}, userActor), { status: 403 });
  await assert.rejects(
    service.createProductType({ code: "magnet", name: "Magnet", slug: "magnets" }, userActor),
    { status: 403 },
  );

  const type = await service.createProductType(
    {
      code: "magnet",
      name: "Magnet",
      slug: "magnets",
      description: "Trên cửa tủ lạnh",
      position: 3,
      translations: { vi: { name: "Magnet", plural: "Magnet" }, en: { name: "Magnet" } },
      image: "/catalogue/magnet.webp",
    },
    actor,
  );
  assert.deepEqual(
    { ...type, id: "", createdAt: "", updatedAt: "" },
    {
      id: "",
      code: "magnet",
      name: "Magnet",
      slug: "magnets",
      description: "Trên cửa tủ lạnh",
      position: 3,
      active: true,
      translations: { vi: { name: "Magnet", plural: "Magnet" }, en: { name: "Magnet" } },
      image: "/catalogue/magnet.webp",
      createdAt: "",
      updatedAt: "",
      revision: 1,
    },
  );
  assert.deepEqual(await service.getProductType(type.id, actor), type);
  const found = await service.listProductTypes({ search: "magnet" }, actor);
  assert.equal(found.total, 1);

  const renamed = await service.updateProductType(
    type.id,
    { name: "Nam châm", image: null, code: "ignored" },
    type.revision,
    actor,
  );
  assert.equal(renamed.name, "Nam châm");
  assert.equal(renamed.image, null);
  assert.equal(renamed.code, "magnet", "the stored code never changes");
  await assert.rejects(service.updateProductType(type.id, { name: "X" }, 1, actor), {
    status: 409,
  });

  const category = await service.createProductCategory(
    {
      name: "Khám phá",
      slug: "explore",
      translations: { en: { name: "Explore", intro: "Places" } },
      image: "/catalogue/explore.webp",
    },
    actor,
  );
  assert.deepEqual(category.translations, { en: { name: "Explore", intro: "Places" } });
  assert.equal(category.image, "/catalogue/explore.webp");

  const product = await service.createProduct(
    {
      productCode: "M1",
      name: "Cầu Rồng",
      slug: "cau-rong",
      description: "",
      productType: "magnet",
      collection: "explore",
    },
    actor,
  );
  await assert.rejects(service.deleteProductType(type.id, renamed.revision, actor), {
    status: 409,
  });
  await service.deleteProduct(product.id, product.revision, actor);
  assert.deepEqual(await service.deleteProductType(type.id, renamed.revision, actor), {
    id: type.id,
  });
});

test("a product must use an existing product type and collection", async (t) => {
  const { service, actor, pool } = await setup(t);
  await service.createProductType({ code: "magnet", name: "Magnet", slug: "magnets" }, actor);
  await service.createProductCategory({ name: "Khám phá", slug: "explore" }, actor);
  const base = { productCode: "M1", name: "A", slug: "a", description: "" };
  // The URL slug of a type is not its code.
  for (const [productType, collection, field] of [
    ["magnets", "explore", "productType"],
    ["magnet", "nowhere", "collection"],
  ])
    await assert.rejects(service.createProduct({ ...base, productType, collection }, actor), {
      status: 400,
      code: "INVALID_INPUT",
      details: [{ field, message: "Giá trị không tồn tại" }],
    });
  const product = await service.createProduct(
    { ...base, productType: "magnet", collection: "explore" },
    actor,
  );
  await assert.rejects(
    service.updateProduct(product.id, { productType: "gone" }, product.revision, actor),
    { status: 400, code: "INVALID_INPUT" },
  );
  await assert.rejects(
    service.updateProduct(product.id, { collection: "gone" }, product.revision, actor),
    { status: 400, code: "INVALID_INPUT" },
  );
  // A product whose type was removed behind its back can still be edited in other fields.
  await pool.query("UPDATE products SET product_type='gone' WHERE id=?", [product.id]);
  const edited = await service.updateProduct(product.id, { name: "B" }, product.revision, actor);
  assert.equal(edited.name, "B");
});

test("legacy attribute fields and attributes are written together", async (t) => {
  const { service, actor, pool } = await setup(t);
  await service.createProductType({ code: "card", name: "Thiệp", slug: "cards" }, actor);
  await service.createProductCategory({ name: "Thiệp", slug: "cards" }, actor);
  const base = {
    productCode: "C1",
    slug: "c1",
    description: "",
    productType: "card",
    collection: "cards",
  };
  const legacy = await service.createProduct(
    { ...base, name: "A", dimensions: "A6", materialVi: "Giấy", occasion: "tet" },
    actor,
  );
  assert.deepEqual(legacy.attributes, {
    dimensions: "A6",
    material: { vi: "Giấy", en: "" },
    occasion: "tet",
  });

  const modern = await service.createProduct(
    {
      ...base,
      productCode: "C2",
      slug: "c2",
      name: "B",
      attributes: { pages: "12", format: { vi: "Gấp đôi", en: "Folded" }, weight: "20g" },
    },
    actor,
  );
  assert.equal(modern.pages, "12");
  assert.equal(modern.formatVi, "Gấp đôi");
  assert.equal(modern.formatEn, "Folded");
  assert.equal(modern.occasion, null);
  assert.deepEqual(modern.attributes, {
    pages: "12",
    format: { vi: "Gấp đôi", en: "Folded" },
    weight: "20g",
  });

  // A legacy field in an update changes only its own key; other attributes stay.
  const cleared = await service.updateProduct(
    modern.id,
    { pages: null, occasion: "birthday" },
    modern.revision,
    actor,
  );
  assert.deepEqual(cleared.attributes, {
    format: { vi: "Gấp đôi", en: "Folded" },
    weight: "20g",
    occasion: "birthday",
  });
  assert.equal(cleared.pages, null);

  // `attributes` in an update replaces the whole set, legacy columns included.
  const replaced = await service.updateProduct(
    modern.id,
    { attributes: { dimensions: "10 x 15 cm" } },
    cleared.revision,
    actor,
  );
  assert.deepEqual(replaced.attributes, { dimensions: "10 x 15 cm" });
  assert.equal(replaced.dimensions, "10 x 15 cm");
  assert.equal(replaced.formatVi, null);
  assert.equal(replaced.occasion, null);

  // An older release only writes the columns; they decide what is read.
  await pool.query("UPDATE products SET occasion='tet', dimensions=NULL WHERE id=?", [modern.id]);
  const afterOldRelease = await service.getProduct(modern.id, actor);
  assert.deepEqual(afterOldRelease.attributes, { occasion: "tet" });
  const [[stored]] = await pool.query(
    "SELECT attributes, dimensions, occasion FROM products WHERE id=?",
    [legacy.id],
  );
  assert.deepEqual(stored.attributes, {
    dimensions: "A6",
    material: { vi: "Giấy", en: "" },
    occasion: "tet",
  });
});

test("products follow a collection whose slug changes", async (t) => {
  const { service, actor } = await setup(t);
  await service.createProductType({ code: "card", name: "Thiệp", slug: "cards" }, actor);
  const collection = await service.createProductCategory({ name: "Tết", slug: "tet" }, actor);
  const product = await service.createProduct(
    {
      productCode: "1",
      name: "A",
      slug: "a",
      description: "",
      productType: "card",
      collection: "tet",
    },
    actor,
  );
  await service.updateProductCategory(
    collection.id,
    { slug: "lunar-new-year" },
    collection.revision,
    actor,
  );
  const moved = await service.getProduct(product.id, actor);
  assert.equal(moved.collection, "lunar-new-year");
  assert.equal(moved.revision, product.revision + 1);
});

test("a product type and a product cannot share a page slug", async (t) => {
  const { service, actor } = await setup(t);
  const type = await service.createProductType(
    { code: "magnet", name: "Magnet", slug: "magnets" },
    actor,
  );
  await service.createProductCategory({ name: "Khám phá", slug: "explore" }, actor);
  const base = { productCode: "M1", name: "A", description: "", productType: "magnet" };
  const taken = {
    status: 400,
    code: "INVALID_INPUT",
    details: [{ field: "slug", message: "Đường dẫn đã được dùng" }],
  };
  await assert.rejects(
    service.createProduct({ ...base, slug: "magnets", collection: "explore" }, actor),
    taken,
  );
  const product = await service.createProduct(
    { ...base, slug: "da-lat-magnet", collection: "explore" },
    actor,
  );
  await assert.rejects(
    service.updateProduct(product.id, { slug: "magnets" }, product.revision, actor),
    taken,
  );
  await assert.rejects(
    service.createProductType({ code: "other", name: "Khác", slug: "da-lat-magnet" }, actor),
    taken,
  );
  await assert.rejects(
    service.updateProductType(type.id, { slug: "da-lat-magnet" }, type.revision, actor),
    taken,
  );
  // A collection's page lives under /collections, so it may share the slug.
  await service.createProductCategory({ name: "Magnet", slug: "magnets" }, actor);
});

test("a plain text for a per-language attribute is kept as its Vietnamese text", async (t) => {
  const { service, actor } = await setup(t);
  await service.createProductType({ code: "card", name: "Thiệp", slug: "cards" }, actor);
  await service.createProductCategory({ name: "Thiệp", slug: "cards" }, actor);
  const product = await service.createProduct(
    {
      productCode: "C1",
      name: "A",
      slug: "c1",
      description: "",
      productType: "card",
      collection: "cards",
      materialVi: "Giấy",
      materialEn: "Paper",
    },
    actor,
  );
  const edited = await service.updateProduct(
    product.id,
    { attributes: { material: "Giấy kraft", dimensions: { vi: "A6", en: "A6" } } },
    product.revision,
    actor,
  );
  assert.deepEqual(edited.attributes, {
    dimensions: "A6",
    material: { vi: "Giấy kraft", en: "" },
  });
  assert.equal(edited.materialVi, "Giấy kraft");
});
