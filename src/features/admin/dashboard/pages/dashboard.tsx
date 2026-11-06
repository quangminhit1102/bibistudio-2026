import { NotificationSummary } from "../../notifications/header-menu";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAnalytics } from "../../analytics/hooks";
import { businessRange } from "../../sales/slip-aggregate";
import { PageTitle, Card, Badge, ErrorState, Skeleton } from "../../shared/ui/primitives";
import { Kpi, ChartCard, DateFilter } from "../../shared/charts/blocks";
import { money, date } from "../../shared/lib/text";
import { useAdmin, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import type { Resource } from "../../services/contracts";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadServerDashboard } from "../service";
function Access({ resource, children }: { resource: Resource; children: ReactNode }) {
  const runtime = useAdmin();
  const role = useRole();
  return can(runtime.session, resource, "view", role.data) ? children : null;
}
export default function Dashboard() {
  const runtime = useAdmin();
  const server = runtime.session?.kind === "http";
  const live = useQuery({
    queryKey: ["bibi-admin", "http-dashboard", runtime.session?.userId],
    enabled: !!runtime.http && server,
    queryFn: ({ signal }) => {
      if (!runtime.http || runtime.session?.kind !== "http") throw new Error("Phiên không hợp lệ");
      return loadServerDashboard(runtime.http, runtime.session.principal, signal);
    },
  });
  const [anchor] = useState(() => new Date());
  const [range, setRange] = useState(() => businessRange("30", anchor));
  const report = useAnalytics(range, true);
  return (
    <>
      <PageTitle title="Bảng điều khiển" description="Một góc nhìn rõ ràng về hoạt động studio." />
      <DateFilter
        value={range}
        onChange={setRange}
        resolvePreset={(p) => businessRange(p, anchor)}
        caption={
          server
            ? "Bộ lọc áp dụng cho phiếu mua hàng. Khách truy cập tổng hợp trong 90 ngày."
            : "Ngày theo giờ Việt Nam"
        }
      />
      {server && live.error && (
        <ErrorState error={live.error} onRetry={() => void live.refetch()} />
      )}
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
            active = r.activeUsers;
          const categories = r.categorySales;
          return (
            <>
              <div className="a-kpis">
                <Kpi
                  title="Doanh thu ghi nhận"
                  value={money(b.total)}
                  raw={b.total}
                  previous={prev.total}
                  description="Tổng phiếu đã lưu, chưa hủy trong kỳ. Không phải tiền đã thu; không tự tính thuế."
                />
                <Kpi
                  title="Phiếu mua hàng"
                  value={b.count}
                  raw={b.count}
                  previous={prev.count}
                  description="Phiếu đã lưu và chưa hủy trong khoảng ngày được chọn."
                />
                <Kpi
                  title="Sản phẩm"
                  value={r.productCount}
                  description="Số bản ghi sản phẩm đang có, không bao gồm sách."
                />
                <Kpi
                  title="Khách truy cập"
                  value={
                    server ? (live.data?.visitors?.totalVisitors ?? "—") : r.current.uniqueVisitors
                  }
                  raw={server ? undefined : r.current.uniqueVisitors}
                  previous={server ? undefined : r.previous.uniqueVisitors}
                  description={
                    server
                      ? "Trình duyệt ẩn danh được ghi nhận trong 90 ngày gần nhất."
                      : "Số anonymous visitor khác nhau có phiên bắt đầu trong kỳ."
                  }
                />
                <Kpi
                  title={server ? "Tài khoản" : "Người dùng hoạt động"}
                  value={server ? (live.data?.accounts ?? "—") : active}
                  description={
                    server
                      ? "Tổng tài khoản trên máy chủ, gồm hoạt động và ngừng hoạt động."
                      : "Tài khoản quản trị hoạt động và có lastLogin trong kỳ."
                  }
                />
                <Kpi
                  title="Tỷ lệ chuyển đổi"
                  value="—"
                  description="Chưa có dữ liệu liên kết giữa khách truy cập và phiếu mua hàng."
                />
              </div>
              <div className="a-dashboard-grid">
                <ChartCard title="Doanh thu ghi nhận theo ngày" data={b.trend} />
                <Access resource="sales">
                  <Card>
                    <div className="a-card-head">
                      <h2>Phiếu mua hàng gần đây</h2>
                      <Link className="a-btn a-btn-sm a-btn-ghost" to="/admin/sales/slips">
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
                                  <Link to={("/admin/sales/slips/" + o.number) as "/admin"}>
                                    <strong>{o.number}</strong>
                                    <small>{o.customerSnapshot.name}</small>
                                  </Link>
                                </td>
                                <td>{money(o.total)}</td>
                                <td>
                                  <Badge
                                    tone={
                                      o.status === "saved"
                                        ? "success"
                                        : o.status === "void"
                                          ? "error"
                                          : "neutral"
                                    }
                                  >
                                    {o.status === "saved" ? "Đã lưu" : "Đã hủy"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </Access>
              </div>
              <div className="a-grid-2">
                <ChartCard title="Phiếu mua hàng theo thời gian" data={b.countTrend} kind="bar" />
                {server ? (
                  <Card>
                    <h2>Sản phẩm được quan tâm</h2>
                    {live.isPending ? (
                      <Skeleton rows={2} />
                    ) : live.data?.visitors ? (
                      <>
                        <p>{live.data.visitors.totalSessions} phiên trong 90 ngày</p>
                        <ul>
                          {live.data.visitors.products.slice(0, 10).map((product) => (
                            <li key={product.slug}>
                              {product.name} · {product.interestedVisitors} khách
                            </li>
                          ))}
                        </ul>
                        {!live.data.visitors.products.length && (
                          <p>Chưa ghi nhận sản phẩm được quan tâm.</p>
                        )}
                      </>
                    ) : (
                      <p>Không có dữ liệu được phép xem.</p>
                    )}
                  </Card>
                ) : (
                  <ChartCard title="Khách truy cập theo ngày" data={r.current.trend} kind="line" />
                )}
                <ChartCard
                  title="Giá trị sản phẩm ghi nhận theo nhóm"
                  data={categories}
                  kind="donut"
                />
                {!server && (
                  <ChartCard title="Nguồn truy cập" data={r.current.sources} kind="donut" />
                )}
                <ChartCard
                  title="Sản phẩm bán nhiều"
                  data={b.byProduct
                    .slice()
                    .sort((a, c) => c.quantity - a.quantity)
                    .slice(0, 8)
                    .map((p) => ({ name: p.name, value: p.quantity }))}
                  kind="bar"
                />
                <Access resource="products">
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
                </Access>
                {!server && (
                  <Access resource="audit">
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
                  </Access>
                )}
                <Access resource="notifications">
                  <NotificationSummary />
                </Access>
                <Access resource="analytics">
                  <Card>
                    <h2>Khách truy cập gần đây</h2>
                    {server ? (
                      <Link className="a-btn" to="/admin/analytics/visitors">
                        Xem khách truy cập trên máy chủ
                      </Link>
                    ) : (
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
                                    <Link to="/admin/analytics/visitors" search={{ visitor: v.id }}>
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
                    )}
                  </Card>
                </Access>
              </div>
            </>
          );
        })()
      )}
    </>
  );
}
