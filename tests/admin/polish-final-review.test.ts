import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { upgradePresentation } from "../../src/features/admin/demo/presentation-upgrade";
import { legacyPresentationBaseline } from "../../src/features/admin/demo/legacy-presentation";
import { seed as salesSeed } from "../../src/features/admin/sales/seed";
import { seed as productSeed } from "../../src/features/admin/products/seed";
import { seed as accountSeed } from "../../src/features/admin/accounts/seed";
it("legacy sales never generates history for custom products or missing references", () => {
  const p = productSeed().products![0];
  const custom = { ...p, id: "my-custom-product" };
  expect(salesSeed({ products: [custom] }).orders).toHaveLength(0);
  expect(salesSeed({ products: [] }).payments).toHaveLength(0);
  const orders = salesSeed({ products: [custom, p] }).orders!;
  expect(orders).toHaveLength(100);
  expect(orders.every((o) => o.items.every((i) => i.id === p.id))).toBe(true);
});
it("concurrent callers each await their own presentation migration in either order", async () => {
  for (const reverse of [false, true]) {
    const s = createAdminStore("polish-race-" + reverse);
    try {
      await ensureDataset(s, "visitors");
      await s.transaction(["visitors"], async (tx) => {
        const v = (await tx.get("visitors", "visitor-1"))!;
        await tx.put("visitors", { ...v, ...legacyPresentationBaseline("visitors", v.id) });
      });
      await s.setMeta("presentation:analytics:v1", false);
      const calls = reverse
        ? (["visitors", "sessions"] as const)
        : (["sessions", "visitors"] as const);
      await Promise.all(calls.map((e) => ensureDataset(s, e)));
      expect((await s.get("visitors", "visitor-1"))?.anonymousId).toBe("VIS-001");
      expect(await s.getMeta("presentation:analytics:v1")).toBe(true);
    } finally {
      await s.destroy();
    }
  }
});
it("migration preserves a unique field occupied by another current record", async () => {
  const s = createAdminStore("polish-collision");
  try {
    await ensureDataset(s, "products");
    await ensureDataset(s, "users");
    const p = productSeed().products!.find((p) => p.id === "product-1")!;
    const u = accountSeed().users!.find((u) => u.id === "user-1")!;
    await s.transaction(["products", "users"], async (tx) => {
      await tx.put("products", { ...p, ...legacyPresentationBaseline("products", p.id) });
      await tx.put("products", { ...p, id: "custom-product", sku: "CUSTOM" });
      await tx.put("users", { ...u, ...legacyPresentationBaseline("users", u.id) });
      await tx.put("users", { ...u, id: "custom-user" });
    });
    await s.setMeta("presentation:products:v1", false);
    await s.setMeta("presentation:accounts:v1", false);
    await upgradePresentation(s, "products");
    await upgradePresentation(s, "users");
    expect((await s.get("products", p.id))?.slug).toBe(
      legacyPresentationBaseline("products", p.id)?.slug,
    );
    expect((await s.get("products", p.id))?.name).toBe(p.name);
    expect((await s.list("products")).filter((x) => x.slug === p.slug)).toHaveLength(1);
    expect((await s.get("users", u.id))?.email).toBe(
      legacyPresentationBaseline("users", u.id)?.email,
    );
    expect((await s.list("users")).filter((x) => x.email === u.email)).toHaveLength(1);
  } finally {
    await s.destroy();
  }
});
