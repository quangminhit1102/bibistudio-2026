import { fixtureAuthFactory } from "./helpers/fixture-auth";
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
import { HeaderNotifications } from "../../src/features/admin/notifications/header-menu";
import * as service from "../../src/features/admin/notifications/service";
import { businessFixture } from "./business-fixtures";
import { ensureDataset } from "../../src/features/admin/demo/registry";
let f: Awaited<ReturnType<typeof businessFixture>>, client: QueryClient;
beforeEach(async () => {
  f = await businessFixture("bibi-admin-demo");
  await ensureDataset(f.store, "notifications");
  localStorage.setItem("bibi-admin:session", JSON.stringify({ version: 2, session: f.session }));
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(async () => {
  cleanup();
  client.clear();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await f.store.destroy();
});
function mount() {
  const root = createRootRoute({
    component: () => (
      <>
        <HeaderNotifications />
        <Outlet />
      </>
    ),
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/admin/test",
    component: () => <h1>Workspace</h1>,
  });
  const target = createRoute({
    getParentRoute: () => root,
    path: "/admin/dashboard",
    component: () => <h1>Destination</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([home, target]),
    history: createMemoryHistory({ initialEntries: ["/admin/test"] }),
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
it("optimistically reads beside the bell then rolls back badge and row on failed persistence", async () => {
  let fail!: (error: Error) => void;
  vi.spyOn(service, "markNotificationsRead").mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  const router = mount(),
    u = userEvent.setup();
  await u.click(await screen.findByRole("button", { name: "Thông báo (3 chưa đọc)" }));
  await screen.findByRole("dialog", { name: "Thông báo", exact: true });
  expect(screen.queryByRole("link", { name: "Tất cả thông báo" })).not.toBeInTheDocument();
  await u.click(
    screen.getByRole("button", { name: "Chưa đọc: Chào mừng đến BiBi Admin", exact: true }),
  );
  expect(await screen.findByRole("button", { name: "Thông báo (2 chưa đọc)" })).toBeInTheDocument();
  expect(
    screen.getAllByRole("button", { name: "Đã đọc: Chào mừng đến BiBi Admin", exact: true })[0],
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/test");
  await act(async () => {
    fail(new Error("Không đủ dung lượng"));
  });
  expect(await screen.findByText("Không đủ dung lượng")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Thông báo (3 chưa đọc)" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Chưa đọc: Chào mừng đến BiBi Admin", exact: true }),
  ).toBeInTheDocument();
});
it("only navigates after persistence and no-link notifications keep the popup open", async () => {
  const note = (await f.store.get("notifications", "notification-1"))!;
  await f.store.transaction(["notifications"], (tx) =>
    tx.put("notifications", { ...note, href: "" }),
  );
  const router = mount(),
    u = userEvent.setup();
  await u.click(await screen.findByRole("button", { name: "Thông báo (3 chưa đọc)" }));
  await u.click(
    await screen.findByRole("button", { name: "Chưa đọc: Chào mừng đến BiBi Admin", exact: true }),
  );
  await screen.findByRole("button", { name: "Thông báo (2 chưa đọc)" });
  expect(screen.getByRole("dialog", { name: "Thông báo", exact: true })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/test");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Chưa đọc: Báo cáo đã sẵn sàng", exact: true }),
    ).toBeEnabled(),
  );
  await u.click(screen.getByRole("button", { name: "Chưa đọc: Báo cáo đã sẵn sàng", exact: true }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/admin/dashboard"));
  expect(screen.queryByRole("dialog", { name: "Thông báo", exact: true })).not.toBeInTheDocument();
});
it("does not restore old-user cache after a pending failure and a session switch", async () => {
  let fail!: (error: Error) => void;
  vi.spyOn(service, "markNotificationsRead").mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  mount();
  const u = userEvent.setup();
  await u.click(await screen.findByRole("button", { name: "Thông báo (3 chưa đọc)" }));
  await u.click(
    await screen.findByRole("button", { name: "Chưa đọc: Chào mừng đến BiBi Admin", exact: true }),
  );
  await screen.findByRole("button", { name: "Thông báo (2 chưa đọc)" });
  await act(async () => {
    const next = JSON.stringify({ version: 2, session: { userId: "user-4", roleId: "viewer" } });
    localStorage.setItem("bibi-admin:session", next);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "bibi-admin:session", newValue: next }),
    );
  });
  await screen.findByRole("button", { name: "Thông báo (3 chưa đọc)" });
  await act(async () => {
    fail(new Error("Old failure"));
  });
  expect(client.getQueryData(["bibi-admin", "notifications", "user-1"])).toBeUndefined();
  expect(screen.getByRole("button", { name: "Thông báo (3 chưa đọc)" })).toBeInTheDocument();
});
