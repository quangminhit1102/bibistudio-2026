import { useState } from "react";
import { useAnalytics } from "../hooks";
import { presetRange } from "../aggregate";
import { PageTitle, Skeleton, ErrorState, Card } from "../../shared/ui/primitives";
import { DateFilter, ChartCard } from "../../shared/charts/blocks";
export default function PopularPages() {
  const [range, setRange] = useState(presetRange("30"));
  const result = useAnalytics(range);
  return (
    <>
      <PageTitle
        title="Trang phổ biến"
        description="Lượt xem được cộng từ page-view của các phiên demo."
      />
      <DateFilter value={range} onChange={setRange} />
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} />
      ) : (
        result.data && (
          <>
            <ChartCard title="Lượt xem theo trang" data={result.data.current.pages} kind="bar" />
            <Card>
              <div className="a-table-wrap">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>Trang</th>
                      <th>Lượt xem</th>
                      <th>Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.current.pages.map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td>{p.value}</td>
                        <td>
                          {(result.data!.current.pageViews
                            ? (p.value / result.data!.current.pageViews) * 100
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
          </>
        )
      )}
    </>
  );
}
