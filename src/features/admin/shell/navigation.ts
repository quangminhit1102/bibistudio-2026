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
  Bell,
  Image,
  Boxes,
  ShieldCheck,
} from "lucide-react";
import type { Resource } from "../services/contracts";
export const navigation: {
  label: string;
  items: {
    label: string;
    path: string;
    resource: Resource;
    icon: typeof Package;
    children?: { label: string; path: string }[];
  }[];
}[] = [
  {
    label: "Tổng quan",
    items: [
      {
        label: "Bảng điều khiển",
        path: "/admin/dashboard",
        resource: "dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Phân tích",
        path: "/admin/analytics/overview",
        resource: "analytics",
        icon: ChartNoAxesCombined,
        children: [
          { label: "Khách truy cập", path: "/admin/analytics/visitors" },
          { label: "Phiên truy cập", path: "/admin/analytics/sessions" },
          { label: "Trang phổ biến", path: "/admin/analytics/pages" },
          { label: "Nguồn truy cập", path: "/admin/analytics/traffic-sources" },
        ],
      },
    ],
  },
  {
    label: "Catalogue",
    items: [
      {
        label: "Sản phẩm",
        path: "/admin/products/list",
        resource: "products",
        icon: Package,
        children: [
          { label: "Thêm sản phẩm", path: "/admin/products/create" },
          { label: "Danh mục", path: "/admin/products/categories" },
          { label: "Tồn kho sản phẩm", path: "/admin/products/inventory" },
        ],
      },
      {
        label: "Nhà sách",
        path: "/admin/bookstore/books",
        resource: "bookstore",
        icon: BookOpen,
        children: [
          { label: "Tác giả", path: "/admin/bookstore/authors" },
          { label: "Nhà xuất bản", path: "/admin/bookstore/publishers" },
          { label: "Thể loại", path: "/admin/bookstore/genres" },
          { label: "Tồn kho sách", path: "/admin/bookstore/inventory" },
        ],
      },
    ],
  },
  {
    label: "Kinh doanh",
    items: [
      {
        label: "Đơn hàng",
        path: "/admin/sales/orders",
        resource: "sales",
        icon: ShoppingBag,
        children: [
          { label: "Lịch sử đơn hàng", path: "/admin/sales/order-history" },
          { label: "Giao dịch", path: "/admin/sales/transactions" },
          { label: "Báo cáo", path: "/admin/sales/reports" },
        ],
      },
    ],
  },
  {
    label: "Nội dung",
    items: [
      {
        label: "Bài viết",
        path: "/admin/content/posts",
        resource: "content",
        icon: FileText,
        children: [
          { label: "Viết bài mới", path: "/admin/content/posts/create" },
          { label: "Chuyên mục", path: "/admin/content/categories" },
          { label: "Thẻ", path: "/admin/content/tags" },
        ],
      },
      { label: "Thư viện ảnh", path: "/admin/content/media", resource: "content", icon: Image },
    ],
  },
  {
    label: "Quản trị",
    items: [
      { label: "Người dùng", path: "/admin/accounts/users", resource: "accounts", icon: Users },
      { label: "Vai trò", path: "/admin/accounts/roles", resource: "accounts", icon: ShieldCheck },
      {
        label: "Phân quyền",
        path: "/admin/accounts/permissions",
        resource: "accounts",
        icon: Layers,
      },
      { label: "Nhật ký hệ thống", path: "/admin/audit-logs", resource: "audit", icon: ScrollText },
      { label: "Thông báo", path: "/admin/notifications", resource: "notifications", icon: Bell },
      {
        label: "Cài đặt",
        path: "/admin/settings/general",
        resource: "settings",
        icon: Settings,
        children: [
          { label: "Giao diện", path: "/admin/settings/appearance" },
          { label: "Bảo mật demo", path: "/admin/settings/security" },
          { label: "Hồ sơ", path: "/admin/settings/profile" },
        ],
      },
      {
        label: "Thành phần UI",
        path: "/admin/components/overview",
        resource: "components",
        icon: Boxes,
        children: [
          "actions",
          "forms",
          "data-display",
          "navigation",
          "overlays",
          "feedback",
          "charts",
        ].map((p) => ({
          label: (
            {
              actions: "Hành động",
              forms: "Biểu mẫu",
              "data-display": "Dữ liệu",
              navigation: "Điều hướng",
              overlays: "Hộp thoại",
              feedback: "Phản hồi",
              charts: "Biểu đồ",
            } as Record<string, string>
          )[p],
          path: "/admin/components/" + p,
        })),
      },
    ],
  },
];
