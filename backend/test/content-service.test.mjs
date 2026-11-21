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

  const cat = await service.createContentCategory(
    { name: "Tin tức", slug: "tin-tuc" },
    actor,
  );
  assert.equal(cat.revision, 1);
  const pcat = await service.createProductCategory({ name: "Sách", slug: "sach" }, actor);
  assert.equal(pcat.revision, 1);

  const post = await service.createPost(
    {
      slug: "bai-1",
      title: "Bài viết 1",
      excerpt: "Tóm tắt",
      content: "<p>Nội dung</p>",
      status: "published",
      categoryId: cat.id,
    },
    actor,
  );
  assert.equal(post.authorId, actor.principal.id);
  assert.equal(post.status, "published");
  assert.equal(post.content, "<p>Nội dung</p>");
  assert.equal(post.revision, 1);

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
    },
    actor,
  );
  assert.deepEqual(product.imageIds, ["img-1", "img-2"]);
  assert.deepEqual(product.tags, ["mới", "hot"]);
  assert.equal(product.price, 100000);
  assert.equal(product.productCode, "1001");

  const gotProduct = await service.getProduct(product.id, actor);
  assert.deepEqual(gotProduct.imageIds, ["img-1", "img-2"]);
  assert.deepEqual(gotProduct.tags, ["mới", "hot"]);

  const updatedProduct = await service.updateProduct(
    product.id,
    { tags: ["cũ", "mới"], price: 120000 },
    product.revision,
    actor,
  );
  assert.deepEqual(updatedProduct.tags, ["cũ", "mới"]);
  assert.equal(updatedProduct.price, 120000);
  assert.equal(updatedProduct.revision, 2);

  await assert.rejects(service.deleteContentCategory(cat.id, cat.revision, actor), {
    status: 409,
    code: "REFERENCED",
  });
  await assert.rejects(service.deleteProductCategory(pcat.id, pcat.revision, actor), {
    status: 409,
    code: "REFERENCED",
  });

  await service.deletePost(post.id, post.revision, actor);
  await service.deleteContentCategory(cat.id, cat.revision, actor);

  await service.deleteProduct(product.id, updatedProduct.revision, actor);
  await service.deleteProductCategory(pcat.id, pcat.revision, actor);

  assert.equal((await service.listPosts({}, actor)).total, 0);
  assert.equal((await service.listProducts({}, actor)).total, 0);
  assert.equal((await service.listContentCategories({}, actor)).total, 0);
  assert.equal((await service.listProductCategories({}, actor)).total, 0);
});
