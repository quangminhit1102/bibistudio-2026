import { it, expect } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { getProfile, saveProfile } from "../../src/features/admin/accounts/profile-service";
it("viewer can edit own profile but cannot change their role", async () => {
  const store = createAdminStore("profile-test");
  try {
    await ensureDataset(store, "users");
    const user = (await store.list("users")).find((u) => u.roleId === "viewer")!;
    const session = { userId: user.id, roleId: user.roleId };
    expect((await getProfile(store, session)).id).toBe(user.id);
    const updated = await saveProfile(
      store,
      session,
      { name: "Tên mới", email: "profile@example.test", roleId: "super-admin" },
      user.revision,
    );
    expect(updated.roleId).toBe("viewer");
    expect(updated.name).toBe("Tên mới");
    await expect(
      saveProfile(store, session, { name: "", email: "wrong" }, updated.revision),
    ).rejects.toMatchObject({ code: "validation" });
  } finally {
    await store.destroy();
  }
});
