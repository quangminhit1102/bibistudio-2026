import { expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import Profile from "../../src/features/admin/settings/pages/profile";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => ({ status: "idle" }) }));

test("the master account's own profile has the edit and avatar controls of any user", async () => {
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
  expect(await screen.findByDisplayValue("Quản trị chính")).not.toHaveAttribute("readonly");
  expect(screen.queryByText("Tài khoản quản trị gốc được bảo vệ")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lưu thông tin" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Chọn ảnh" })).toBeEnabled();
  expect(screen.getByLabelText("Chọn ảnh đại diện")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Đổi mật khẩu" })).toBeInTheDocument();
  expect(screen.getByLabelText("Mật khẩu hiện tại")).toBeInTheDocument();
  view.unmount();
  query.clear();
});

test("a password change keeps unsaved profile edits and the next save uses the new revision", async () => {
  localStorage.clear();
  const sent: { path: string; method: string; body: unknown }[] = [];
  let current = { ...profile, phone: null, avatarId: null };
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, init) => {
      const path = new URL(String(input)).pathname,
        method = init?.method ?? "GET";
      if (path.endsWith("refresh")) return json({ ...grant("memory-user"), profile: current });
      if (method !== "GET") {
        sent.push({ path, method, body: JSON.parse(String(init?.body ?? "null")) });
        const body = sent[sent.length - 1].body as { displayName?: string };
        current = {
          ...current,
          ...(path === "/api/profile" ? { displayName: body.displayName! } : {}),
          revision: current.revision + 1,
        };
      }
      return json(current);
    },
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
  expect(await screen.findByRole("heading", { name: "Đổi mật khẩu" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "Tên đang sửa" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "old-pass-1" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "new-pass-22" } });
  fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu mới"), {
    target: { value: "new-pass-22" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
  expect(
    await screen.findByText("Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất."),
  ).toBeInTheDocument();
  expect(sent).toEqual([
    {
      path: "/api/profile/password",
      method: "POST",
      body: { currentPassword: "old-pass-1", newPassword: "new-pass-22" },
    },
  ]);
  expect(screen.getByLabelText("Tên hiển thị")).toHaveValue("Tên đang sửa");
  expect(screen.getByLabelText("Mật khẩu hiện tại")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await waitFor(() => expect(sent).toHaveLength(2));
  expect(sent[1]).toMatchObject({
    path: "/api/profile",
    method: "PATCH",
    body: { displayName: "Tên đang sửa", revision: 2 },
  });
  expect(await screen.findByText("Đã lưu hồ sơ")).toBeInTheDocument();
  view.unmount();
  query.clear();
});
