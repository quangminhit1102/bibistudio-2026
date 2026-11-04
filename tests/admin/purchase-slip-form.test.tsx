import { fixtureAuthFactory } from "./helpers/fixture-auth";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
import { businessFixture } from "./business-fixtures";
import { SlipForm } from "../../src/features/admin/sales/components/slip-form";
import SlipEditor from "../../src/features/admin/sales/pages/slip-editor";
import { createSlipService } from "../../src/features/admin/sales/slip-service";
let f: Awaited<ReturnType<typeof businessFixture>>;
let client: QueryClient | undefined;
beforeEach(async () => {
  f = await businessFixture("bibi-admin-demo");
  localStorage.setItem("bibi-admin:session", JSON.stringify({ version: 2, session: f.session }));
});
afterEach(async () => {
  cleanup();
  client?.clear();
  client = undefined;
  localStorage.clear();
  await f.store.destroy();
});
async function options() {
  return { customers: await f.store.list("customers"), products: await f.store.list("products") };
}

it("saves two lines at 35000 and focuses a duplicate product instead of adding it", async () => {
  const u = userEvent.setup();
  const save = vi.fn(async () => {});
  render(<SlipForm {...await options()} onSave={save} onCancel={() => {}} />);
  await u.selectOptions(screen.getByRole("combobox", { name: "Khách mua hàng" }), f.customerId);
  await u.selectOptions(screen.getByRole("combobox", { name: "Sản phẩm" }), "product-1");
  await u.clear(screen.getByRole("spinbutton", { name: "Số lượng dòng 1" }));
  await u.type(screen.getByRole("spinbutton", { name: "Số lượng dòng 1" }), "2");
  await u.clear(screen.getByRole("spinbutton", { name: "Đơn giá dòng 1" }));
  await u.type(screen.getByRole("spinbutton", { name: "Đơn giá dòng 1" }), "10000");
  await u.selectOptions(screen.getByRole("combobox", { name: "Sản phẩm" }), "product-2");
  await u.clear(screen.getByRole("spinbutton", { name: "Số lượng dòng 2" }));
  await u.type(screen.getByRole("spinbutton", { name: "Số lượng dòng 2" }), "3");
  await u.clear(screen.getByRole("spinbutton", { name: "Đơn giá dòng 2" }));
  await u.type(screen.getByRole("spinbutton", { name: "Đơn giá dòng 2" }), "5000");
  expect(screen.getByRole("status", { name: "Tổng tiền" })).toHaveTextContent(/35\.000\s*₫/);
  await u.selectOptions(screen.getByRole("combobox", { name: "Sản phẩm" }), "product-1");
  expect(screen.queryByRole("spinbutton", { name: "Số lượng dòng 3" })).not.toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: "Số lượng dòng 1" })).toHaveFocus();
  await u.click(screen.getByRole("button", { name: "Lưu phiếu" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const saved = await createSlipService(f.store, () => f.session).create(save.mock.calls[0][0]);
  expect(saved.total).toBe(35000);
  expect(saved.customerSnapshot.name).toBe((await f.store.get("customers", f.customerId))?.name);
});

it("keeps manual VAT and dirty values on refetch but resets VAT on explicit customer switch", async () => {
  const data = await options(),
    u = userEvent.setup(),
    save = vi.fn(async () => {});
  const view = render(<SlipForm {...data} onSave={save} onCancel={() => {}} />);
  await u.selectOptions(screen.getByRole("combobox", { name: "Khách mua hàng" }), "customer-1");
  expect(screen.getByRole("checkbox", { name: "Có VAT" })).toBeChecked();
  await u.click(screen.getByRole("checkbox", { name: "Có VAT" }));
  view.rerender(
    <SlipForm
      {...data}
      customers={data.customers.map((c) => ({ ...c, name: c.name + " sửa" }))}
      onSave={save}
      onCancel={() => {}}
    />,
  );
  expect(screen.getByRole("checkbox", { name: "Có VAT" })).not.toBeChecked();
  expect(screen.getByText("Khác mặc định của khách")).toBeInTheDocument();
  await u.selectOptions(screen.getByRole("combobox", { name: "Khách mua hàng" }), "customer-3");
  expect(screen.getByRole("checkbox", { name: "Có VAT" })).toBeChecked();
});

it("validation and save errors retain typed lines and notes", async () => {
  const data = await options(),
    u = userEvent.setup();
  const save = vi.fn(async () => {
    throw new Error("Không đủ dung lượng");
  });
  render(<SlipForm {...data} onSave={save} onCancel={() => {}} />);
  await u.selectOptions(screen.getByRole("combobox", { name: "Khách mua hàng" }), "customer-1");
  await u.selectOptions(screen.getByRole("combobox", { name: "Sản phẩm" }), "product-1");
  await u.clear(screen.getByRole("spinbutton", { name: "Số lượng dòng 1" }));
  await u.type(screen.getByRole("spinbutton", { name: "Số lượng dòng 1" }), "-1");
  await u.click(screen.getByRole("button", { name: "Lưu phiếu" }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeInTheDocument();
  await u.clear(screen.getByRole("spinbutton", { name: "Số lượng dòng 1" }));
  await u.type(screen.getByRole("spinbutton", { name: "Số lượng dòng 1" }), "2");
  await u.type(screen.getByRole("textbox", { name: "Ghi chú" }), "Giữ nội dung");
  await u.click(screen.getByRole("button", { name: "Lưu phiếu" }));
  expect(await screen.findByText("Không đủ dung lượng")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Ghi chú" })).toHaveValue("Giữ nội dung");
});

it("dirty Cancel asks before leaving and preserves list filters after confirmation", async () => {
  const u = userEvent.setup();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: Outlet });
  const edit = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/slips/create",
    component: SlipEditor,
  });
  const list = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/slips",
    component: () => <h1>Phiếu mua hàng</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([edit, list]),
    history: createMemoryHistory({
      initialEntries: [
        "/admin/sales/slips/create?returnTo=%2Fadmin%2Fsales%2Fslips%3Fq%3DPMH%26f_customerId%3Dcustomer-1",
      ],
    }),
  });
  render(
    <QueryClientProvider client={client}>
      <AdminProvider authFactory={fixtureAuthFactory}>
        <RouterProvider router={router} />
      </AdminProvider>
    </QueryClientProvider>,
  );
  await u.selectOptions(
    await screen.findByRole("combobox", { name: "Khách mua hàng" }),
    "customer-1",
  );
  await u.click(screen.getByRole("button", { name: "Hủy", exact: true }));
  expect(await screen.findByRole("heading", { name: "Bỏ thay đổi chưa lưu?" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/sales/slips/create");
  await u.click(screen.getByRole("button", { name: "Xác nhận", exact: true }));
  await screen.findByRole("heading", { name: "Phiếu mua hàng" });
  expect(router.state.location.search).toMatchObject({ q: "PMH", f_customerId: "customer-1" });
});

it("voided slip detail remains readable without edit or void actions", async () => {
  const { default: SlipDetail } = await import("../../src/features/admin/sales/pages/slip-detail");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: Outlet });
  const detail = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/slips/$id",
    component: SlipDetail,
  });
  const router = createRouter({
    routeTree: root.addChildren([detail]),
    history: createMemoryHistory({ initialEntries: ["/admin/sales/slips/slip-demo-9"] }),
  });
  render(
    <QueryClientProvider client={client}>
      <AdminProvider authFactory={fixtureAuthFactory}>
        <RouterProvider router={router} />
      </AdminProvider>
    </QueryClientProvider>,
  );
  const number = (await f.store.get("purchaseSlips", "slip-demo-9"))!.number;
  await waitFor(() => expect(router.state.location.pathname).toBe("/admin/sales/slips/" + number));
  expect(await screen.findByText("Điều chỉnh yêu cầu")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Chỉnh sửa", exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Hủy phiếu", exact: true })).not.toBeInTheDocument();
});
