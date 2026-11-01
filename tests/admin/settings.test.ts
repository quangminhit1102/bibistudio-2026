import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { saveSetting } from "../../src/features/admin/settings/service";
it("settings validate, persist, audit and reject forbidden updates", async () => {
  const s = createAdminStore("settings-test");
  try {
    await ensureDataset(s, "settings");
    await expect(
      saveSetting(
        s,
        { userId: "v", roleId: "viewer" },
        "general",
        {
          studioName: "Name",
          email: "demo@example.test",
          timezone: "Asia/Ho_Chi_Minh",
          language: "vi",
        },
        1,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      saveSetting(
        s,
        { userId: "u", roleId: "super-admin" },
        "general",
        { studioName: "", email: "wrong", timezone: "UTC", language: "vi" },
        1,
      ),
    ).rejects.toMatchObject({ code: "validation" });
    await saveSetting(
      s,
      { userId: "u", roleId: "super-admin" },
      "security",
      { demoMfa: true, sessionTimeout: 15 },
      1,
    );
    expect((await s.get("settings", "security"))?.values.demoMfa).toBe(true);
    expect((await s.list("audit")).length).toBe(1);
  } finally {
    await s.destroy();
  }
});
