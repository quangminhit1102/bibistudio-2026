import { Link } from "@tanstack/react-router";
import { EntityManager, type EntityConfig } from "../../shared/entity-manager";
import { Badge } from "../../shared/ui/primitives";
import { money, date } from "../../shared/lib/text";
import { orderLabels, paymentLabels } from "../service";
const config: EntityConfig<"orders"> = {
  entity: "orders",
  title: "Đơn hàng",
  description: "Theo dõi đơn hàng, trạng thái và lịch sử thanh toán.",
  readOnly: true,
  defaults: {
    number: "",
    customer: { name: "", email: "", address: "" },
    items: [],
    discount: 0,
    shipping: 0,
    total: 0,
    status: "Pending",
    paymentStatus: "Pending",
    notes: "",
    timeline: [],
  },
  fields: [],
  detailHref: (id) => `/admin/sales/orders/${id}`,
  filters: [
    {
      field: "status",
      label: "Trạng thái đơn",
      options: Object.entries(orderLabels).map(([value, label]) => ({ value, label })),
    },
    {
      field: "paymentStatus",
      label: "Thanh toán",
      options: Object.entries(paymentLabels).map(([value, label]) => ({ value, label })),
    },
  ],
  columns: [
    {
      accessorKey: "number",
      header: "Đơn hàng",
      cell: ({ row }) => (
        <Link to={("/admin/sales/orders/" + row.id) as "/admin"}>
          <strong>{row.original.number}</strong>
          <small>{row.original.customer.name}</small>
        </Link>
      ),
    },
    {
      id: "count",
      header: "Số lượng",
      cell: ({ row }) => row.original.items.reduce((n, i) => n + i.quantity, 0),
    },
    { accessorKey: "total", header: "Tổng", cell: ({ getValue }) => money(Number(getValue())) },
    {
      accessorKey: "paymentStatus",
      header: "Thanh toán",
      cell: ({ getValue }) => (
        <Badge tone={getValue() === "Paid" ? "success" : "neutral"}>
          {paymentLabels[getValue() as keyof typeof paymentLabels]}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ getValue }) => (
        <Badge
          tone={
            getValue() === "Delivered"
              ? "success"
              : getValue() === "Cancelled"
                ? "error"
                : "warning"
          }
        >
          {orderLabels[getValue() as keyof typeof orderLabels]}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Ngày tạo",
      cell: ({ getValue }) => date(String(getValue())),
    },
  ],
};
export default function Orders() {
  return <EntityManager config={config} />;
}
