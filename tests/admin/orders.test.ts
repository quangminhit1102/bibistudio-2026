import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { transitionOrder, transitionPayment } from "../../src/features/admin/sales/service";
const actor = { userId: "user-1", roleId: "super-admin" };
it("order transitions reserve/consume stock once and reject invalid/stale changes", async () => {
  const s = createAdminStore("orders-test");
  try {
    await ensureDataset(s, "orders");
    const original = (await s.get("products", "product-1"))!;
    await expect(transitionOrder(s, actor, "order-1", "Delivered", 1)).rejects.toMatchObject({
      code: "validation",
    });
    await transitionOrder(s, actor, "order-1", "Confirmed", 1);
    await transitionOrder(s, actor, "order-1", "Processing", 2);
    expect((await s.get("products", original.id))?.reserved).toBe(1);
    await transitionOrder(s, actor, "order-1", "Shipped", 3);
    expect((await s.get("products", original.id))?.stock).toBe(original.stock - 1);
    expect((await s.get("products", original.id))?.reserved).toBe(0);
    await expect(transitionOrder(s, actor, "order-1", "Shipped", 3)).rejects.toMatchObject({
      code: "conflict",
    });
    await transitionOrder(s, actor, "order-1", "Delivered", 4);
    await transitionPayment(s, actor, "order-1", "Paid", 5);
    await transitionOrder(s, actor, "order-1", "Refunded", 6);
    expect((await s.get("orders", "order-1"))?.paymentStatus).toBe("Refunded");
    expect((await s.get("products", original.id))?.stock).toBe(original.stock - 1);
  } finally {
    await s.destroy();
  }
});
it("cancelling processing releases reservation without changing stock", async () => {
  const s = createAdminStore("cancel-test");
  try {
    await ensureDataset(s, "orders");
    const p = (await s.get("products", "product-1"))!;
    await transitionOrder(s, actor, "order-1", "Confirmed", 1);
    await transitionOrder(s, actor, "order-1", "Processing", 2);
    await transitionOrder(s, actor, "order-1", "Cancelled", 3);
    expect((await s.get("products", p.id))?.stock).toBe(p.stock);
    expect((await s.get("products", p.id))?.reserved).toBe(0);
  } finally {
    await s.destroy();
  }
});
