import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  navigation,
  filterNavigation,
  activeNavigationItem,
} from "../../src/features/admin/shell/navigation";
import { useNavigationGroups } from "../../src/features/admin/shell/navigation-groups";
import { SidebarNavigation } from "../../src/features/admin/shell/sidebar-navigation";
import { defaultPermissions } from "../../src/features/admin/accounts/permissions";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
function Demo({ path = "/admin/dashboard" }: { path?: string }) {
  const state = useNavigationGroups(path);
  return <SidebarNavigation groups={navigation} pathname={path} {...state} />;
}
it("has exactly five flat groups and each destination has an icon and no nested children", () => {
  expect(navigation.map((g) => g.items.length)).toEqual([2, 4, 3, 5, 15]);
  expect(navigation.every((g) => g.items.every((i) => i.icon && !("children" in i)))).toBe(true);
  const role = {
    id: "custom",
    name: "Custom",
    permissions: { ...defaultPermissions("viewer"), products: ["view"], content: ["view"] },
    revision: 1,
    createdAt: "",
    updatedAt: "",
  } as Parameters<typeof filterNavigation>[1];
  const groups = filterNavigation({ userId: "u", roleId: "custom" }, role);
  const paths = groups.flatMap((g) => g.items.map((i) => i.path));
  expect(paths).not.toContain("/admin/products/create");
  expect(paths).not.toContain("/admin/content/posts/create");
  expect(groups.every((g) => g.items.length)).toBe(true);
});
it.each([
  ["/admin/products/product-1/edit", "/admin/products/list"],
  ["/~vhplasti/admin/content/posts/post-2/edit", "/admin/content/posts"],
  ["/admin/content/posts/create", "/admin/content/posts/create"],
  ["/admin/sales/slips/PMH-2026-0001/edit", "/admin/sales/slips"],
  ["/admin/products/categories/cat-1", "/admin/products/categories"],
])("matches %s to only the right navigation item", (path, target) =>
  expect(activeNavigationItem(navigation, path)?.path).toBe(target),
);
it("opens multiple groups, keeps active group manually closable, persists and reopens on navigation", () => {
  const v = render(<Demo />);
  const overview = screen.getByRole("button", { name: "Tổng quan" }),
    products = screen.getByRole("button", { name: "Quản lý sản phẩm" });
  expect(overview).toHaveAttribute("aria-expanded", "true");
  expect(products).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(products);
  expect(overview).toHaveAttribute("aria-expanded", "true");
  expect(products).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(overview);
  expect(overview).toHaveAttribute("aria-expanded", "false");
  v.rerender(<Demo path="/admin/products/product-1/edit" />);
  expect(products).toHaveAttribute("aria-expanded", "true");
  v.unmount();
  render(<Demo path="/admin/sales/reports" />);
  expect(screen.getByRole("button", { name: "Quản lý sản phẩm" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(screen.getByRole("button", { name: "Kinh doanh" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});
it("uses unique panel IDs across desktop and drawer, with icons and one aria-current link", () => {
  render(
    <>
      <Demo />
      <Demo />
    </>,
  );
  const controls = screen.getAllByRole("button").map((b) => b.getAttribute("aria-controls"));
  expect(new Set(controls).size).toBe(10);
  expect(document.querySelectorAll('a[aria-current="page"]')).toHaveLength(2);
  expect(document.querySelectorAll("a svg").length).toBeGreaterThan(0);
});
it.each(["broken", '["unknown"]'])("ignores corrupt/unknown stored groups: %s", (value) => {
  localStorage.setItem("bibi-admin:nav-groups:v1", value);
  render(<Demo />);
  expect(screen.getByRole("button", { name: "Tổng quan" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});
it("handles blocked preference reads and writes", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  render(<Demo />);
  fireEvent.click(screen.getByRole("button", { name: "Kinh doanh" }));
  expect(screen.getByRole("button", { name: "Kinh doanh" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});
