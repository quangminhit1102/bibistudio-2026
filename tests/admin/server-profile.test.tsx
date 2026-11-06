import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import Profile from "../../src/features/admin/settings/pages/profile";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => ({ status: "idle" }) }));

test("master profile reads server account data with no edit, password or local-avatar controls", async () => {
  localStorage.clear();
  const principal = {
    ...profile,
    username: "admin",
    displayName: "Quản trị chính",
    fullAccess: true,
    isMaster: true,
  };
  const account = {
    ...principal,
    active: true,
    createdAt: "2026-11-04T00:00:00Z",
    updatedAt: "2026-11-04T00:00:00Z",
  };
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) =>
      json(
        new URL(String(input)).pathname.endsWith("refresh")
          ? { ...grant("memory-admin"), profile: principal }
          : new URL(String(input)).pathname.endsWith("profile")
            ? principal
            : account,
      ),
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <NoticeProvider>
          <Profile />
        </NoticeProvider>
      </AdminProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByDisplayValue("Quản trị chính")).toHaveAttribute("readonly");
  expect(screen.getByText("Tài khoản quản trị gốc được bảo vệ")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Lưu thông tin" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Mật khẩu mới")).not.toBeInTheDocument();
  expect(screen.queryByText("Đổi ảnh đại diện")).not.toBeInTheDocument();
  view.unmount();
  query.clear();
});
