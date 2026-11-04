import { expect, test } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { searchAdmin } from "../../src/features/admin/shell/search-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
test("account search uses HTTP data and never seeds local identities", async () => {
  const store = createAdminStore("http-search-" + crypto.randomUUID());
  const principal = { ...profile, permissions: ["account.view"] };
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) =>
      json(
        new URL(String(input)).pathname.endsWith("login")
          ? { ...grant("memory-account-reader"), profile: principal }
          : {
              items: [
                {
                  ...principal,
                  id: "server-result",
                  username: "found-user",
                  displayName: "Tài khoản tìm thấy",
                },
              ],
              total: 1,
              page: 1,
              pageSize: 5,
            },
      ),
  });
  await client.login({ username: "user01", password: "test-only" });
  const result = await searchAdmin(
    store,
    { kind: "http", userId: principal.id, principal },
    "found",
    undefined,
    client,
  );
  expect(result).toHaveLength(1);
  expect(result[0].path).toBe("/admin/accounts/users/server-result");
  expect(result[0].label).toContain("Tài khoản tìm thấy");
  expect(await store.list("users")).toHaveLength(0);
  await store.destroy();
});
