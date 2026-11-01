import { useState } from "react";
import { useAnalytics } from "../hooks";
import { presetRange } from "../aggregate";
import { PageTitle, Skeleton, ErrorState, Card } from "../../shared/ui/primitives";
import { DateFilter, ChartCard } from "../../shared/charts/blocks";
export default function TrafficSources() {
  const [range, setRange] = useState(presetRange("30"));
  const result = useAnalytics(range);
  return (
    <>
      <PageTitle
        title="Nguồn truy cập"
        description="Nguồn giới thiệu được khai báo trong phiên mô phỏng."
      />
      <DateFilter value={range} onChange={setRange} />
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} />
      ) : (
        result.data && (
          <div className="a-grid-2">
            <ChartCard title="Phân bổ nguồn" data={result.data.current.sources} kind="donut" />
            <Card>
              <h2>Chi tiết nguồn</h2>
              <div className="a-table-wrap" style={{ marginTop: 20 }}>
                <table className="a-table" style={{ minWidth: 300 }}>
                  <thead>
                    <tr>
                      <th>Nguồn</th>
                      <th>Phiên</th>
                      <th>Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.current.sources.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td>{s.value}</td>
                        <td>
                          {(result.data!.current.visits
                            ? (s.value / result.data!.current.visits) * 100
                            : 0
                          ).toFixed(1)}
                          %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      )}
    </>
  );
}
