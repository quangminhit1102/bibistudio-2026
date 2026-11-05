import { expect, test, vi } from "vitest";
import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import Visitors from "../../src/features/admin/analytics/pages/visitors";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
const routing = vi.hoisted(() => ({ search: {} as Record<string, string>, navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routing.navigate,
  useSearch: () => routing.search,
  useBlocker: () => ({ status: "idle" }),
  Link: ({ children }: React.PropsWithChildren) => <a>{children}</a>,
}));
function mount({ fail = false, empty = false, pending = false } = {}) {
  localStorage.clear();
  const paths: string[] = [];
  const row = {
    id: "a".repeat(64),
    sourceId: "source",
    ordinal: 1,
    occurredAt: null,
    method: null,
    pathname: "/<script>alert(1)</script>",
    status: null,
    bytes: null,
    ipPrefix: null,
    deviceType: null,
    operatingSystem: null,
    browser: null,
    resourceKind: "other",
    isBot: false,
    referrer: null,
    parseStatus: "error",
    errorCode: "INVALID_LINE",
  };
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      const url = new URL(String(input));
      paths.push(url.pathname + url.search);
      if (url.pathname.endsWith("refresh")) return json(grant("memory-user"));
      if (url.pathname.endsWith("profile")) return json(profile);
      if (url.pathname.includes("access-logs")) {
        if (fail)
          return json(
            { error: { code: "ACCESS_LOGS_NOT_READY", message: "Nhật ký cPanel chưa sẵn sàng" } },
            503,
          );
        if (url.pathname.endsWith("status"))
          return json({
            state: pending ? "pending" : "complete",
            total: empty ? 0 : 1205,
            parseErrors: 1,
            earliest: null,
            latest: null,
            lastSyncAt: "2026-11-05T00:00:00Z",
            lastSuccessAt: null,
            sourceThrough: null,
            stale: true,
            ipTrusted: false,
            timezone: "UTC",
            sources: [],
          });
        if (url.pathname.endsWith(row.id)) return json(row);
        return json({
          items: empty ? [] : [row],
          total: empty ? 0 : 1205,
          page: Number(url.searchParams.get("page") || 1),
          pageSize: 20,
        });
      }
      if (url.pathname.endsWith("report"))
        return json({ products: [], totalVisitors: 0, totalSessions: 0 });
      if (url.pathname.endsWith("filter-options"))
        return json({ deviceTypes: [], browsers: [], products: [] });
      return json({ items: [], total: 0, page: 1, pageSize: 20 });
    },
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={query}>
      <AdminProvider authFactory={() => createHttpAuthService({ client })}>
        <Visitors />
      </AdminProvider>
    </QueryClientProvider>,
  );
  return { paths, view };
}
test("default log mode pages full history, keeps filters, safely renders text and opens parse marker details", async () => {
  routing.search = {};
  const f = mount({ pending: true });
  expect((await screen.findAllByText(/1.205 bản ghi|1205 bản ghi/)).length).toBeGreaterThan(0);
  expect(screen.getByText("Đồng bộ hằng ngày")).toBeInTheDocument();
  expect(screen.getByText(/Chưa đồng bộ đủ/)).toBeInTheDocument();
  expect(screen.getByText(/Quá 36 giờ/)).toBeInTheDocument();
  expect(document.querySelector("script")).toBeNull();
  fireEvent.change(screen.getByLabelText("Từ ngày (UTC)"), { target: { value: "2026-11-01" } });
  await vi.waitFor(() =>
    expect(f.paths.some((path) => path.includes("from=2026-11-01"))).toBe(true),
  );
  await vi.waitFor(() => expect(screen.getByRole("button", { name: "Trang sau" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await vi.waitFor(() =>
    expect(
      f.paths.some((path) => path.includes("page=2") && path.includes("from=2026-11-01")),
    ).toBe(true),
  );
  expect(
    within(screen.getByLabelText("Số dòng mỗi trang")).queryByRole("option", {
      name: "10",
      exact: true,
    }),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Số dòng mỗi trang"), { target: { value: "100" } });
  await vi.waitFor(() => expect(f.paths.some((path) => path.includes("pageSize=100"))).toBe(true));
  fireEvent.click((await screen.findAllByRole("button", { name: /Xem bản ghi/ }))[0]);
  expect(
    await within(await screen.findByRole("dialog")).findByText("INVALID_LINE"),
  ).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Khách và sản phẩm" }));
  expect(routing.navigate).toHaveBeenCalledWith(
    expect.objectContaining({ search: expect.objectContaining({ view: "visitors" }) }),
  );
});
test("source503 is an error, not empty history; successful empty history is distinct", async () => {
  routing.search = {};
  mount({ fail: true });
  expect((await screen.findAllByText("Nhật ký cPanel chưa sẵn sàng")).length).toBeGreaterThan(0);
  expect(screen.queryByText("Chưa có dữ liệu")).not.toBeInTheDocument();
  cleanup();
  mount({ empty: true });
  expect((await screen.findAllByText("0 bản ghi")).length).toBeGreaterThan(0);
});
test("legacy visitor deep link selects original tracker rather than logs", async () => {
  routing.search = { visitor: "old-id" };
  const f = mount();
  expect(await screen.findByText("Sản phẩm được quan tâm")).toBeInTheDocument();
  expect(f.paths.some((path) => path.includes("access-logs"))).toBe(false);
});
