import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import Permissions from "../../src/features/admin/accounts/pages/permissions";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => ({ status: "idle" }) }));

test("permission editor uses server-defined actions and saves permission IDs with a role revision", async () => {
  localStorage.clear();
  const principal = { ...profile, fullAccess: true, isMaster: true };
  let saved: Record<string, unknown> | undefined;
  const roles = [
    {
      id: "system-user",
      name: "Người dùng",
      description: "",
      isSystem: true,
      fullAccess: false,
      revision: 1,
      permissionIds: ["customer_access.view"],
    },
  ];
  const permissions = [
    { id: "customer_access.view", code: "customer_access.view", description: "Xem khách truy cập" },
    {
      id: "account.assign_role",
      code: "account.assign_role",
      description: "Cấp vai trò cho tài khoản",
    },
  ];
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, options) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("refresh")) return json({ ...grant("memory-admin"), profile: principal });
      if (path.endsWith("profile")) return json(principal);
      if (options?.method === "PATCH") {
        saved = JSON.parse(String(options.body));
        return json({ ...roles[0], ...saved, revision: 2 });
      }
      return json(path === "/api/permissions" ? permissions : roles);
    },
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <NoticeProvider>
          <Permissions />
        </NoticeProvider>
      </AdminProvider>
    </QueryClientProvider>,
  );
  const item = await screen.findByRole("checkbox", { name: "Cấp vai trò cho tài khoản" });
  await userEvent.setup().click(item);
  await userEvent.setup().click(screen.getByRole("button", { name: "Lưu phân quyền" }));
  expect(saved).toEqual({
    revision: 1,
    permissionIds: ["customer_access.view", "account.assign_role"],
  });
  view.unmount();
  query.clear();
});
