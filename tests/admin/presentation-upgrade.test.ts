import { it, expect, vi } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { upgradePresentation } from "../../src/features/admin/demo/presentation-upgrade";
import { getAllProducts } from "../../src/data/catalogue";
import { getAllBlogPosts } from "../../src/data/blog";
import { seed as seedBusiness } from "../../src/features/admin/sales/business-seed";
it("fresh seed uses the actual catalogue and journal with local imagery and valid references", async () => {
  const s = createAdminStore("presentation-fresh");
  try {
    await ensureDataset(s, "products");
    await ensureDataset(s, "posts");
    const products = await s.list("products"),
      posts = await s.list("posts");
    expect(products).toHaveLength(getAllProducts().length);
    expect(posts).toHaveLength(getAllBlogPosts().length);
    expect(products.every((p) => !p.slug.includes("demo"))).toBe(true);
    for (const p of products)
      expect(p.imageIds).toHaveLength(
        getAllProducts().find((original) => original.slug === p.slug)!.images.length,
      );
    for (const p of products)
      for (const id of p.imageIds) expect((await s.get("media", id))?.url).toBeTruthy();
    expect(posts.every((p) => p.imageId && !p.slug.includes("demo"))).toBe(true);
    const custom = { ...products[0], id: "my-product-uuid", sku: "CUSTOM" };
    expect(seedBusiness({ products: [custom] }).purchaseSlips).toHaveLength(0);
  } finally {
    await s.destroy();
  }
});
it("upgrades only unchanged seed fields, retry is idempotent and preserves business history, custom roles and blobs", async () => {
  const s = createAdminStore("presentation-old");
  try {
    await ensureDataset(s, "customers");
    await ensureDataset(s, "users");
    await s.transaction(["products", "roles"], async (tx) => {
      const p = (await tx.get("products", "product-1"))!;
      await tx.put("products", {
        ...p,
        name: "Tên tôi đã sửa",
        slug: "bibi-demo-1",
        stock: 777,
        revision: 6,
      });
      await tx.put("roles", {
        id: "custom-role",
        name: "Vai trò riêng",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        revision: 1,
        permissions: { products: ["view"] },
      });
    });
    await s.putBlob("untouched", new Blob(["image"]));
    const slips = await s.list("purchaseSlips"),
      audit = await s.list("audit");
    await s.setMeta("presentation:products:v1", false);
    const set = vi.spyOn(s, "setMeta").mockRejectedValueOnce(new Error("quota"));
    await expect(upgradePresentation(s, "products")).rejects.toThrow("quota");
    set.mockRestore();
    await upgradePresentation(s, "products");
    const after = await s.get("products", "product-1");
    expect(after).toMatchObject({
      id: "product-1",
      name: "Tên tôi đã sửa",
      slug: "da-nang-map-notebook",
      stock: 777,
    });
    await upgradePresentation(s, "products");
    expect(await s.get("products", "product-1")).toEqual(after);
    expect(await s.list("purchaseSlips")).toEqual(slips);
    expect(await s.list("audit")).toEqual(audit);
    expect(await s.get("roles", "custom-role")).toMatchObject({ name: "Vai trò riêng" });
    expect(await (await s.getBlob("untouched"))!.text()).toBe("image");
  } finally {
    await s.destroy();
  }
});
