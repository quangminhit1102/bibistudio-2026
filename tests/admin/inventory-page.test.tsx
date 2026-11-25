import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminStore } from "../../src/features/admin/services/contracts";
import { AdminProvider } from "../../src/features/admin/services/context";
import { InventoryPage } from "../../src/features/admin/shared/inventory-page";
import { NoticeProvider } from "../../src/features/admin/shared/ui/primitives";
import { createAdminHttp } from "../../src/lib/admin-http";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { fixtureAuthFactory } from "./helpers/fixture-auth";
import { businessFixture } from "./business-fixtures";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
import { inventoryModule } from "../../src/features/admin/products/module";
import Dashboard from "../../src/features/admin/dashboard/pages/dashboard";
import { loadDashboard } from "../../src/features/admin/dashboard/service";
import { presetRange } from "../../src/features/admin/analytics/aggregate";

const runtime = vi.hoisted(() => ({ store: undefined as AdminStore | undefined }));
let dashboardReport: Awaited<ReturnType<typeof loadDashboard>>;
vi.mock("../../src/features/admin/analytics/hooks", () => ({
  useAnalytics: () => ({ data: dashboardReport }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock("../../src/features/admin/demo/store", async (original) => {
  const actual = await original<typeof import("../../src/features/admin/demo/store")>();
  return {
    ...actual,
    createAdminStore: (...args: Parameters<typeof actual.createAdminStore>) =>
      runtime.store ?? actual.createAdminStore(...args),
  };
});
let f: Awaited<ReturnType<typeof businessFixture>>;
let query: QueryClient;
let calls: { path: string; method: string; body?: unknown }[];
let failure: number;
beforeEach(async () => {
  localStorage.clear();
  f = await businessFixture("inventory-page");
  runtime.store = f.store;
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  calls = [];
  failure = 0;
});
afterEach(async () => {
  cleanup();
  query.clear();
  runtime.store = undefined;
  localStorage.clear();
  await f.store.destroy();
});
function mount(
  server = true,
  writable = true,
  entity: "products" | "books" = "products",
  empty = false,
  dashboard = false,
) {
  let product = { id: "server-product", name: "Sổ kiểm kê", stock: 10, reserved: 3, revision: 1 };
  let movements: Record<string, unknown>[] = [];
  const principal = {
    ...profile,
    permissions: ["product.view", ...(writable ? ["product.update"] : [])],
  };
  const http = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path: url.pathname + url.search, method, body });
      if (url.pathname.endsWith("refresh"))
        return json({ ...grant("inventory-token"), profile: principal });
      if (url.pathname.endsWith("profile")) return json(principal);
      if (method === "POST") {
        if (failure)
          return json(
            {
              error: {
                code: failure === 409 ? "REVISION_CONFLICT" : "VALIDATION_ERROR",
                message:
                  failure === 409 ? "Tồn kho đã thay đổi" : "Không được thấp hơn lượng đang giữ",
              },
            },
            failure,
          );
        const before = product.stock;
        product = { ...product, stock: before + body.delta, revision: product.revision + 1 };
        movements = [
          {
            id: "move-1",
            productId: product.id,
            productName: product.name,
            delta: body.delta,
            stockBefore: before,
            stockAfter: product.stock,
            reason: body.reason,
            actorName: "Người kiểm kê",
            createdAt: "2026-11-25T08:30:00Z",
          },
        ];
        return json(product);
      }
      const history = url.pathname === "/api/stock-movements";
      const items = history ? movements : empty ? [] : [product];
      return json({
        items,
        total: history && url.searchParams.get("productId") ? 31 : items.length,
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: 30,
      });
    },
  });
  if (!server)
    localStorage.setItem("bibi-admin:session", JSON.stringify({ version: 2, session: f.session }));
  render(
    <QueryClientProvider client={query}>
      <AdminProvider
        authFactory={server ? () => createHttpAuthService({ client: http }) : fixtureAuthFactory}
      >
        <NoticeProvider>
          {dashboard ? <Dashboard /> : <InventoryPage entity={entity} />}
        </NoticeProvider>
      </AdminProvider>
    </QueryClientProvider>,
  );
}
async function edit() {
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Điều chỉnh thủ công" })[0]).toBeEnabled(),
  );
  const button = screen.getAllByRole("button", { name: "Điều chỉnh thủ công" })[0];
  await userEvent.setup().click(button);
  expect(button.isConnected).toBe(true);
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "2" } });
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Kiểm đếm" } });
  return dialog;
}
it("shows three inventory columns and sends an adjustment to the server, refreshing stock and named history", async () => {
  mount();
  await screen.findByRole("button", { name: "Điều chỉnh thủ công" });
  const table = screen.getAllByRole("table")[0];
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent),
  ).toEqual(["Sản phẩm", "Số lượng tồn", ""]);
  const dialog = await edit();
  expect(within(dialog).getByText("Tồn sau điều chỉnh: 12")).toBeInTheDocument();
  await userEvent.setup().click(within(dialog).getByRole("button", { name: "Lưu điều chỉnh" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(calls.find((c) => c.path.endsWith("/stock-adjustments"))).toEqual({
    path: "/api/products/server-product/stock-adjustments",
    method: "POST",
    body: { delta: 2, reason: "Kiểm đếm", revision: 1 },
  });
  expect(within(table).getByText("12")).toBeInTheDocument();
  expect(await screen.findByText("Người kiểm kê")).toBeInTheDocument();
  expect(screen.getByText("10 → 12")).toBeInTheDocument();
  expect(screen.getByText("+2")).toBeInTheDocument();
  expect(screen.getByText("Kiểm đếm")).toBeInTheDocument();
  expect(calls.filter((c) => c.path.startsWith("/api/stock-movements")).length).toBeGreaterThan(1);
  expect(await f.store.list("stock")).toEqual([]);
  fireEvent.change(screen.getByLabelText("Lọc lịch sử theo sản phẩm"), {
    target: { value: "server-product" },
  });
  await waitFor(() =>
    expect(calls.some((c) => c.path.includes("productId=server-product"))).toBe(true),
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Lịch sử tiếp" }));
  await waitFor(() =>
    expect(
      calls.some((c) => c.path.includes("page=2") && c.path.includes("productId=server-product")),
    ).toBe(true),
  );
});
it.each([400, 409])("keeps the dialog open and shows the server %s message", async (status) => {
  failure = status;
  mount();
  const dialog = await edit();
  await userEvent.setup().click(within(dialog).getByRole("button", { name: "Lưu điều chỉnh" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    status === 409 ? "Tồn kho đã thay đổi" : "Không được thấp hơn lượng đang giữ",
  );
  expect(await f.store.list("stock")).toEqual([]);
});
it("lets viewers read stock/history but disables adjustment and exposes inventory in HTTP mode", async () => {
  mount(true, false);
  expect(await screen.findByRole("button", { name: "Điều chỉnh thủ công" })).toBeDisabled();
  expect(inventoryModule.browserOnly).not.toBe(true);
  expect(await screen.findByText("Chưa có điều chỉnh trong dữ liệu này.")).toBeInTheDocument();
});
it("shows a valid empty state for server inventory", async () => {
  mount(true, true, "products", true);
  expect(await screen.findByText("Chưa có điều chỉnh trong dữ liệu này.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Điều chỉnh thủ công" })).not.toBeInTheDocument();
});
it.each(["products", "books"] as const)(
  "keeps %s adjustments and history in the browser store",
  async (entity) => {
    await ensureDataset(f.store, entity);
    const records = await f.store.list(entity);
    const before = records[0];
    mount(false, true, entity);
    const dialog = await edit();
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Lưu điều chỉnh" }));
    await waitFor(async () =>
      expect((await f.store.get(entity, before.id))?.stock).toBe(before.stock + 2),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Kiểm đếm")).toBeInTheDocument();
    expect((await f.store.list("stock"))[0].entity).toBe(entity);
    expect(calls).toEqual([]);
  },
);
it("counts low-stock dashboard products using stock, not stock minus reserved", async () => {
  await ensureDataset(f.store, "products");
  const products = await f.store.list("products");
  await f.store.transaction(["products"], async (tx) => {
    await tx.put("products", {
      ...products[0],
      name: "Giữ nhiều nhưng đủ tồn",
      stock: 40,
      reserved: 39,
    });
    await tx.put("products", { ...products[1], name: "Cần nhập thêm", stock: 4, reserved: 3 });
  });
  dashboardReport = await loadDashboard(f.store, f.session, presetRange("30"));
  mount(false, true, "products", false, true);
  expect(await screen.findByText("Cần nhập thêm")).toBeInTheDocument();
  expect(screen.queryByText("Giữ nhiều nhưng đủ tồn")).not.toBeInTheDocument();
  expect(screen.getByText("4 tồn")).toBeInTheDocument();
});
