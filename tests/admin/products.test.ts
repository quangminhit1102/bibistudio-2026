import { getAllProducts } from "../../src/data/catalogue";
import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { createEntityService } from "../../src/features/admin/services/entity-service";
it("product CRUD validates stock, unique SKU, relationships and public isolation", async () => {
  const store = createAdminStore("product-workflow");
  try {
    await ensureDataset(store, "products");
    const service = createEntityService(store, "products", () => ({
      userId: "user-1",
      roleId: "super-admin",
    }));
    const original = await service.get("product-1");
    await expect(service.update(original.id, { stock: -1 }, 1)).rejects.toMatchObject({
      code: "validation",
    });
    const { id, createdAt, updatedAt, revision, ...input } = original;
    const added = await service.create({
      ...input,
      name: "Sổ kiểm thử",
      sku: "TEST-SKU",
      slug: "test-slug",
    });
    expect(added.id).not.toBe(original.id);
    await expect(
      service.create({ ...input, sku: "TEST-SKU", slug: "another" }),
    ).rejects.toMatchObject({ code: "validation" });
    const updated = await service.update(added.id, { name: "Đã cập nhật" }, added.revision);
    expect(updated.revision).toBe(2);
    await service.remove(updated.id, updated.revision);
    expect((await service.list({ page: 1, pageSize: 100 })).total).toBe(getAllProducts().length);
  } finally {
    await store.destroy();
  }
});
it("rejects descendant category cycles", async () => {
  const store = createAdminStore("category-cycles");
  try {
    await ensureDataset(store, "categories");
    const service = createEntityService(store, "categories", () => ({
      userId: "user-1",
      roleId: "super-admin",
    }));
    const root = await service.get("cat-notebook");
    const child = await service.create({
      name: "Con",
      slug: "child",
      parentId: root.id,
      kind: "product",
      active: true,
      position: 0,
    });
    await expect(
      service.update(root.id, { parentId: child.id }, root.revision),
    ).rejects.toMatchObject({ code: "validation" });
  } finally {
    await store.destroy();
  }
});
