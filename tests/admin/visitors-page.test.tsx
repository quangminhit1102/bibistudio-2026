import { fixtureAuthFactory } from "./helpers/fixture-auth";
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
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
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { businessFixture } from "./business-fixtures";
import Visitors from "../../src/features/admin/analytics/pages/visitors";
import {
  listVisitorSessions,
  knownViewedProducts,
} from "../../src/features/admin/analytics/visitor-service";
let f: Awaited<ReturnType<typeof businessFixture>>, client: QueryClient;
beforeEach(async () => {
  f = await businessFixture("bibi-admin-demo");
  await ensureDataset(f.store, "visitors");
  localStorage.setItem("bibi-admin:session", JSON.stringify({ version: 2, session: f.session }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  cleanup();
  client.clear();
  localStorage.clear();
  await f.store.destroy();
});
function mount(entry = "/admin/analytics/visitors") {
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({
    getParentRoute: () => root,
    path: "/admin/analytics/visitors",
    component: Visitors,
  });
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(
    <QueryClientProvider client={client}>
      <AdminProvider authFactory={fixtureAuthFactory}>
        <RouterProvider router={router} />
      </AdminProvider>
    </QueryClientProvider>,
  );
  return router;
}
it("shows requested fields and opens same-page detail from a mobile card then closes with Escape", async () => {
  const router = mount(),
    u = userEvent.setup();
  await screen.findByRole("columnheader", { name: "IP" });
  expect(screen.getByRole("columnheader", { name: "Thiết bị–Hệ điều hành" })).toBeInTheDocument();
  await u.click(await screen.findByRole("link", { name: "Xem thông tin VIS-001", exact: true }));
  expect(
    await screen.findByRole("dialog", { name: "Chi tiết khách truy cập" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/analytics/visitors");
  expect(router.state.location.search).toMatchObject({ visitor: "visitor-1" });
  await u.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(router.state.location.search.visitor).toBeUndefined();
  await u.click(screen.getByRole("link", { name: "Xem thông tin VIS-001", exact: true }));
  await screen.findByRole("dialog", { name: "Chi tiết khách truy cập" });
  await act(async () => {
    router.history.back();
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("pages 250 sessions by visitor before pagination and deduplicates only real product paths", async () => {
  const base = (await f.store.list("sessions"))[0],
    v = (await f.store.get("visitors", "visitor-1"))!;
  await f.store.transaction(["visitors", "sessions"], async (tx) => {
    await tx.put("visitors", {
      ...v,
      id: "visitor-large",
      anonymousId: "demo-large",
      sessionCount: 250,
    });
    for (let i = 0; i < 250; i++)
      await tx.put("sessions", {
        ...base,
        id: `large-${i}`,
        visitorId: "visitor-large",
        pages: [
          { path: "/products/da-lat-map-notebook", at: base.startedAt },
          { path: "/products/da-lat-map-notebook?view=2", at: base.startedAt },
          { path: "/products/not-a-product", at: base.startedAt },
        ],
      });
  });
  const result = await listVisitorSessions(f.store, f.session, "visitor-large", {
    page: 2,
    pageSize: 100,
    filters: { visitorId: "visitor-2" },
  });
  expect(result.total).toBe(250);
  expect(result.items).toHaveLength(100);
  expect(result.items.every((s) => s.visitorId === "visitor-large")).toBe(true);
  expect(knownViewedProducts(result.items).map((p) => p.slug)).toEqual(["da-lat-map-notebook"]);
  await expect(
    listVisitorSessions(f.store, { userId: "user-3", roleId: "editor" }, "visitor-large", {
      page: 1,
      pageSize: 10,
    }),
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("invalid visitor detail is recoverable and does not break the list", async () => {
  mount("/admin/analytics/visitors?visitor=missing");
  const u = userEvent.setup();
  await screen.findByRole("dialog", { name: "Chi tiết khách truy cập" });
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: "Đóng", exact: true }));
  expect(
    await screen.findByRole("heading", { name: "Khách truy cập", exact: true }),
  ).toBeInTheDocument();
  await u.click(await screen.findByRole("link", { name: "Xem thông tin VIS-001", exact: true }));
  expect(
    await screen.findByRole("dialog", { name: "Chi tiết khách truy cập" }),
  ).toBeInTheDocument();
});
