import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { legacyDestination } from "../../src/features/admin/shell/legacy-destination";
import { navigation } from "../../src/features/admin/shell/navigation";
it("has a flat product group with exactly four direct destinations", () => {
  const group = navigation.find((g) => g.label === "Quản lý sản phẩm")!;
  expect(group.items.map((i) => i.label)).toEqual([
    "Danh sách sản phẩm",
    "Thêm sản phẩm",
    "Danh mục",
    "Tồn kho",
  ]);
  expect(group.items.every((i) => !i.children)).toBe(true);
});
import { searchAdmin } from "../../src/features/admin/shell/search-service";
import { businessFixture } from "./business-fixtures";
it("exposes only the new business destinations", () => {
  const items = navigation.flatMap((g) => g.items),
    text = JSON.stringify(items);
  for (const label of ["Khách truy cập", "Khách mua hàng", "Phiếu mua hàng", "Báo cáo"])
    expect(items.some((i) => i.label === label)).toBe(true);
  for (const path of [
    "/admin/bookstore",
    "/admin/sales/orders",
    "/admin/sales/transactions",
    "/admin/notifications",
    "/admin/analytics/sessions",
  ])
    expect(text).not.toContain(path);
});
it("maps every old deep route without forwarding unrelated record IDs", () => {
  for (const p of [
    "/admin/bookstore",
    "/admin/bookstore/books",
    "/admin/bookstore/books/create",
    "/admin/bookstore/books/book-1",
    "/admin/bookstore/books/book-1/edit",
    "/admin/bookstore/authors",
    "/admin/bookstore/publishers",
    "/admin/bookstore/genres",
    "/admin/bookstore/inventory",
  ])
    expect(legacyDestination(p)).toEqual({ to: "/admin/customers" });
  for (const p of [
    "/admin/sales",
    "/admin/sales/orders",
    "/admin/sales/orders/order-1",
    "/admin/sales/order-history",
    "/admin/sales/transactions",
  ])
    expect(legacyDestination(p)).toEqual({ to: "/admin/sales/slips" });
  expect(legacyDestination("/admin/notifications")).toEqual({ to: "/admin/dashboard" });
  expect(legacyDestination("/admin/analytics/visitors/visitor-1")).toEqual({
    to: "/admin/analytics/visitors",
    search: { visitor: "visitor-1" },
  });
  expect(legacyDestination("/admin/sales/reports")).toBeNull();
  expect(legacyDestination("/administrator")).toBeNull();
});
it("keeps aliases as redirect-only route adapters", () => {
  for (const name of [
    "sales.index",
    "sales.orders",
    "sales.orders.$id",
    "sales.order-history",
    "sales.transactions",
    "bookstore.index",
    "bookstore.books",
    "bookstore.books.create",
    "bookstore.books.$id",
    "bookstore.books.$id.edit",
    "bookstore.authors",
    "bookstore.publishers",
    "bookstore.genres",
    "bookstore.inventory",
    "notifications",
  ]) {
    const source = readFileSync(`src/routes/admin.${name}.tsx`, "utf8");
    expect(source).toContain("redirect(");
    expect(source).toContain("replace: true");
    expect(source).not.toContain("lazyRouteComponent");
  }
});
it("searches customers and slip numbers with permission filtering and no legacy seed", async () => {
  const f = await businessFixture("business-search");
  try {
    const customers = await searchAdmin(f.store, f.session, "customer");
    expect(customers.some((r) => r.entity === "customers")).toBe(true);
    const slips = await searchAdmin(f.store, f.session, "PMH");
    expect(
      slips.some(
        (r) =>
          r.entity === "purchaseSlips" &&
          r.path.startsWith("/admin/sales/slips/") &&
          r.label.startsWith("PMH"),
      ),
    ).toBe(true);
    const editor = { userId: "user-3", roleId: "editor" };
    expect(
      (await searchAdmin(f.store, editor, "PMH")).some((r) => r.entity === "purchaseSlips"),
    ).toBe(false);
    expect(await f.store.list("books")).toHaveLength(0);
    expect(await f.store.list("orders")).toHaveLength(0);
  } finally {
    await f.store.destroy();
  }
});
