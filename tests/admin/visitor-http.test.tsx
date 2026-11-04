import { expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "../../src/features/admin/services/context";
import { createHttpAuthService } from "../../src/features/admin/accounts/auth/http-service";
import { createAdminHttp } from "../../src/lib/admin-http";
import Visitors from "../../src/features/admin/analytics/pages/visitors";
import { profile, grant, json, immediateLock } from "./helpers/http-client";
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useBlocker: () => ({ status: "idle" }),
  Link: ({ children }: React.PropsWithChildren) => <a>{children}</a>,
}));
test("visitor page displays API data and product interests without fixture timelines or mutation controls", async () => {
  localStorage.clear();
  const v = {
    id: "server-visitor",
    anonymousId: "KH-123",
    ipAddress: "192.0.2.0/24",
    country: null,
    city: null,
    deviceType: "mobile",
    operatingSystem: "Android",
    browser: "Chrome",
    firstSeenAt: "2026-11-04T00:00:00Z",
    lastSeenAt: "2026-11-04T00:00:00Z",
    sessionCount: 1,
    distinctPageCount: 1,
  };
  const paths: string[] = [];
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) => {
      const url = new URL(String(input));
      paths.push(url.pathname + url.search);
      if (url.pathname.endsWith("refresh")) return json(grant("memory-user"));
      if (url.pathname.endsWith("profile")) return json(profile);
      if (url.pathname.endsWith("filter-options"))
        return json({
          deviceTypes: ["mobile"],
          browsers: ["Chrome"],
          operatingSystems: ["Android"],
          products: [{ slug: "a", name: "Sổ máy chủ" }],
        });
      if (url.pathname.endsWith("report"))
        return json({
          totalVisitors: 1,
          totalSessions: 1,
          products: [{ slug: "a", name: "Sổ máy chủ", interestedVisitors: 1 }],
        });
      if (url.pathname.endsWith("sessions"))
        return json({
          items: [
            {
              id: "server-session",
              visitorId: v.id,
              startedAt: v.firstSeenAt,
              lastReceivedAt: v.lastSeenAt,
              landingPath: "/products/a",
              lastReceivedPath: "/products/a",
              distinctPageCount: 1,
              truncated: true,
              pages: [
                {
                  path: "/products/a",
                  firstReceivedAt: v.firstSeenAt,
                  lastReceivedAt: v.lastSeenAt,
                },
              ],
              products: [
                {
                  slug: "a",
                  name: "Sổ máy chủ",
                  firstReceivedAt: v.firstSeenAt,
                  lastReceivedAt: v.lastSeenAt,
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      if (url.pathname.endsWith(v.id)) return json(v);
      return json({ items: [v], total: 1, page: 1, pageSize: 20 });
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
  expect((await screen.findAllByText("KH-123")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Chưa xác định").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /Xóa|Thêm mới/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Sản phẩm quan tâm"), { target: { value: "a" } });
  await vi.waitFor(() => expect(paths.some((path) => path.includes("product=a"))).toBe(true));
  fireEvent.click((await screen.findAllByRole("button", { name: "Xem KH-123" }))[0]);
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("Sổ máy chủ")).toBeInTheDocument();
  expect(within(dialog).getByText("Trang ghi nhận gần nhất")).toBeInTheDocument();
  expect(within(dialog).getByText(/Đã đạt giới hạn/)).toBeInTheDocument();
  expect(within(dialog).queryByText(/Chưa kết thúc|lượt xem|phút/)).not.toBeInTheDocument();
  view.unmount();
  query.clear();
});
