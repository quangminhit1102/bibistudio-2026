import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin, useRole } from "../../services/context";
import { requirePermission, can } from "../../accounts/permissions";
import { aggregateOrders, presetRange } from "../../analytics/aggregate";
import { PageTitle, Skeleton, ErrorState, Button } from "../../shared/ui/primitives";
import { ChartCard, DateFilter, Kpi } from "../../shared/charts/blocks";
import { money, makeCsv, downloadBlob } from "../../shared/lib/text";
export default function Reports() {
  const runtime = useAdmin();
  const role = useRole();
  const [range, setRange] = useState(presetRange("30"));
  const result = useQuery({
    queryKey: ["bibi-admin", "sales-report", range, runtime.session?.roleId],
    enabled: !role.isPending,
    queryFn: async () => {
      requirePermission(runtime.session, "sales", "view", role.data);
      await runtime.ensure("orders");
      return aggregateOrders(await runtime.store.list("orders"), range);
    },
  });
  return (
    <>
      <PageTitle
        title="Báo cáo kinh doanh"
        description="Tổng hợp từ các đơn demo trong khoảng ngày được chọn."
        actions={
          result.data &&
          can(runtime.session, "sales", "export", role.data) && (
            <Button
              onClick={() => {
                const d = result.data!;
                downloadBlob(
                  new Blob(
                    [
                      makeCsv([
                        ["Chỉ tiêu", "Giá trị"],
                        ["Doanh thu", d.revenue],
                        ["Đơn hàng", d.orders],
                        ["Hoàn tất", d.completed],
                        ["Đã hủy", d.cancelled],
                      ]),
                    ],
                    { type: "text/csv" },
                  ),
                  "sales-report-demo.csv",
                );
              }}
            >
              Xuất báo cáo CSV
            </Button>
          )
        }
      />
      <DateFilter value={range} onChange={setRange} />
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        result.data && (
          <>
            <div className="a-kpis">
              <Kpi
                title="Doanh thu demo"
                value={money(result.data.revenue)}
                description="Đơn đang Paid và không hủy/hoàn tiền."
              />
              <Kpi title="Đơn hàng" value={result.data.orders} description="Số đơn tạo trong kỳ." />
              <Kpi
                title="Giá trị đơn trung bình"
                value={money(result.data.averageValue)}
                description="Trung bình tổng giá trị đơn hợp lệ."
              />
              <Kpi
                title="Đang xử lý"
                value={result.data.pending}
                description="Pending, Confirmed hoặc Processing."
              />
              <Kpi
                title="Hoàn tất"
                value={result.data.completed}
                description="Trạng thái Delivered."
              />
              <Kpi
                title="Đã hủy"
                value={result.data.cancelled}
                description="Trạng thái Cancelled."
              />
            </div>
            <div className="a-grid-2">
              <ChartCard title="Xu hướng doanh thu" data={result.data.revenueTrend} />
              <ChartCard title="Xu hướng đơn hàng" data={result.data.orderTrend} kind="bar" />
              <ChartCard
                title="Sản phẩm được đặt nhiều"
                data={result.data.topProducts}
                kind="bar"
              />
            </div>
          </>
        )
      )}
    </>
  );
}
