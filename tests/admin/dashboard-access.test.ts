import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { loadDashboard } from "../../src/features/admin/dashboard/service";
import { presetRange } from "../../src/features/admin/analytics/aggregate";
it("Editor receives aggregate KPIs without raw customer, visitor, account or audit rows", async () => {
  const store = createAdminStore("dashboard-access");
  try {
    const result = await loadDashboard(
      store,
      { userId: "user-3", roleId: "editor" },
      presetRange("30"),
    );
    expect(result.business.count).toBe(2);
    expect(result.business.selected).toEqual([]);
    expect(result.business.byCustomer).toEqual([]);
    expect(result.visitors).toEqual([]);
    expect(result.sessions).toEqual([]);
    expect(result.users).toEqual([]);
    expect(result.activity).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("Nhà sách demo 1");
    expect(await store.list("orders")).toEqual([]);
    expect(await store.list("books")).toEqual([]);
  } finally {
    await store.destroy();
  }
});
