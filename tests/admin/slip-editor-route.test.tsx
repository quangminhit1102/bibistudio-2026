import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import userEvent from "@testing-library/user-event";
import type { EntityKey } from "../../src/features/admin/services/contracts";
import SlipEditor from "../../src/features/admin/sales/pages/slip-editor";
import { businessFixture } from "./business-fixtures";
import { immediateLock, json, profile } from "./helpers/http-client";

let f: Awaited<ReturnType<typeof businessFixture>>;
let query: QueryClient;
let primaryId: string;
beforeEach(async () => {
  localStorage.clear();
  f = await businessFixture("bibi-admin-demo");
  const initial = (await f.store.list("purchaseSlips")).find((s) => s.number === "PMH-2026-0002")!;
  primaryId = initial.id;
  expect(primaryId).not.toBe(initial.number);
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  cleanup();
  query.clear();
  localStorage.clear();
  await f.store.destroy();
});

function open(
  token = "PMH-2026-0002",
  permissions = ["sales.view", "sales.update"],
  fullAccess = true,
  failOptions = false,
) {
  const principal = { ...profile, id: "http-admin", username: "reviewer", fullAccess, permissions };
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) =>
      json(
        String(input).endsWith("/profile")
          ? principal
          : { profile: principal, accessToken: "test-memory", expiresAt: "2099-01-01T00:00:00Z" },
      ),
  });
  const root = createRootRoute({
    component: () => (
      <AdminProvider
        authFactory={(store) => {
          if (failOptions) {
            const list = store.list.bind(store);
            store.list = async <K extends EntityKey>(entity: K) => {
              if (entity === "products") throw new Error("Không tải được lựa chọn sản phẩm");
              return list(entity);
            };
          }
          return createHttpAuthService({ client });
        }}
      >
        <NoticeProvider>
          <Outlet />
        </NoticeProvider>
      </AdminProvider>
    ),
  });
  const edit = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/slips/$id/edit",
    component: SlipEditor,
  });
  const history = createMemoryHistory({
    initialEntries: [`/admin/sales/slips/${token}/edit?returnTo=%2Fadmin%2Fsales%2Fslips%3F`],
  });
  const list = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/slips",
    component: () => <h1>Danh sách phiếu mua hàng</h1>,
  });
  const router = createRouter({ routeTree: root.addChildren([edit, list]), history });
  render(
    <QueryClientProvider client={query}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

it("loads a numbered slip with HTTP auth even though the legacy role query is disabled", async () => {
  const router = open();
  await waitFor(() =>
    expect(
      query.getQueryData(["bibi-admin", "purchaseSlips", "route", "PMH-2026-0002", "http-admin"]),
    ).toMatchObject({ id: primaryId }),
  );
  expect(
    await screen.findByRole("heading", { name: "Chỉnh sửa phiếu mua hàng" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Khách mua hàng" })).toHaveValue(
    (await f.store.get("purchaseSlips", primaryId))!.customerId,
  );
  expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0);
  expect(router.state.location.search.returnTo).toBe("/admin/sales/slips?");
});

it("canonicalizes legacy primary IDs, keeps returnTo, and returns to the list", async () => {
  const router = open(primaryId);
  await screen.findByRole("heading", { name: "Chỉnh sửa phiếu mua hàng" });
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/admin/sales/slips/PMH-2026-0002/edit"),
  );
  expect(router.state.location.search.returnTo).toBe("/admin/sales/slips?");
  await userEvent.setup().click(screen.getByRole("button", { name: "Hủy" }));
  await screen.findByRole("heading", { name: "Danh sách phiếu mua hàng" });
  await router.navigate({ to: "/admin/sales/slips/$id/edit", params: { id: "PMH-2026-0002" } });
  await screen.findByRole("heading", { name: "Chỉnh sửa phiếu mua hàng" });
});
it("ends loading with an error for a missing slip", async () => {
  open("not-a-slip");
  await screen.findByText("Không tìm thấy phiếu mua hàng.");
  expect(screen.queryByLabelText("Đang tải")).not.toBeInTheDocument();
});
it("ends loading for conflicting slip numbers", async () => {
  const row = (await f.store.get("purchaseSlips", primaryId))!;
  await f.store.transaction(["purchaseSlips"], (tx) =>
    tx.put("purchaseSlips", { ...row, id: "collision" }),
  );
  open();
  await screen.findByText("Số phiếu bị trùng. Vui lòng kiểm tra dữ liệu.");
});
it("does not wait for a disabled role query when User has no sales permission", async () => {
  open("PMH-2026-0002", ["customer_access.view"], false);
  await screen.findByText("Vai trò hiện tại không có quyền thực hiện thao tác này.");
  expect(screen.queryByRole("button", { name: "Lưu phiếu" })).not.toBeInTheDocument();
});
it("shows a terminal error when options fail rather than an endless skeleton", async () => {
  open("PMH-2026-0002", ["sales.view", "sales.update"], true, true);
  await screen.findByText("Không tải được lựa chọn sản phẩm");
  expect(screen.queryByLabelText("Đang tải")).not.toBeInTheDocument();
});
it("refuses editing a void slip after loading it", async () => {
  const row = (await f.store.get("purchaseSlips", primaryId))!;
  await f.store.transaction(["purchaseSlips"], (tx) =>
    tx.put("purchaseSlips", { ...row, status: "void" }),
  );
  open();
  await screen.findByText("Phiếu đã hủy chỉ được xem.");
  expect(screen.queryByRole("button", { name: "Lưu phiếu" })).not.toBeInTheDocument();
});
