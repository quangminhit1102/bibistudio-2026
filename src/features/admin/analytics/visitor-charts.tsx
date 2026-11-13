import Chart from "../shared/charts/chart";
import type { VisitorReportDto } from "../../../../backend/src/http/contracts";
export function VisitorSessionsChart({ report }: { report: VisitorReportDto }) {
  return (
    <>
      <Chart
        kind="line"
        unit="quantity"
        label="Lượt truy cập theo phiên"
        data={(report.series ?? []).map((point) => ({ name: point.label, value: point.sessions }))}
      />
      <details className="a-visitor-chart-data">
        <summary>Xem số liệu lượt truy cập</summary>
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Số phiên</th>
            </tr>
          </thead>
          <tbody>
            {report.series?.map((point) => (
              <tr key={point.startUtc}>
                <td>{point.label}</td>
                <td>{point.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
export function VisitorProductsChart({ report }: { report: VisitorReportDto }) {
  return (
    <Chart
      kind="horizontal-bar"
      unit="quantity"
      label="Sản phẩm được quan tâm · số trình duyệt khác nhau"
      data={report.products.map((product) => ({
        name: product.name,
        value: product.interestedVisitors,
        reference: product.slug,
      }))}
    />
  );
}
