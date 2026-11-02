import { afterEach, expect, it } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { createLocalAuthService } from "../../src/features/admin/accounts/auth/local-service";
import { safeAdminReturnTo } from "../../src/features/admin/accounts/auth/return-to";
afterEach(() => localStorage.clear());
it("logout cancels pending login before it can persist a session", async () => {
  const store = createAdminStore("auth-race-" + crypto.randomUUID());
  let release!: () => void;
  const auth = createLocalAuthService(store, async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await ensureDataset(store, "users");
  });
  const pending = auth.login({ username: "bibi.admin", password: "BibiLocal!2026" });
  store.invalidateOperations();
  await auth.logout();
  release();
  await expect(pending).rejects.toMatchObject({ code: "aborted" });
  expect(localStorage.getItem("bibi-admin:session")).toBeNull();
  await store.destroy();
});
it("rejects invalid credentials, expires legacy and restores only active versioned sessions", async () => {
  const store = createAdminStore("auth-" + crypto.randomUUID());
  const auth = createLocalAuthService(store, () => ensureDataset(store, "users"));
  localStorage.setItem(
    "bibi-admin:session",
    JSON.stringify({ userId: "user-1", roleId: "super-admin" }),
  );
  expect(await auth.getSession()).toBeNull();
  await expect(auth.login({ username: "bibi.admin", password: "wrong" })).rejects.toThrow();
  expect(await auth.getSession()).toBeNull();
  expect(await auth.login({ username: "bibi.admin", password: "BibiLocal!2026" })).toEqual({
    userId: "user-1",
    roleId: "super-admin",
  });
  expect(localStorage.getItem("bibi-admin:session")).not.toContain("BibiLocal!2026");
  expect(await auth.getSession()).toEqual({ userId: "user-1", roleId: "super-admin" });
  await store.transaction(["users"], async (tx) => {
    const u = (await tx.get("users", "user-1"))!;
    await tx.put("users", { ...u, active: false });
  });
  expect(await auth.getSession()).toBeNull();
  await auth.logout();
  expect(localStorage.getItem("bibi-admin:session")).toBeNull();
  await store.destroy();
});
it("rejects external, encoded escape and public returnTo while preserving basepath and query", () => {
  for (const input of [
    "//evil.test",
    "https://evil.test",
    "/contact",
    "/admin/../contact",
    "/admin/%2e%2e/contact",
    "/admin%2f..%2fcontact",
    "/admin\\evil",
  ])
    expect(safeAdminReturnTo(input, "/")).toBe("/admin/dashboard");
  expect(safeAdminReturnTo("/~vhplasti/admin/sales/slips?year=2026", "/~vhplasti")).toBe(
    "/~vhplasti/admin/sales/slips?year=2026",
  );
});
