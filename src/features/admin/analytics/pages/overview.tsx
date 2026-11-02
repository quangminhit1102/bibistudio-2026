import { useState } from "react";
import { useAnalytics } from "../hooks";
import { presetRange } from "../aggregate";
import { PageTitle, ErrorState, Skeleton } from "../../shared/ui/primitives";
import { Kpi, ChartCard, DateFilter } from "../../shared/charts/blocks";
export default function AnalyticsOverview() {
  const [range, setRange] = useState(presetRange("30"));
  const result = useAnalytics(range);
  return (
    <>
      <PageTitle
        title="Phân tích truy cập"
        description="Hành vi truy cập, không thu thập hay theo dõi người dùng thật."
      />
      <DateFilter value={range} onChange={setRange} />
      {result.isPending ? (
        <Skeleton rows={8} />
      ) : result.error ? (
        <ErrorState error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        result.data &&
        (() => {
          const r = result.data.current,
            p = result.data.previous;
          return (
            <>
              <div className="a-kpis">
                <Kpi
                  title="Lượt truy cập"
                  value={r.visits}
                  raw={r.visits}
                  previous={p.visits}
                  description="Số phiên bắt đầu trong khoảng ngày."
                />
                <Kpi
                  title="Khách duy nhất"
                  value={r.uniqueVisitors}
                  raw={r.uniqueVisitors}
                  previous={p.uniqueVisitors}
                  description="Anonymous ID khác nhau có phiên trong kỳ."
                />
                <Kpi
                  title="Lượt xem trang"
                  value={r.pageViews}
                  raw={r.pageViews}
                  previous={p.pageViews}
                  description="Tổng page-view của các phiên thuộc kỳ."
                />
                <Kpi
                  title="Phiên đang hoạt động"
                  value={r.activeSessions}
                  description="Phiên chưa kết thúc, có page-view trong5 phút tính từ mốc cố định."
                />
                <Kpi
                  title="Thời lượng trung bình"
                  value={Math.round(r.averageDuration) + " giây"}
                  description="Trung bình độ dài phiên từ thời điểm bắt đầu đến kết thúc hoặc mốc."
                />
                <Kpi
                  title="Tỷ lệ thoát"
                  value={r.bounceRate.toFixed(1) + "%"}
                  description="Tỷ lệ phiên chỉ xem1 trang."
                />
              </div>
              <div className="a-grid-2">
                <ChartCard title="Truy cập theo ngày" data={r.trend} />
                <ChartCard
                  title="Mới và quay lại"
                  data={[
                    { name: "Mới", value: r.newVisitors },
                    { name: "Quay lại", value: r.returningVisitors },
                  ]}
                  kind="donut"
                />
                <ChartCard title="Quốc gia" data={r.countries} kind="bar" />
                <ChartCard title="Thiết bị" data={r.devices} kind="donut" />
                <ChartCard title="Trình duyệt" data={r.browsers} kind="donut" />
                <ChartCard title="Nguồn truy cập" data={r.sources} kind="bar" />
              </div>
            </>
          );
        })()
      )}
    </>
  );
}
