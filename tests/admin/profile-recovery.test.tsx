import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider, useAdmin } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import { ServerProfile } from "../../src/features/admin/accounts/server-profile";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => ({ status: "idle" }) }));
let observed: ReturnType<typeof useAdmin>;
function Shell() {
  observed = useAdmin();
  const { session } = observed;
  return (
    <output aria-label="Shell profile">
      {session?.kind === "http" ? JSON.stringify(session.principal) : ""}
    </output>
  );
}
function setup(fetch: typeof globalThis.fetch) {
  localStorage.clear();
  const client = createAdminHttp({ origin: "http://localhost", refreshLock: immediateLock, fetch }),
    cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={cache}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <NoticeProvider>
          <Shell />
          <ServerProfile />
        </NoticeProvider>
      </AdminProvider>
    </QueryClientProvider>,
  );
  return () => {
    view.unmount();
    cache.clear();
  };
}
const current = { ...profile, phone: null, avatarId: null };
it("409 then failed reload retains draft, successful reload replaces it", async () => {
  let reads = 0;
  const cleanup = setup(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/auth/refresh") return json(grant("token"));
    if (path === "/api/auth/profile") return json(current);
    if (init?.method === "PATCH")
      return json({ error: { code: "REVISION_CONFLICT", message: "Xung đột kiểm thử" } }, 409);
    reads++;
    return reads === 2
      ? json({ error: { code: "UNAVAILABLE", message: "Không tải được hồ sơ" } }, 503)
      : json(reads > 2 ? { ...current, displayName: "Bản mới đã tải", revision: 2 } : current);
  });
  await screen.findByDisplayValue(current.displayName);
  fireEvent.change(screen.getByLabelText("Tên hiển thị"), {
    target: { value: "Bản nháp cần giữ" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await screen.findByText("Xung đột kiểm thử");
  fireEvent.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }));
  await screen.findByText("Không tải được hồ sơ");
  expect(screen.getByLabelText("Tên hiển thị")).toHaveValue("Bản nháp cần giữ");
  fireEvent.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }));
  await screen.findByDisplayValue("Bản mới đã tải");
  expect(screen.getByRole("button", { name: "Lưu thông tin" })).toBeDisabled();
  cleanup();
});
it("confirmed metadata and avatar saves update form and shell without depending on a later profile GET", async () => {
  let authReads = 0,
    state = { ...current };
  const cleanup = setup(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/auth/refresh") return json(grant("token"));
    if (path === "/api/auth/profile") {
      authReads++;
      return authReads === 1
        ? json(state)
        : json({ error: { code: "UNAVAILABLE", message: "Shell refresh unavailable" } }, 503);
    }
    if (path.startsWith("/api/profile/avatar/") && init?.method === "GET")
      return new Response(new Uint8Array([1]), { headers: { "Content-Type": "image/png" } });
    if (init?.method === "PATCH") {
      state = { ...state, ...JSON.parse(String(init.body)), revision: 2 };
      return json(state);
    }
    if (init?.method === "PUT") {
      state = { ...state, avatarId: "new-image", revision: 3 };
      return json(state);
    }
    return json(state);
  });
  await screen.findByDisplayValue(current.displayName);
  fireEvent.change(screen.getByLabelText("Tên hiển thị"), {
    target: { value: "Tên đã lưu chắc chắn" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await screen.findByText("Đã lưu hồ sơ");
  expect(screen.getByRole("button", { name: "Lưu thông tin" })).toBeDisabled();
  expect(screen.getByLabelText("Shell profile")).toHaveTextContent("Tên đã lưu chắc chắn");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Chọn ảnh đại diện"), {
    target: { files: [new File(["png"], "a.png", { type: "image/png" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu ảnh" }));
  await screen.findByText("Đã cập nhật ảnh đại diện");
  expect(screen.getByLabelText("Shell profile")).toHaveTextContent("new-image");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(authReads).toBe(1);
  cleanup();
});

it("a confirmed-profile callback from the old session cannot overwrite a new identity", async () => {
  let active = { ...current };
  const cleanup = setup(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/auth/logout") return new Response(null, { status: 204 });
    if (path === "/api/auth/login")
      active = { ...current, id: "other-user", displayName: "Tài khoản mới" };
    if (path === "/api/auth/refresh" || path === "/api/auth/login")
      return json({ ...grant("token"), profile: active });
    return json(active);
  });
  await screen.findByDisplayValue(current.displayName);
  const previous = observed.applyProfile;
  await act(async () => {
    await observed.logout();
    await observed.login({ username: "other-user", password: "test-password" });
  });
  await screen.findByDisplayValue("Tài khoản mới");
  expect(previous({ ...current, displayName: "Không được ghi từ phiên cũ", revision: 2 })).toBe(
    false,
  );
  expect(screen.getByLabelText("Shell profile")).toHaveTextContent("Tài khoản mới");
  cleanup();
});
