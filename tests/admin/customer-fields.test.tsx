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
import { fixtureAuthFactory } from "./helpers/fixture-auth";
import { businessFixture } from "./business-fixtures";
import { AdminProvider } from "../../src/features/admin/services/context";
import CustomerEditor from "../../src/features/admin/customers/pages/editor";
import CustomerDetail from "../../src/features/admin/customers/pages/detail";

vi.mock("@/platform/site", async (original) => ({
  ...(await original<typeof import("../../src/platform/site")>()),
  customers: {
    extraFields: [
      { key: "region", label: "Khu vực thử", type: "text", importHeaders: ["Khu vực"] },
      { key: "points", label: "Điểm thử", type: "number" },
      { key: "priority", label: "Ưu tiên thử", type: "boolean" },
    ],
  },
}));
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
  fixture = await businessFixture("customer-fields-test");
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
    component: () => <h1>Customers destination</h1>,
  });
  const create = createRoute({
    getParentRoute: () => root,
    path: "/admin/customers/create",
    component: CustomerEditor,
  });
  const edit = createRoute({
    getParentRoute: () => root,
    path: "/admin/customers/$id/edit",
    component: CustomerEditor,
  });
  const detail = createRoute({
    getParentRoute: () => root,
    path: "/admin/customers/$id",
    component: CustomerDetail,
  });
  const router = createRouter({
    routeTree: root.addChildren([list, create, edit, detail]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(
    <QueryClientProvider client={client}>
      <AdminProvider authFactory={fixtureAuthFactory}>
        <RouterProvider router={router} />
      </AdminProvider>
    </QueryClientProvider>,
  );
}

it("creates a customer with representative and typed site fields inside extra", async () => {
  const u = userEvent.setup();
  mount("/admin/customers/create");
  await u.type(await screen.findByRole("textbox", { name: /Tên khách/ }), "Customer with fields");
  await u.type(screen.getByLabelText("Người đại diện"), "Người thử");
  await u.type(screen.getByLabelText("Khu vực thử"), "Miền thử");
  await u.clear(screen.getByLabelText("Điểm thử"));
  await u.type(screen.getByLabelText("Điểm thử"), "7");
  await u.click(screen.getByRole("checkbox", { name: "Ưu tiên thử" }));
  await u.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await screen.findByRole("heading", { name: "Customers destination" });
  const created = (await fixture.store.list("customers")).find(
    (c) => c.name === "Customer with fields",
  )!;
  expect(created).toMatchObject({
    representative: "Người thử",
    extra: { region: "Miền thử", points: 7, priority: true },
  });
  expect(Object.keys(created).filter((key) => key.startsWith("extra_"))).toEqual([]);
});

it("loads and edits typed extra values without losing undeclared stored keys", async () => {
  const stored = (await fixture.store.get("customers", fixture.customerId))!;
  await fixture.store.transaction(["customers"], async (tx) =>
    tx.put("customers", {
      ...stored,
      representative: "Existing representative",
      extra: { region: "Old", points: 0, priority: false, legacy: "Keep me" },
    }),
  );
  mount(`/admin/customers/${stored.id}/edit`);
  expect(await screen.findByLabelText("Người đại diện")).toHaveValue("Existing representative");
  expect(screen.getByLabelText("Điểm thử")).toHaveValue(0);
  expect(screen.getByLabelText("Ưu tiên thử")).not.toBeChecked();
  const u = userEvent.setup();
  await u.clear(screen.getByLabelText("Khu vực thử"));
  await u.type(screen.getByLabelText("Khu vực thử"), "New");
  await u.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(async () =>
    expect((await fixture.store.get("customers", stored.id))?.extra).toEqual({
      region: "New",
      points: 0,
      priority: false,
      legacy: "Keep me",
    }),
  );
});

it("detail displays representative, configured labels and honest zero/false values", async () => {
  const stored = (await fixture.store.get("customers", fixture.customerId))!;
  await fixture.store.transaction(["customers"], async (tx) =>
    tx.put("customers", {
      ...stored,
      representative: "Detail representative",
      extra: { region: "Visible region", points: 0, priority: false },
    }),
  );
  mount(`/admin/customers/${stored.id}`);
  expect(await screen.findByText("Detail representative")).toBeInTheDocument();
  expect(screen.getByText("Visible region")).toBeInTheDocument();
  expect(screen.getByText("Điểm thử").nextElementSibling).toHaveTextContent("0");
  expect(screen.getByText("Ưu tiên thử").nextElementSibling).toHaveTextContent("Không");
});

it("detail uses placeholders for absent customer fields", async () => {
  mount(`/admin/customers/${fixture.customerId}`);
  const representative = await screen.findByText("Người đại diện");
  expect(representative.nextElementSibling).toHaveTextContent("—");
  for (const label of ["Khu vực thử", "Điểm thử", "Ưu tiên thử"])
    expect(screen.getByText(label).nextElementSibling).toHaveTextContent("—");
});

it("the customer config contract accepts an empty site and rejects unsafe or duplicate field keys", async () => {
  const { defineCustomers } = await import("../../src/platform/site-contract");
  expect(defineCustomers({ extraFields: [] })).toEqual({ extraFields: [] });
  expect(() =>
    defineCustomers({ extraFields: [{ key: "a.b", label: "Bad", type: "text" }] }),
  ).toThrow();
  expect(() =>
    defineCustomers({
      extraFields: [
        { key: "same", label: "First", type: "text" },
        { key: "same", label: "Second", type: "number" },
      ],
    }),
  ).toThrow();
});
