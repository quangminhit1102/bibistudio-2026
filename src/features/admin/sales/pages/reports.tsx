import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useAdmin, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { ChartCard, Kpi } from "../../shared/charts/blocks";
import {
  PageTitle,
  Button,
  Card,
  Skeleton,
  ErrorState,
  EmptyState,
} from "../../shared/ui/primitives";
import { DataTable, type TableState } from "../../shared/tables/data-table";
import { downloadBlob, money } from "../../shared/lib/text";
import {
  loadSlipReport,
  loadSlipReportChoices,
  slipReportCsv,
  vietnamYear,
  type SlipSummary,
} from "../slip-aggregate";
function SummaryTable<T extends { id: string }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: ColumnDef<T, unknown>[];
}) {
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: 10,
    search: "",
    filters: {},
    sort: { field: "value", direction: "desc" },
  });
  return (
    <DataTable
      columns={columns}
      clientRows={rows}
      state={state}
      onStateChange={setState}
      result={{ items: rows, total: rows.length, page: state.page, pageSize: state.pageSize }}
      selectable={false}
    />
  );
}
const customerColumns: ColumnDef<SlipSummary["byCustomer"][number], unknown>[] = [
  { accessorKey: "id", header: "Mã khách" },
  { accessorKey: "name", header: "Khách mua hàng" },
  { accessorKey: "count", header: "Số phiếu" },
  {
    accessorKey: "value",
    header: "Tổng giá trị",
    cell: ({ getValue }) => money(Number(getValue())),
  },
];
const productColumns: ColumnDef<SlipSummary["byProduct"][number], unknown>[] = [
  { accessorKey: "sku", header: "SKU" },
  { accessorKey: "name", header: "Sản phẩm" },
  { accessorKey: "quantity", header: "Tổng số lượng" },
  {
    accessorKey: "value",
    header: "Tổng giá trị",
    cell: ({ getValue }) => money(Number(getValue())),
  },
];
export default function Reports() {
  const runtime = useAdmin(),
    role = useRole(),
    navigate = useNavigate(),
    search = useSearch({ strict: false }) as Record<string, unknown>;
  const [metric, setMetric] = useState("quantity");
  const choices = useQuery({
    queryKey: ["bibi-admin", "slip-report-choices", runtime.session?.userId],
    enabled: !!runtime.session,
    queryFn: () => loadSlipReportChoices(runtime.store, runtime.session),
  });
  const requested = Number(search.year),
    year = choices.data?.years.includes(requested) ? requested : vietnamYear();
  const customerId = typeof search.customerId === "string" ? search.customerId : undefined;
  const result = useQuery({
    queryKey: ["bibi-admin", "slip-report", year, customerId, runtime.session?.userId],
    enabled: !!choices.data,
    queryFn: () => loadSlipReport(runtime.store, runtime.session, { year, customerId }),
  });
  const filter = (next: { year?: number; customerId?: string }) =>
    void navigate({
      to: "/admin/sales/reports",
      search: { year, customerId, ...next } as never,
      replace: true,
    });
  const key = `${year}:${customerId ?? "all"}`;
  return (
    <>
      <PageTitle
        title="Báo cáo kinh doanh"
        description="Doanh thu ghi nhận từ phiếu đã lưu, không phải tiền đã thu. Loại phiếu hủy; không tự cộng hoặc bóc VAT."
        actions={
          result.data &&
          can(runtime.session, "sales", "export", role.data) && (
            <Button
              onClick={() =>
                downloadBlob(
                  new Blob([slipReportCsv(result.data!)], { type: "text/csv;charset=utf-8" }),
                  `bao-cao-${year}.csv`,
                )
              }
            >
              Xuất báo cáo CSV
            </Button>
          )
        }
      />
      {choices.isPending ? (
        <Skeleton />
      ) : choices.error ? (
        <ErrorState error={choices.error} onRetry={() => void choices.refetch()} />
      ) : (
        <div className="a-toolbar">
          <label className="a-field">
            Năm
            <select
              aria-label="Năm"
              value={year}
              onChange={(e) => filter({ year: Number(e.target.value) })}
            >
              {choices.data.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="a-field">
            Khách mua hàng
            <select
              aria-label="Khách mua hàng"
              value={customerId ?? ""}
              onChange={(e) => filter({ customerId: e.target.value || undefined })}
            >
              <option value="">Tất cả khách</option>
              {choices.data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.id.slice(0, 12)}
                  {!c.active ? " · Ngừng sử dụng" : ""}
                </option>
              ))}
            </select>
          </label>
          <small>Dữ liệu demo · Năm theo giờ Việt Nam</small>
        </div>
      )}
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        result.data && (
          <>
            <div className="a-kpis">
              <div role="status" aria-label="Tổng doanh thu ghi nhận">
                <Kpi
                  title="Doanh thu ghi nhận"
                  value={money(result.data.total)}
                  description="Tổng phiếu đã lưu, chưa hủy trong bộ lọc; không phải tiền đã thu."
                />
              </div>
              <Kpi
                title="Phiếu đã lưu"
                value={result.data.count}
                description="Phiếu hợp lệ trong bộ lọc."
              />
              <Kpi
                title="Phiếu hủy không tính"
                value={result.data.voidCount}
                description="Các phiếu hủy được loại khỏi tổng."
              />
            </div>
            {!result.data.count && (
              <EmptyState
                title="Chưa có phiếu trong bộ lọc này"
                description="Chọn năm/khách khác hoặc lập phiếu mua hàng."
              />
            )}
            <section aria-label="Doanh thu theo khách">
              <h2>Doanh thu theo khách hàng trong năm {year}</h2>
              <p>Biểu đồ Top 10 · Bảng và CSV gồm toàn bộ khách trong bộ lọc.</p>
              <div className="a-grid-2">
                <ChartCard
                  title="Top 10 khách theo doanh thu (VND)"
                  kind="horizontal-bar"
                  unit="VND"
                  data={result.data.byCustomer
                    .slice(0, 10)
                    .map((c) => ({ name: `${c.name} · ${c.id.slice(0, 12)}`, value: c.value }))}
                />
                <Card>
                  <SummaryTable key={key} rows={result.data.byCustomer} columns={customerColumns} />
                </Card>
              </div>
            </section>
            <section aria-label="Tổng kết sản phẩm">
              <h2>Tổng kết sản phẩm</h2>
              <div className="a-toolbar">
                <label className="a-field">
                  Chỉ tiêu biểu đồ
                  <select
                    aria-label="Chỉ tiêu sản phẩm"
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                  >
                    <option value="quantity">Số lượng</option>
                    <option value="value">Giá trị (VND)</option>
                  </select>
                </label>
                <small>Biểu đồ Top 10 · Bảng và CSV gồm toàn bộ sản phẩm.</small>
              </div>
              <div className="a-grid-2">
                <ChartCard
                  title={
                    metric === "quantity"
                      ? "Top 10 sản phẩm theo số lượng"
                      : "Top 10 sản phẩm theo giá trị (VND)"
                  }
                  kind="horizontal-bar"
                  unit={metric === "quantity" ? "quantity" : "VND"}
                  data={[...result.data.byProduct]
                    .sort((a, b) =>
                      metric === "quantity" ? b.quantity - a.quantity : b.value - a.value,
                    )
                    .slice(0, 10)
                    .map((p) => ({
                      name: `${p.sku} · ${p.name}`,
                      value: metric === "quantity" ? p.quantity : p.value,
                    }))}
                />
                <Card>
                  <SummaryTable key={key} rows={result.data.byProduct} columns={productColumns} />
                </Card>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
