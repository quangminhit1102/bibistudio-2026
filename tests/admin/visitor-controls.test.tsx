import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { ServerVisitors } from "../../src/features/admin/analytics/server-visitors";
import { VisitorExclusions } from "../../src/features/admin/analytics/components/visitor-exclusions";
import { resolveVisitorWindow } from "../../backend/src/visitors/date-window";

const runtime = vi.hoisted(() => ({
  http: { request: vi.fn() },
  sessionLoading: false,
  session: {
    kind: "http",
    userId: "admin-test",
    principal: { fullAccess: false, permissions: [] as string[] },
  },
}));
vi.mock("../../src/features/admin/services/context", () => ({ useAdmin: () => runtime }));
vi.mock("@tanstack/react-router", () => ({ useSearch: () => ({}) }));
vi.mock("../../src/features/admin/shared/charts/chart", () => ({ default: () => <div /> }));
const visitors = ["a", "b"].map((id, i) => ({
  id,
  anonymousId: id,
  ipAddress: `8.8.8.${i + 1}`,
  ipStatus: "observed",
  country: null,
  deviceType: "desktop",
  operatingSystem: "Windows",
  browser: "Edge",
  firstSeenAt: "2026-11-21T01:00:00Z",
  lastSeenAt: "2026-11-21T01:05:00Z",
  sessionCount: 1,
  distinctPageCount: 1,
}));
beforeEach(() => {
  runtime.session.principal.permissions = ["customer_access.view"];
  runtime.http.request.mockReset();
  runtime.http.request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === "POST")
      return { deletedVisitors: 2, deletedSessions: 2, visitorDeleted: true };
    const url = new URL(path, "http://localhost");
    if (url.pathname.endsWith("filter-options"))
      return { deviceTypes: ["desktop"], browsers: ["Edge"], operatingSystems: [] };
    if (url.pathname.endsWith("report"))
      return {
        totalVisitors: 2,
        totalSessions: 2,
        totalInterestedVisitors: 0,
        totalProducts: 0,
        window: resolveVisitorWindow(
          { from: url.searchParams.get("from")!, to: url.searchParams.get("to")! },
          new Date(),
        ),
        bucketUnit: "day",
        series: [{ label: "21/11", startUtc: "2026-11-20T17:00:00Z", sessions: 2 }],
        products: [],
      };
    return { items: visitors, total: 2, page: 1, pageSize: 20 };
  });
});
function mount(children = <ServerVisitors />) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>,
  );
}
test("view-only visitors have neither deletion controls nor exclusion config", async () => {
  mount();
  await screen.findAllByText("8.8.8.1");
  expect(screen.queryByRole("button", { name: "Loại trừ IP" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Xóa khách/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
test("separate delete permission enables selection, confirmation and exact submitted IDs", async () => {
  runtime.session.principal.permissions.push("customer_access.delete");
  mount();
  await screen.findAllByText("8.8.8.1");
  expect(screen.queryByRole("button", { name: "Loại trừ IP" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn trang hiện tại" }));
  fireEvent.click(screen.getByRole("button", { name: "Xóa đã chọn" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/kể cả ngoài khoảng ngày/)).toBeInTheDocument();
  expect(runtime.http.request.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận" }));
  await vi.waitFor(() =>
    expect(runtime.http.request).toHaveBeenCalledWith("/api/customer-access/bulk-delete", {
      method: "POST",
      body: { ids: ["a", "b"] },
    }),
  );
});
test("changing date scope clears selected rows", async () => {
  runtime.session.principal.permissions.push("customer_access.delete");
  mount();
  await screen.findAllByText("8.8.8.1");
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn trang hiện tại" }));
  expect(screen.getByRole("button", { name: "Xóa đã chọn" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "6 tháng" }));
  expect(screen.queryByRole("button", { name: "Xóa đã chọn" })).not.toBeInTheDocument();
});
test("exclusion conflict preserves input and does not close editor", async () => {
  const close = vi.fn(),
    save = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Cấu hình đã thay đổi"), { code: "REVISION_CONFLICT" }),
      );
  const api = {
    exclusions: vi.fn().mockResolvedValue({ revision: 1, rules: ["8.8.8.*"] }),
    saveExclusions: save,
  };
  // This focused component consumes only these methods.
  mount(
    <VisitorExclusions
      api={api as Parameters<typeof VisitorExclusions>[0]["api"]}
      onClose={close}
    />,
  );
  const input = await screen.findByLabelText("Thêm quy tắc");
  fireEvent.change(input, { target: { value: "1.1.*.*" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
  await screen.findByRole("alert");
  expect(input).toHaveValue("1.1.*.*");
  expect(close).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledWith({ revision: 1, rules: ["8.8.8.*", "1.1.*.*"] });
  expect(screen.getByRole("button", { name: "Làm mới" })).toBeInTheDocument();
});

test("returning to an edited exclusions modal never replaces the draft with a background revision", async () => {
  focusManager.setFocused(false);
  const read = vi
    .fn()
    .mockResolvedValueOnce({ revision: 1, rules: [] })
    .mockResolvedValue({ revision: 2, rules: ["8.8.8.8"] });
  const api = { exclusions: read, saveExclusions: vi.fn() };
  mount(
    <VisitorExclusions
      api={api as Parameters<typeof VisitorExclusions>[0]["api"]}
      onClose={() => {}}
    />,
  );
  fireEvent.change(await screen.findByLabelText("Thêm quy tắc"), { target: { value: "1.1.*.*" } });
  focusManager.setFocused(true);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(read).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Thêm quy tắc")).toHaveValue("1.1.*.*");
  focusManager.setFocused(undefined);
});

test("mobile customer cards expose their own selection controls", async () => {
  runtime.session.principal.permissions.push("customer_access.delete");
  mount();
  await screen.findAllByText("8.8.8.1");
  const list = screen.getByRole("list");
  fireEvent.click(within(list).getByRole("checkbox", { name: "Chọn khách 8.8.8.1" }));
  expect(screen.getByText("Đã chọn 1 khách trên trang này")).toBeInTheDocument();
});

test("deleting last session on the final page returns to a valid visitor page", async () => {
  runtime.session.principal.permissions.push("customer_access.delete");
  const base = runtime.http.request.getMockImplementation()!;
  let deleted = false;
  runtime.http.request.mockImplementation(async (path: string, options?: { method?: string }) => {
    const url = new URL(path, "http://localhost");
    if (options?.method === "DELETE") {
      deleted = true;
      return { deletedVisitors: 1, deletedSessions: 1, visitorDeleted: true };
    }
    if (url.pathname.endsWith("session-history"))
      return {
        items: [
          {
            id: "session-a",
            visitorId: "a",
            startedAt: visitors[0].firstSeenAt,
            lastReceivedAt: visitors[0].lastSeenAt,
            products: [],
            pages: [],
            distinctPageCount: 0,
          },
        ],
        nextCursor: null,
      };
    if (url.pathname === "/api/customer-access/a") return visitors[0];
    if (url.pathname === "/api/customer-access")
      return {
        items: deleted && url.searchParams.get("page") === "2" ? [] : [visitors[0]],
        total: deleted ? 20 : 21,
        page: Number(url.searchParams.get("page")),
        pageSize: 20,
      };
    return base(path, options);
  });
  mount();
  await screen.findAllByText("8.8.8.1");
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await screen.findByText("Trang 2 / 2");
  fireEvent.click(await screen.findByRole("button", { name: "Chi tiết khách 21" }));
  const remove = await screen.findByRole("button", { name: /Xóa phiên/ });
  fireEvent.click(remove);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
  await screen.findByText("Trang 1 / 1");
  expect(screen.queryByText("Trang 2 / 1")).not.toBeInTheDocument();
});
