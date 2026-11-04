import { expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import Roles from "../../src/features/admin/accounts/pages/roles";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => ({ status: "idle" }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: React.PropsWithChildren) => <a>{children}</a>,
}));
test("roles page creates a server role without client-owned fullAccess flags", async () => {
  localStorage.clear();
  const principal = { ...profile, fullAccess: true, isMaster: true };
  const roles = [
    {
      id: "system-admin",
      name: "Quản trị viên",
      description: "",
      isSystem: true,
      fullAccess: true,
      revision: 1,
      permissionIds: [],
    },
  ];
  let saved: unknown;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, options) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("refresh")) return json({ ...grant("memory-admin"), profile: principal });
      if (path.endsWith("profile")) return json(principal);
      if (options?.method === "POST") {
        saved = JSON.parse(String(options.body));
        const role = {
          ...roles[0],
          ...(saved as object),
          id: "new-role",
          fullAccess: false,
          isSystem: false,
        };
        roles.push(role);
        return json(role, 201);
      }
      return json(roles);
    },
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <NoticeProvider>
          <Roles />
        </NoticeProvider>
      </AdminProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("Quản trị viên");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Tạo vai trò" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Tạo vai trò" }));
  await user.type(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Biên tập");
  await user.click(dialog.getByRole("button", { name: "Lưu vai trò" }));
  expect(await screen.findByText("Biên tập")).toBeInTheDocument();
  expect(saved).toEqual({ name: "Biên tập", description: "" });
  view.unmount();
  query.clear();
});
