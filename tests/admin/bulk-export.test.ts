import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { createEntityService } from "../../src/features/admin/services/entity-service";
import { seedBase } from "../../src/features/admin/demo/clock";
it("exports all filtered rows and bulk reports stale records without fake success", async () => {
  const store = createAdminStore("bulk-test");
  try {
    await store.transaction(["authors"], async (tx) => {
      for (let i = 0; i < 240; i++)
        await tx.put("authors", { ...seedBase("a" + i), name: "Author " + i });
    });
    const service = createEntityService(store, "authors", () => ({
      userId: "u",
      roleId: "super-admin",
    }));
    expect((await service.export({ page: 1, pageSize: 10, search: "Author" })).length).toBe(240);
    const result = await service.bulk({ type: "update", values: { name: "Updated" } }, [
      { id: "a0", revision: 1 },
      { id: "a1", revision: 9 },
    ]);
    expect(result.updated).toBe(1);
    expect(result.failures).toHaveLength(1);
    const viewer = createEntityService(store, "authors", () => ({ userId: "v", roleId: "viewer" }));
    await expect(viewer.export({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      code: "forbidden",
    });
  } finally {
    await store.destroy();
  }
});
