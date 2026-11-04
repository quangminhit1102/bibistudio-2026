import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Package,
  BookOpen,
  ShoppingBag,
  FileText,
  Users,
  Settings,
  Layers,
  ScrollText,
  Image,
  Boxes,
  ShieldCheck,
  Plus,
  Folder,
  Tag,
  Palette,
  UserRound,
  MousePointer2,
  TextCursorInput,
  Table2,
  Navigation,
  PanelsTopLeft,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { Resource, DemoSession, Role } from "../services/contracts";
import { can, canCode } from "../accounts/permissions";
export type NavigationItem = {
  label: string;
  path: string;
  resource: Resource;
  action?: "view" | "create";
  icon: LucideIcon;
  permissionCodes?: string[];
};
export type NavigationGroup = { id: string; label: string; items: NavigationItem[] };
export const navigation: NavigationGroup[] = [
  {
    id: "overview",
    label: "Tổng quan",
    items: [
      {
        label: "Bảng điều khiển",
        path: "/admin/dashboard",
        resource: "dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Khách truy cập",
        path: "/admin/analytics/visitors",
        resource: "analytics",
        icon: ChartNoAxesCombined,
      },
    ],
  },
  {
    id: "products",
    label: "Quản lý sản phẩm",
    items: [
      {
        label: "Danh sách sản phẩm",
        path: "/admin/products/list",
        resource: "products",
        icon: Package,
      },
      {
        label: "Thêm sản phẩm",
        path: "/admin/products/create",
        resource: "products",
        action: "create",
        icon: Plus,
      },
      { label: "Danh mục", path: "/admin/products/categories", resource: "products", icon: Layers },
      { label: "Tồn kho", path: "/admin/products/inventory", resource: "products", icon: Boxes },
    ],
  },
  {
    id: "business",
    label: "Kinh doanh",
    items: [
      { label: "Khách mua hàng", path: "/admin/customers", resource: "bookstore", icon: BookOpen },
      { label: "Phiếu mua hàng", path: "/admin/sales/slips", resource: "sales", icon: ShoppingBag },
      {
        label: "Báo cáo",
        path: "/admin/sales/reports",
        resource: "sales",
        icon: ChartNoAxesCombined,
      },
    ],
  },
  {
    id: "content",
    label: "Nội dung",
    items: [
      { label: "Bài viết", path: "/admin/content/posts", resource: "content", icon: FileText },
      {
        label: "Viết bài mới",
        path: "/admin/content/posts/create",
        resource: "content",
        action: "create",
        icon: Plus,
      },
      { label: "Chuyên mục", path: "/admin/content/categories", resource: "content", icon: Folder },
      { label: "Thẻ", path: "/admin/content/tags", resource: "content", icon: Tag },
      { label: "Thư viện ảnh", path: "/admin/content/media", resource: "content", icon: Image },
    ],
  },
  {
    id: "management",
    label: "Quản trị",
    items: [
      { label: "Người dùng", path: "/admin/accounts/users", resource: "accounts", icon: Users },
      {
        label: "Vai trò",
        path: "/admin/accounts/roles",
        resource: "accounts",
        icon: ShieldCheck,
        permissionCodes: ["role.view"],
      },
      {
        label: "Phân quyền",
        path: "/admin/accounts/permissions",
        permissionCodes: ["role.view", "permission.view"],
        resource: "accounts",
        icon: Layers,
      },
      { label: "Nhật ký hệ thống", path: "/admin/audit-logs", resource: "audit", icon: ScrollText },
      {
        label: "Cài đặt chung",
        path: "/admin/settings/general",
        resource: "settings",
        icon: Settings,
      },
      {
        label: "Giao diện",
        path: "/admin/settings/appearance",
        resource: "settings",
        icon: Palette,
      },
      { label: "Hồ sơ", path: "/admin/settings/profile", resource: "settings", icon: UserRound },
      {
        label: "Tổng quan thành phần UI",
        path: "/admin/components/overview",
        resource: "components",
        icon: Boxes,
      },
      {
        label: "Hành động",
        path: "/admin/components/actions",
        resource: "components",
        icon: MousePointer2,
      },
      {
        label: "Biểu mẫu",
        path: "/admin/components/forms",
        resource: "components",
        icon: TextCursorInput,
      },
      {
        label: "Dữ liệu",
        path: "/admin/components/data-display",
        resource: "components",
        icon: Table2,
      },
      {
        label: "Điều hướng",
        path: "/admin/components/navigation",
        resource: "components",
        icon: Navigation,
      },
      {
        label: "Hộp thoại",
        path: "/admin/components/overlays",
        resource: "components",
        icon: PanelsTopLeft,
      },
      {
        label: "Phản hồi",
        path: "/admin/components/feedback",
        resource: "components",
        icon: MessageSquare,
      },
      {
        label: "Biểu đồ",
        path: "/admin/components/charts",
        resource: "components",
        icon: ChartNoAxesCombined,
      },
    ],
  },
];
export function filterNavigation(session: DemoSession | null, role?: Role): NavigationGroup[] {
  return navigation
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => navigationItemAllowed(session, i, role)),
    }))
    .filter((g) => g.items.length > 0);
}
function navigationItemAllowed(
  session: DemoSession | null,
  item: NavigationItem,
  role?: Role,
): boolean {
  if (session?.kind === "http" && item.permissionCodes)
    return item.permissionCodes.every((code) => canCode(session, code));
  return (
    can(session, item.resource, "view", role) &&
    can(session, item.resource, item.action ?? "view", role)
  );
}
export function canAccessAdminPath(
  session: DemoSession | null,
  pathname: string,
  role?: Role,
): boolean {
  if (["/admin", "/admin/"].includes(pathname)) return !!session;
  const items = navigation.flatMap((group) => group.items);
  const direct = items
    .filter((item) => pathname === item.path || pathname.startsWith(item.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (direct) return navigationItemAllowed(session, direct, role);
  const module = pathname.split("/")[2];
  const fallback = items.find((item) => item.path.split("/")[2] === module);
  return !!fallback && can(session, fallback.resource, "view", role);
}
export function activeNavigationItem(
  groups: NavigationGroup[],
  pathname: string,
): NavigationItem | undefined {
  const match = pathname.match(/\/admin(?:\/|$)/);
  if (!match) return;
  const path = pathname.slice(match.index).replace(/\/$/, "");
  const items = groups.flatMap((g) => g.items);
  const exact = items.find((i) => i.path === path);
  if (exact) return exact;
  return items
    .map((item) => ({
      item,
      prefix: item.path === "/admin/products/list" ? "/admin/products" : item.path,
    }))
    .filter(({ prefix }) => path.startsWith(prefix + "/"))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.item;
}
