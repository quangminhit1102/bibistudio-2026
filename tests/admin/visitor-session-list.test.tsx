import { expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VisitorSessionList } from "../../src/features/admin/analytics/components/visitor-session-list";
import type { VisitorSessionDto } from "../../backend/src/http/contracts";
const session = (id: string): VisitorSessionDto => ({
  id,
  visitorId: "visitor",
  startedAt: "2026-11-13T10:00:00Z",
  lastReceivedAt: "2026-11-13T10:20:00Z",
  landingPath: "/",
  lastReceivedPath: "/contact",
  distinctPageCount: 5,
  truncated: true,
  ipAddress: "8.8.8.8",
  ipStatus: "verified",
  deviceType: "mobile",
  operatingSystem: "Android",
  browser: "Chrome",
  pages: [
    "/contact",
    "/admin/accounts",
    "//evil.test",
    "/products/a?token=secret",
    "/api/auth/profile",
  ].map((path) => ({
    path,
    firstReceivedAt: "2026-11-13T10:01:00Z",
    lastReceivedAt: "2026-11-13T10:02:00Z",
  })),
  products: [
    {
      slug: "a",
      name: "Sổ Việt Nam",
      firstReceivedAt: "2026-11-13T10:01:00Z",
      lastReceivedAt: "2026-11-13T10:02:00Z",
    },
  ],
});
test("compact sessions expand safe recorded URLs and retain panels when more rows append", () => {
  const more = vi.fn();
  const view = render(<VisitorSessionList items={[session("one")]} hasMore onMore={more} />);
  const first = view.container.querySelector("details")!;
  expect(first).toHaveAttribute("open");
  expect(screen.getByRole("link", { name: "/contact" })).toHaveAttribute("href", "/contact");
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(screen.getByText(/Đã đạt giới hạn/)).toBeInTheDocument();
  expect(screen.queryByText("Phiên trước")).not.toBeInTheDocument();
  expect(screen.queryByText("Phiên sau")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Xem thêm phiên" }));
  expect(more).toHaveBeenCalledTimes(1);
  view.rerender(
    <VisitorSessionList items={[session("one"), session("two")]} hasMore={false} onMore={more} />,
  );
  expect(view.container.querySelectorAll("details")).toHaveLength(2);
  expect(first).toHaveAttribute("open");
  expect(screen.queryByRole("button", { name: "Xem thêm phiên" })).not.toBeInTheDocument();
});
test("failed incremental load keeps previous rows and offers retry", () => {
  const retry = vi.fn();
  render(
    <VisitorSessionList
      items={[session("one")]}
      hasMore
      onMore={retry}
      error={new Error("Không tải được")}
    />,
  );
  expect(screen.getAllByText("Sổ Việt Nam").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("empty products are explicit and session delete does not toggle its panel", () => {
  const onDelete = vi.fn();
  const item = { ...session("one"), products: [] };
  const view = render(
    <VisitorSessionList items={[item]} hasMore={false} onMore={() => {}} onDelete={onDelete} />,
  );
  expect(screen.getAllByText("Không ghi nhận")).toHaveLength(2);
  expect(screen.queryByText(/Cookie trình/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Xóa phiên/ }));
  expect(onDelete).toHaveBeenCalledWith(item);
  expect(view.container.querySelector("details")).toHaveAttribute("open");
});
