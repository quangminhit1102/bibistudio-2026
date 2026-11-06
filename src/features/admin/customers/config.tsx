import { Link } from "@tanstack/react-router";
import type { EntityConfig } from "../shared/entity-manager";
import { Badge } from "../shared/ui/primitives";
export const customerKinds = [
  { value: "bookstore", label: "Nhà sách" },
  { value: "individual", label: "Cá nhân" },
  { value: "company", label: "Công ty" },
];
export function customerReturnTo(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/admin/customers")) return "/admin/customers";
  try {
    const url = new URL(input, "https://admin.local");
    return url.origin === "https://admin.local" && url.pathname === "/admin/customers"
      ? url.pathname + url.search
      : "/admin/customers";
  } catch {
    return "/admin/customers";
  }
}
export const customerConfig: EntityConfig<"customers"> = {
  entity: "customers",
  title: "Khách mua hàng",
  description: "Quản lý nhà sách, cá nhân và công ty mua sản phẩm của BiBi. Dữ liệu.",
  createHref: "/admin/customers/create",
  returnPath: "/admin/customers",
  allowDelete: false,
  editHref: (id) => `/admin/customers/${id}/edit`,
  detailHref: (id) => `/admin/customers/${id}`,
  defaults: {
    name: "",
    kind: "bookstore",
    address: "",
    vatApplied: false,
    notes: "",
    active: true,
    email: "",
    phone: "",
  },
  fields: [
    { key: "name", label: "Tên khách", type: "text", required: true },
    { key: "kind", label: "Loại khách", type: "select", required: true, options: customerKinds },
    { key: "address", label: "Địa chỉ", type: "textarea", full: true },
    { key: "phone", label: "Điện thoại", type: "text" },
    { key: "email", label: "Email", type: "email" },
    {
      key: "vatApplied",
      label: "Áp dụng VAT",
      type: "checkbox",
      description: "Nhãn mặc định khi lập phiếu; không tính thuế.",
    },
    {
      key: "active",
      label: "Hoạt động",
      type: "checkbox",
      description: "Tắt để ngừng chọn khách này khi lập phiếu mới. Phiếu cũ vẫn được giữ.",
    },
    { key: "notes", label: "Thông tin thêm", type: "textarea", full: true },
  ],
  filters: [
    { field: "kind", label: "Loại khách", options: customerKinds },
    {
      field: "vatApplied",
      label: "VAT",
      options: [
        { value: "true", label: "Có VAT" },
        { value: "false", label: "Không VAT" },
      ],
    },
    {
      field: "active",
      label: "Sử dụng",
      options: [
        { value: "true", label: "Hoạt động" },
        { value: "false", label: "Ngừng hoạt động" },
      ],
    },
  ],
  columns: [
    {
      accessorKey: "name",
      header: "Khách mua hàng",
      cell: ({ row }) => (
        <Link
          to={`/admin/customers/${row.id}` as "/admin"}
          search={{ returnTo: "/admin/customers" + location.search } as never}
        >
          <strong>{row.original.name}</strong>
          <small>{row.id.slice(0, 12)}</small>
        </Link>
      ),
    },
    {
      accessorKey: "kind",
      header: "Loại",
      cell: ({ getValue }) => customerKinds.find((k) => k.value === getValue())?.label,
    },
    { accessorKey: "address", header: "Địa chỉ" },
    {
      accessorKey: "vatApplied",
      header: "VAT",
      cell: ({ getValue }) => (
        <Badge tone={getValue() ? "info" : "neutral"}>{getValue() ? "Có VAT" : "Không VAT"}</Badge>
      ),
    },
    {
      accessorKey: "active",
      header: "Sử dụng",
      cell: ({ getValue }) => (
        <Badge tone={getValue() ? "success" : "neutral"}>
          {getValue() ? "Hoạt động" : "Ngừng hoạt động"}
        </Badge>
      ),
    },
  ],
};
