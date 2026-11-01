import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset, clearSeedCache } from "../../src/features/admin/demo/registry";
it("seeds deterministic related datasets once and resets without missing records", async () => {
  const s = createAdminStore("seed-test");
  try {
    for (const e of ["products", "books", "users", "posts", "orders", "sessions"] as const)
      await ensureDataset(s, e);
    expect((await s.list("products")).length).toBe(50);
    expect((await s.list("books")).length).toBe(30);
    expect((await s.list("authors")).length).toBe(15);
    expect((await s.list("users")).length).toBe(30);
    expect((await s.list("posts")).length).toBe(40);
    expect((await s.list("orders")).length).toBe(100);
    expect((await s.list("sessions")).length).toBe(200);
    await ensureDataset(s, "products");
    expect((await s.list("products")).length).toBe(50);
    await s.reset();
    clearSeedCache(s);
    await ensureDataset(s, "products");
    expect((await s.list("products")).length).toBe(50);
  } finally {
    await s.destroy();
  }
});
