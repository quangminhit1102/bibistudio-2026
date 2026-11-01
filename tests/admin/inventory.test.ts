import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { adjustStock } from "../../src/features/admin/products/inventory-service";
it("adjusts inventory and history atomically and rejects stale/negative values", async () => {
  const s = createAdminStore("inventory-test");
  try {
    await ensureDataset(s, "products");
    const p = (await s.get("products", "product-1"))!;
    await adjustStock(
      s,
      { userId: "user-1", roleId: "super-admin" },
      { entity: "products", id: p.id, delta: 3, reason: "Kiểm kê", revision: 1 },
    );
    expect((await s.get("products", p.id))?.stock).toBe(p.stock + 3);
    expect((await s.list("stock")).length).toBe(1);
    await expect(
      adjustStock(
        s,
        { userId: "user-1", roleId: "super-admin" },
        { entity: "products", id: p.id, delta: -1000, reason: "Sai", revision: 2 },
      ),
    ).rejects.toMatchObject({ code: "validation" });
    expect((await s.list("stock")).length).toBe(1);
  } finally {
    await s.destroy();
  }
});
