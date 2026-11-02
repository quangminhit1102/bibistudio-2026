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
import type { AdminStore } from "../../src/features/admin/services/contracts";
import { businessFixture } from "./business-fixtures";
import { createEntityService } from "../../src/features/admin/services/entity-service";
import { AdminProvider } from "../../src/features/admin/services/context";
import CustomerList from "../../src/features/admin/customers/pages/list";
import CustomerEditor from "../../src/features/admin/customers/pages/editor";
import { customerReturnTo } from "../../src/features/admin/customers/config";
import { RouteLeaf } from "../../src/lib/route-leaf";
const runtime = vi.hoisted(() => ({ store: undefined as AdminStore | undefined }));
vi.mock("../../src/features/admin/demo/store", async (original) => {
  const actual = await original<typeof import("../../src/features/admin/demo/store")>();
  return {
    ...actual,
    createAdminStore: (...args: Parameters<typeof actual.createAdminStore>) =>
      runtime.store ?? actual.createAdminStore(...args),
  };
});
let fixture: Awaited<ReturnType<typeof businessFixture>>;
let client: QueryClient;
beforeEach(async () => {
  fixture = await businessFixture("customer-ui-test");
  runtime.store = fixture.store;
  localStorage.setItem(
    "bibi-admin:session",
    JSON.stringify({ version: 2, session: fixture.session }),
  );
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  cleanup();
  client.clear();
  runtime.store = undefined;
  localStorage.clear();
  await fixture.store.destroy();
});
function mount(entry: string) {
  const root = createRootRoute({ component: Outlet });
  const list = createRoute({
    getParentRoute: () => root,
    path: "/admin/customers",
    component: () => <RouteLeaf routeId={list.id} page={CustomerList} />,
  });
  const create = createRoute({
    getParentRoute: () => list,
    path: "create",
    component: CustomerEditor,
  });
  const edit = createRoute({
    getParentRoute: () => list,
    path: "$id/edit",
    component: CustomerEditor,
  });
  const router = createRouter({
    routeTree: root.addChildren([list.addChildren([create, edit])]),
    history: createMemoryHistory({ initialEntries: [entry] }),
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

it("creates and edits customers on dedicated pages and deactivates without deleting", async () => {
  const u = userEvent.setup();
  mount("/admin/customers/create");
  await u.type(await screen.findByRole("textbox", { name: /Tên khách/ }), "Nhà sách thử nghiệm");
  await u.selectOptions(screen.getByLabelText(/Loại khách/), "company");
  await u.click(screen.getByRole("checkbox", { name: "Áp dụng VAT" }));
  await u.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await screen.findByRole("heading", { name: "Khách mua hàng", exact: true });
  const created = (await fixture.store.list("customers")).find(
    (c) => c.name === "Nhà sách thử nghiệm",
  )!;
  expect(created).toMatchObject({ kind: "company", vatApplied: true, active: true });
  cleanup();
  mount(`/admin/customers/${created.id}/edit`);
  expect(await screen.findByRole("checkbox", { name: "Áp dụng VAT" })).toBeChecked();
  await u.click(screen.getByRole("checkbox", { name: "Đang sử dụng" }));
  await u.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(async () =>
    expect((await fixture.store.get("customers", created.id))?.active).toBe(false),
  );
  expect(await fixture.store.get("customers", created.id)).toBeDefined();
});

it("same names and contact emails stay distinct and referenced customers cannot be deleted", async () => {
  const svc = createEntityService(fixture.store, "customers", () => fixture.session);
  const input = {
    name: "Trùng tên",
    kind: "individual" as const,
    address: "",
    vatApplied: false,
    notes: "",
    active: true,
    email: "shared@example.test",
  };
  const first = await svc.create(input),
    second = await svc.create(input);
  expect(first.id).not.toBe(second.id);
  const referenced = (await fixture.store.get("customers", fixture.customerId))!;
  await expect(svc.remove(referenced.id, referenced.revision)).rejects.toMatchObject({
    code: "validation",
  });
});

it("viewer cannot write and customer list never offers destructive delete", async () => {
  const svc = createEntityService(fixture.store, "customers", () => ({
    userId: "user-5",
    roleId: "viewer",
  }));
  await expect(svc.update(fixture.customerId, { active: false }, 1)).rejects.toMatchObject({
    code: "forbidden",
  });
  mount("/admin/customers");
  await screen.findByRole("heading", { name: "Khách mua hàng", exact: true });
  const u = userEvent.setup();
  await u.click((await screen.findAllByRole("button", { name: /Thao tác customer-/ }))[0]);
  expect(screen.queryByRole("menuitem", { name: "Xóa", exact: true })).not.toBeInTheDocument();
});

it("Cancel returns to the validated list query and does not write", async () => {
  const router = mount(
    "/admin/customers/create?returnTo=%2Fadmin%2Fcustomers%3Fq%3Dabc%26page%3D2%26f_kind%3Dcompany",
  );
  await screen.findByRole("textbox", { name: /Tên khách/ });
  await userEvent.setup().click(screen.getByRole("button", { name: "Hủy", exact: true }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/admin/customers"));
  expect(router.state.location.search).toMatchObject({ q: "abc", f_kind: "company" });
  expect(await fixture.store.list("customers")).toHaveLength(12);
  expect(customerReturnTo("https://evil.test/admin/customers")).toBe("/admin/customers");
  expect(customerReturnTo("/admin/products")).toBe("/admin/customers");
});
