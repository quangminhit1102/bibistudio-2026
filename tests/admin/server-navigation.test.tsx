import { afterEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { AdminLayout } from "../../src/features/admin/shell/admin-layout";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
import { filterNavigation, canAccessAdminPath } from "../../src/features/admin/shell/navigation";
const router = vi.hoisted(() => ({ pathname: "/admin/analytics/visitors", navigate: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: router.pathname } }),
  Outlet: () => <p>Dữ liệu khách truy cập</p>,
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

test("visitor-only server session sees its identity and logout without profile/search/dashboard shortcuts", async () => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) =>
      json(new URL(String(input)).pathname.endsWith("profile") ? profile : grant("memory-user")),
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <AdminLayout />
      </AdminProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Dữ liệu khách truy cập")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Bảng điều khiển" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Tìm kiếm/ })).not.toBeInTheDocument();
  const account = screen.getAllByRole("button", { name: "Tài khoản Người dùng" });
  await userEvent.setup().click(account[0]);
  expect(screen.getByRole("menuitem", { name: "Đăng xuất" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Hồ sơ" })).not.toBeInTheDocument();
  view.unmount();
  query.clear();
});

test("role-view permission opens Roles without inventing account-view authority", () => {
  const session = {
    kind: "http" as const,
    userId: profile.id,
    principal: { ...profile, permissions: ["role.view"] },
  };
  const paths = filterNavigation(session).flatMap((group) => group.items.map((item) => item.path));
  expect(paths).toContain("/admin/accounts/roles");
  expect(paths).not.toContain("/admin/accounts/users");
  expect(canAccessAdminPath(session, "/admin/accounts/roles")).toBe(true);
  expect(canAccessAdminPath(session, "/admin/accounts/users")).toBe(false);
});
