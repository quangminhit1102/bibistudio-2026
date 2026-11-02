import { EntityManager, type EntityConfig } from "../../shared/entity-manager";
import { money, date } from "../../shared/lib/text";
import { Badge } from "../../shared/ui/primitives";
import { paymentLabels } from "../service";
const config: EntityConfig<"payments"> = {
  entity: "payments",
  title: "Giao dịch",
  description: "Không kết nối cổng thanh toán, không thực hiện thu hoặc hoàn tiền thật.",
  readOnly: true,
  dateField: "createdAt",
  fields: [],
  defaults: { orderId: "", amount: 0, status: "Pending", method: "" },
  filters: [
    {
      field: "status",
      label: "Trạng thái",
      options: Object.entries(paymentLabels).map(([value, label]) => ({ value, label })),
    },
  ],
  columns: [
    { accessorKey: "id", header: "Mã giao dịch", size: 250 },
    { accessorKey: "orderId", header: "Đơn liên quan" },
    {
      accessorKey: "amount",
      header: "Giá trị",
      cell: ({ getValue }) => money(Number(getValue())),
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ getValue }) => (
        <Badge>{paymentLabels[getValue() as keyof typeof paymentLabels]}</Badge>
      ),
    },
    { accessorKey: "method", header: "Phương thức" },
    { accessorKey: "createdAt", header: "Ngày", cell: ({ getValue }) => date(String(getValue())) },
  ],
};
export default function Transactions() {
  return <EntityManager config={config} />;
}
