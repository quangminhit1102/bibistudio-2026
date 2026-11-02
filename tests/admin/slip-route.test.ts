import { it, expect } from "vitest";
import { businessFixture } from "./business-fixtures";
import { resolveSlipRoute, slipRouteToken } from "../../src/features/admin/sales/slip-route";
it("resolves ID and number to the same primary record and rejects ambiguous numbers", async () => {
  const { store } = await businessFixture("slip-route");
  try {
    const first = (await store.get("purchaseSlips", "slip-demo-1"))!;
    expect((await resolveSlipRoute(store, first.number)).id).toBe(first.id);
    expect(slipRouteToken(await resolveSlipRoute(store, first.id))).toBe(first.number);
    await store.transaction(["purchaseSlips"], (tx) =>
      tx.put("purchaseSlips", { ...first, id: "collision" }),
    );
    await expect(resolveSlipRoute(store, first.number)).rejects.toMatchObject({ code: "conflict" });
    await expect(resolveSlipRoute(store, "missing")).rejects.toMatchObject({ code: "not-found" });
  } finally {
    await store.destroy();
  }
});
