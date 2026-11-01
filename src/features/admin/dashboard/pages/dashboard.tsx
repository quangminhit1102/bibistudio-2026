import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAnalytics } from "../../analytics/hooks";
import { presetRange, conversionRate, within, previousRange } from "../../analytics/aggregate";
import { PageTitle, Card, Badge, ErrorState, Skeleton } from "../../shared/ui/primitives";
import { Kpi, ChartCard, DateFilter } from "../../shared/charts/blocks";
import { money, date } from "../../shared/lib/text";
import { orderLabels } from "../../sales/service";
export default function Dashboard() {
  const [range, setRange] = useState(presetRange("30"));
  const report = useAnalytics(range, true);
  return (
    <>
      <PageTitle
        title="Bảng điều khiển"
        description="Một góc nhìn rõ ràng về hoạt động studio. Tất cả số liệu bên dưới đều là mô phỏng."
      />
      <DateFilter value={range} onChange={setRange} />
      {report.isPending ? (
        <Skeleton rows={8} />
      ) : report.error ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        report.data &&
        (() => {
          const r = report.data,
            b = r.business!,
            prev = r.previousBusiness!,
            conversion = conversionRate(
              b.selected,
              r.sessions.filter((s) => within(s.startedAt, range)).map((s) => s.visitorId),
            ),
            prevConversion = conversionRate(
              prev.selected,
              r.sessions
                .filter((s) => within(s.startedAt, previousRange(range)))
                .map((s) => s.visitorId),
            ),
            active = r.users.filter(
              (u) =>
                u.active &&
                u.lastLogin &&
                Date.parse(u.lastLogin) >= Date.parse(range.start) &&
                Date.parse(u.lastLogin) < Date.parse(range.end),
            ).length;
          const categoryTotals = new Map<string, number>();
          for (const order of b.selected.filter(
            (o) => o.paymentStatus === "Paid" && !["Cancelled", "Refunded"].includes(o.status),
          ))
            for (const item of order.items) {
              const group = r.products.find((p) => p.id === item.id)?.productType ?? "book";
              categoryTotals.set(
                group,
                (categoryTotals.get(group) ?? 0) + item.unitPrice * item.quantity,
              );
            }
          const categories = [...categoryTotals].map(([name, value]) => ({ name, value }));
          return (
            <>
              <div className="a-kpis">
                <Kpi
                  title="Doanh thu demo"
                  value={money(b.revenue)}
                  raw={b.revenue}
                  previous={prev.revenue}
                  description="Tổng đơn trong kỳ đang thanh toán Paid, loại đơn hủy/hoàn tiền. Không phải tiền thu thật."
                />
                <Kpi
                  title="Đơn hàng"
                  value={b.orders}
                  raw={b.orders}
                  previous={prev.orders}
                  description="Đơn tạo trong khoảng ngày được chọn."
                />
                <Kpi
                  title="Sản phẩm"
                  value={r.products.length}
                  description="Số bản ghi sản phẩm demo đang có, không bao gồm sách."
                />
                <Kpi
                  title="Khách truy cập"
                  value={r.current.uniqueVisitors}
                  raw={r.current.uniqueVisitors}
                  previous={r.previous.uniqueVisitors}
                  description="Số anonymous visitor khác nhau có phiên bắt đầu trong kỳ."
                />
                <Kpi
                  title="Người dùng hoạt động"
                  value={active}
                  description="Tài khoản quản trị demo hoạt động và có lastLogin trong kỳ."
                />
                <Kpi
                  title="Tỷ lệ chuyển đổi"
                  value={conversion.toFixed(1) + "%"}
                  raw={conversion}
                  previous={prevConversion}
                  description="Visitor có đơn không hủy/hoàn tiền chia visitor có phiên trong kỳ; mỗi người tính một lần. Chỉ mô phỏng."
                />
              </div>
              <div className="a-dashboard-grid">
                <ChartCard title="Doanh thu theo ngày" data={b.revenueTrend} />
                <Card>
                  <div className="a-card-head">
                    <h2>Đơn hàng gần đây</h2>
                    <Link className="a-btn a-btn-sm a-btn-ghost" to="/admin/sales/orders">
                      Xem tất cả →
                    </Link>
                  </div>
                  <div className="a-table-wrap">
                    <table className="a-table" style={{ minWidth: 300 }}>
                      <tbody>
                        {b.selected
                          .slice()
                          .sort((a, c) => c.createdAt.localeCompare(a.createdAt))
                          .slice(0, 6)
                          .map((o) => (
                            <tr key={o.id}>
                              <td>
                                <Link to={("/admin/sales/orders/" + o.id) as "/admin"}>
                                  <strong>{o.number}</strong>
                                  <small>{o.customer.name}</small>
                                </Link>
                              </td>
                              <td>{money(o.total)}</td>
                              <td>
                                <Badge tone={o.status === "Delivered" ? "success" : "neutral"}>
                                  {orderLabels[o.status]}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
              <div className="a-grid-2">
                <ChartCard title="Đơn hàng theo thời gian" data={b.orderTrend} kind="bar" />
                <ChartCard title="Khách truy cập theo ngày" data={r.current.trend} kind="line" />
                <ChartCard
                  title="Giá trị sản phẩm đã thanh toán theo nhóm"
                  data={categories}
                  kind="donut"
                />
                <ChartCard title="Nguồn truy cập" data={r.current.sources} kind="donut" />
                <ChartCard title="Sản phẩm bán nhiều (demo)" data={b.topProducts} kind="bar" />
                <Card>
                  <h2>Sản phẩm sắp hết hàng</h2>
                  <div className="a-table-wrap" style={{ marginTop: 18 }}>
                    <table className="a-table" style={{ minWidth: 300 }}>
                      <tbody>
                        {r.products
                          .filter((p) => p.stock - p.reserved < 35)
                          .slice(0, 6)
                          .map((p) => (
                            <tr key={p.id}>
                              <td>
                                <Link to={("/admin/products/" + p.id) as "/admin"}>{p.name}</Link>
                              </td>
                              <td>
                                <Badge tone="warning">{p.stock - p.reserved} khả dụng</Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Card>
                  <h2>Hoạt động gần đây</h2>
                  <ol className="a-timeline" style={{ marginTop: 20 }}>
                    {r.activity
                      .slice(-5)
                      .reverse()
                      .map((a) => (
                        <li key={a.id}>
                          {a.action} · {a.resource}
                          <small>{date(a.createdAt)}</small>
                        </li>
                      ))}
                  </ol>
                  {!r.activity.length && (
                    <p style={{ marginTop: 18, color: "var(--a-muted)", fontSize: 12 }}>
                      Hoạt động chỉnh sửa sẽ xuất hiện ở đây.
                    </p>
                  )}
                </Card>
                <Card>
                  <h2>Thông báo hệ thống</h2>
                  {r.notifications.slice(0, 4).map((n) => (
                    <Link
                      key={n.id}
                      to={n.href as "/admin"}
                      className="a-search-results"
                      style={{
                        display: "block",
                        padding: "12px 0",
                        borderBottom: "1px solid var(--a-border)",
                      }}
                    >
                      <strong>{n.name}</strong>
                      <small style={{ display: "block" }}>{n.description}</small>
                    </Link>
                  ))}
                </Card>
                <Card>
                  <h2>Khách truy cập gần đây (mô phỏng)</h2>
                  <div className="a-table-wrap" style={{ marginTop: 16 }}>
                    <table className="a-table" style={{ minWidth: 300 }}>
                      <tbody>
                        {r.visitors
                          .slice()
                          .sort((a, c) => c.lastSeenAt.localeCompare(a.lastSeenAt))
                          .slice(0, 5)
                          .map((v) => (
                            <tr key={v.id}>
                              <td>
                                <Link to={("/admin/analytics/visitors/" + v.id) as "/admin"}>
                                  {v.anonymousId}
                                </Link>
                              </td>
                              <td>{v.deviceType}</td>
                              <td>{v.country}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          );
        })()
      )}
    </>
  );
}
