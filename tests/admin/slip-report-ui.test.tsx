import { fixtureAuthFactory } from "./helpers/fixture-auth";
import { afterEach, expect, it, vi } from "vitest";
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
import { businessFixture } from "./business-fixtures";
import { AdminProvider } from "../../src/features/admin/services/context";
import Reports from "../../src/features/admin/sales/pages/reports";
import { createSlipService } from "../../src/features/admin/sales/slip-service";
import { vietnamYear } from "../../src/features/admin/sales/slip-aggregate";
vi.mock("../../src/features/admin/shared/charts/chart", () => ({
  default: ({ label, data }: { label: string; data: { name: string; value: number }[] }) => (
    <figure aria-label={label}>
      {data.map((d) => (
        <span key={d.name}>
          {d.name}: {d.value}
        </span>
      ))}
    </figure>
  ),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it("falls back to the current year for a malformed URL without NaN totals", async () => {
  const f = await businessFixture("bibi-admin-demo");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.setItem("bibi-admin:session", JSON.stringify({ version: 2, session: f.session }));
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({
    getParentRoute: () => root,
    path: "/admin/sales/reports",
    component: Reports,
  });
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ["/admin/sales/reports?year=not-a-year"] }),
  });
  try {
    render(
      <QueryClientProvider client={client}>
        <AdminProvider authFactory={fixtureAuthFactory}>
          <RouterProvider router={router} />
        </AdminProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("combobox", { name: "Năm" })).toHaveValue(String(vietnamYear()));
    await screen.findByRole("status", { name: "Tổng doanh thu ghi nhận" });
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  } finally {
    cleanup();
    client.clear();
    await f.store.destroy();
  }
});
it("shares year/customer filters across full totals charts tables and CSV", async () => {
  const f = await businessFixture("bibi-admin-demo"),
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const service = createSlipService(
      f.store,
      () => f.session,
      () => new Date("2027-02-01T00:00:00Z"),
    );
    await service.create({
      customerId: "customer-1",
      vatApplied: false,
      notes: "",
      items: [{ lineId: "a", productId: "product-1", quantity: 2, unitPrice: 10000 }],
    });
    await service.create({
      customerId: "customer-2",
      vatApplied: true,
      notes: "",
      items: [{ lineId: "b", productId: "product-2", quantity: 3, unitPrice: 5000 }],
    });
    localStorage.setItem("bibi-admin:session", JSON.stringify({ version: 2, session: f.session }));
    const root = createRootRoute({ component: Outlet });
    const report = createRoute({
      getParentRoute: () => root,
      path: "/admin/sales/reports",
      component: Reports,
    });
    const router = createRouter({
      routeTree: root.addChildren([report]),
      history: createMemoryHistory({ initialEntries: ["/admin/sales/reports?year=2027"] }),
    });
    render(
      <QueryClientProvider client={client}>
        <AdminProvider authFactory={fixtureAuthFactory}>
          <RouterProvider router={router} />
        </AdminProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("combobox", { name: "Năm" })).toHaveValue("2027");
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Tổng doanh thu ghi nhận" })).toHaveTextContent(
        /35\.000\s*₫/,
      ),
    );
    const u = userEvent.setup();
    await u.selectOptions(screen.getByRole("combobox", { name: "Khách mua hàng" }), "customer-1");
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ year: 2027, customerId: "customer-1" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Tổng doanh thu ghi nhận" })).toHaveTextContent(
        /20\.000\s*₫/,
      ),
    );
    expect(screen.getByRole("heading", { name: "Tổng kết sản phẩm" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Chỉ tiêu sản phẩm" })).toHaveValue("quantity");
    await u.selectOptions(screen.getByRole("combobox", { name: "Chỉ tiêu sản phẩm" }), "value");
    expect(screen.getByRole("combobox", { name: "Chỉ tiêu sản phẩm" })).toHaveValue("value");
  } finally {
    cleanup();
    client.clear();
    await f.store.destroy();
  }
});
