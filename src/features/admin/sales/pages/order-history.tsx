import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useEntity } from "../../services/context";
import { DataTable, type TableState } from "../../shared/tables/data-table";
import { PageTitle } from "../../shared/ui/primitives";
import { date, makeCsv, downloadBlob } from "../../shared/lib/text";
import { orderLabels } from "../service";
export default function OrderHistory() {
  const query = useEntity("orders", { page: 1, pageSize: 200 });
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: 20,
    search: "",
    filters: {},
    sort: { field: "at", direction: "desc" },
  });
  const events =
    query.data?.items.flatMap((o) =>
      o.timeline.map((event, i) => ({
        id: o.id + "-" + i,
        orderId: o.id,
        number: o.number,
        at: event.at,
        status: orderLabels[event.status],
        customer: o.customer.name,
      })),
    ) ?? [];
  return (
    <>
      <PageTitle
        title="Lịch sử đơn hàng"
        description="Dòng thời gian trạng thái được lưu trong từng đơn."
      />
      <DataTable
        columns={[
          {
            accessorKey: "number",
            header: "Đơn",
            cell: ({ row }) => (
              <Link to={("/admin/sales/orders/" + row.original.orderId) as "/admin"}>
                {row.original.number}
              </Link>
            ),
          },
          { accessorKey: "customer", header: "Khách hàng" },
          { accessorKey: "status", header: "Trạng thái" },
          {
            accessorKey: "at",
            header: "Thời điểm",
            cell: ({ getValue }) => date(String(getValue())),
          },
        ]}
        result={{ items: [], total: events.length, page: state.page, pageSize: state.pageSize }}
        clientRows={events}
        state={state}
        onStateChange={setState}
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        selectable={false}
        onExport={() =>
          downloadBlob(
            new Blob(
              [
                makeCsv([
                  ["Đơn", "Khách", "Trạng thái", "Thời gian"],
                  ...events.map((e) => [e.number, e.customer, e.status, e.at]),
                ]),
              ],
              { type: "text/csv" },
            ),
            "order-history-demo.csv",
          )
        }
      />
    </>
  );
}
