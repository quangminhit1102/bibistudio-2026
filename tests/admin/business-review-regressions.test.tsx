import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import SlipEditor from "../../src/features/admin/sales/pages/slip-editor";
import Slips from "../../src/features/admin/sales/pages/slips";
import CustomerEditor from "../../src/features/admin/customers/pages/editor";
import * as downloads from "../../src/features/admin/shared/lib/text";
import { businessFixture } from "./business-fixtures";
let f: Awaited<ReturnType<typeof businessFixture>>, client: QueryClient;
beforeEach(async () => {
  f = await businessFixture("bibi-admin-demo");
  localStorage.setItem("bibi-admin:session", JSON.stringify(f.session));
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  cleanup();
  client.clear();
  localStorage.clear();
  vi.restoreAllMocks();
  await f.store.destroy();
});
function mount(path: string) {
  const root = createRootRoute({ component: Outlet });
  const edit = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/slips/$id/edit",
    component: SlipEditor,
  });
  const create = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/slips/create",
    component: SlipEditor,
  });
  const list = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/slips",
    component: Slips,
  });
  const customer = createRoute({
    getParentRoute: () => root,
    path: "/admin/customers/$id/edit",
    component: CustomerEditor,
  });
  const router = createRouter({
    routeTree: root.addChildren([edit, create, list, customer]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={client}>
      <AdminProvider>
        <RouterProvider router={router} />
      </AdminProvider>
    </QueryClientProvider>,
  );
  return router;
}
it("binds the draft and revision to the route ID before saving a different cached slip", async () => {
  const b = (await f.store.get("purchaseSlips", "slip-demo-2"))!;
  client.setQueryData(["bibi-admin", "purchaseSlips", "detail", b.id, "super-admin"], b);
  const router = mount("/admin/sales/slips/slip-demo-1/edit"),
    u = userEvent.setup();
  await screen.findByRole("combobox", { name: "Khách mua hàng", exact: true });
  await act(async () => {
    await router.navigate({ to: "/admin/sales/slips/$id/edit", params: { id: b.id } });
  });
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Khách mua hàng", exact: true })).toHaveValue(
      b.customerId,
    ),
  );
  await u.click(screen.getByRole("button", { name: "Lưu phiếu", exact: true }));
  await screen.findByRole("heading", { name: "Phiếu mua hàng", exact: true });
  const saved = (await f.store.get("purchaseSlips", b.id))!;
  expect(saved.customerId).toBe(b.customerId);
  expect(saved.items).toEqual(b.items);
  await act(async () => {
    await router.navigate({ to: "/admin/sales/slips/create" });
  });
  expect(await screen.findByRole("combobox", { name: "Khách mua hàng", exact: true })).toHaveValue(
    "",
  );
});
it("keeps dirty slip notes mounted through failed options refetch and successful retry", async () => {
  mount("/admin/sales/slips/slip-demo-1/edit");
  const u = userEvent.setup();
  const notes = await screen.findByRole("textbox", { name: "Ghi chú", exact: true });
  await u.clear(notes);
  await u.type(notes, "Bản nháp không mất");
  await act(async () => {
    await client
      .fetchQuery({
        queryKey: ["bibi-admin", "slip-options", "user-1"],
        queryFn: async () => {
          throw new Error("Options temporarily unavailable");
        },
        retry: false,
      })
      .catch(() => {});
  });
  expect(screen.getByRole("textbox", { name: "Ghi chú", exact: true })).toHaveValue(
    "Bản nháp không mất",
  );
  expect(await screen.findByText("Options temporarily unavailable")).toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: "Thử lại", exact: true }));
  await waitFor(() =>
    expect(screen.queryByText("Options temporarily unavailable")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("textbox", { name: "Ghi chú", exact: true })).toHaveValue(
    "Bản nháp không mất",
  );
});
it("keeps a dirty customer form on a failed background record refetch", async () => {
  mount("/admin/customers/customer-1/edit");
  const u = userEvent.setup();
  const name = await screen.findByRole("textbox", { name: "Tên khách", exact: true });
  await u.clear(name);
  await u.type(name, "Tên bản nháp");
  await act(async () => {
    await client
      .fetchQuery({
        queryKey: ["bibi-admin", "customers", "detail", "customer-1", "super-admin"],
        queryFn: async () => {
          throw new Error("Record temporarily unavailable");
        },
        retry: false,
      })
      .catch(() => {});
  });
  expect(screen.getByRole("textbox", { name: "Tên khách", exact: true })).toHaveValue(
    "Tên bản nháp",
  );
  expect(await screen.findByText("Record temporarily unavailable")).toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: "Thử lại", exact: true }));
  await waitFor(() =>
    expect(screen.queryByText("Record temporarily unavailable")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("textbox", { name: "Tên khách", exact: true })).toHaveValue(
    "Tên bản nháp",
  );
});
it("renders a retryable lookup failure instead of endless loading for a missing slip", async () => {
  mount("/admin/sales/slips/missing/edit");
  expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được dữ liệu");
  expect(screen.getByRole("button", { name: "Thử lại", exact: true })).toBeInTheDocument();
  expect(screen.queryByLabelText("Đang tải")).not.toBeInTheDocument();
});
it("synchronizes same-route filters, search input, export scope and Back from the URL", async () => {
  const capture = vi.spyOn(downloads, "downloadBlob").mockImplementation(() => {});
  const router = mount("/admin/sales/slips?f_customerId=customer-1&q=PMH"),
    u = userEvent.setup();
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Lọc khách mua hàng" })).toHaveValue("customer-1"),
  );
  await act(async () => {
    await router.navigate({
      to: "/admin/sales/slips",
      search: { f_customerId: "customer-2", q: "PMH-2026" } as never,
    });
  });
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Lọc khách mua hàng" })).toHaveValue("customer-2"),
  );
  expect(screen.getByRole("textbox", { name: "Tìm trong bảng" })).toHaveValue("PMH-2026");
  await u.click(screen.getByRole("button", { name: "Xuất CSV", exact: true }));
  await waitFor(() => expect(capture).toHaveBeenCalledOnce());
  const csv = await capture.mock.calls[0][0].text();
  expect(csv).toContain("Cá nhân demo 2");
  expect(csv).not.toContain("Nhà sách demo 1");
  await act(async () => {
    router.history.back();
  });
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Lọc khách mua hàng" })).toHaveValue("customer-1"),
  );
  expect(screen.getByRole("textbox", { name: "Tìm trong bảng" })).toHaveValue("PMH");
});
