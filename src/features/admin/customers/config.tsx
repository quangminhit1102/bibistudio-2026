import { Link } from "@tanstack/react-router";
import type { EntityConfig } from "../shared/entity-manager";
import { Badge } from "../shared/ui/primitives";
import { site } from "@/platform/site";
import { customerFields, customerKinds } from "./fields";
export { customerKinds } from "./fields";
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
  description: `Quản lý nhà sách, cá nhân và công ty mua sản phẩm của ${site.shortName}. Dữ liệu.`,
  createHref: "/admin/customers/create",
  returnPath: "/admin/customers",
  allowDelete: false,
  editHref: (id) => `/admin/customers/${id}/edit`,
  detailHref: (id) => `/admin/customers/${id}`,
  defaults: {
    name: "",
    kind: "bookstore",
    address: "",
    vatRate: 8,
    notes: "",
    active: true,
    email: "",
    phone: "",
    representative: "",
    extra: {},
  },
  fields: customerFields,
  filters: [
    { field: "kind", label: "Loại khách", options: customerKinds },
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
      accessorKey: "vatRate",
      header: "VAT",
      cell: ({ getValue }) => (
        <Badge tone={Number(getValue()) > 0 ? "info" : "neutral"}>{String(getValue())}%</Badge>
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
