import { expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import Users from "../../src/features/admin/accounts/pages/users";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
  Link: ({ children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a {...props}>{children}</a>
  ),
}));

test("server account page lists API data and creates a multi-role account through the API", async () => {
  localStorage.clear();
  const principal = {
    ...profile,
    id: "admin-server",
    username: "admin",
    fullAccess: true,
    isMaster: true,
  };
  const records = [
    {
      ...principal,
      active: true,
      createdAt: "2026-11-04T00:00:00Z",
      updatedAt: "2026-11-04T00:00:00Z",
    },
  ];
  let created: Record<string, unknown> | undefined;
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, options) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("refresh")) return json({ ...grant("memory-admin"), profile: principal });
      if (path.endsWith("profile")) return json(principal);
      if (path.endsWith("options"))
        return json([
          { id: "system-user", name: "Người dùng" },
          { id: "system-admin", name: "Quản trị viên" },
        ]);
      if (path === "/api/accounts" && options?.method === "POST") {
        created = JSON.parse(String(options.body));
        const record = {
          ...records[0],
          ...created,
          id: "new-server",
          isMaster: false,
          username: String(created!.username),
        };
        records.push(record);
        return json(record, 201);
      }
      return json({ items: records, total: records.length, page: 1, pageSize: 20 });
    },
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <NoticeProvider>
          <Users />
        </NoticeProvider>
      </AdminProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("admin")).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  const dialog = await screen.findByRole("dialog", { name: "Tạo tài khoản" });
  const form = within(dialog);
  await user.type(await form.findByRole("textbox", { name: "Tên tài khoản" }), "new-server");
  await user.type(form.getByRole("textbox", { name: "Tên hiển thị" }), "Tài khoản máy chủ");
  await user.type(form.getByLabelText("Mật khẩu"), "Only-test-Page!99");
  await user.click(form.getByRole("checkbox", { name: "Quản trị viên" }));
  await user.click(form.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  expect(await screen.findByText("new-server")).toBeInTheDocument();
  expect(created?.roleIds).toEqual(["system-user", "system-admin"]);
  expect(created).not.toHaveProperty("roleId");
  view.unmount();
  query.clear();
});
