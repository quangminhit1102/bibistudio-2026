import { useMemo, useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { VisitorDto, VisitorScopeInput } from "../../../../backend/src/http/contracts";
import { VisitorFilters } from "./components/visitor-filters";
import { resolveFilterDates } from "./visitor-date-filter";
import { VisitorSessionsChart, VisitorProductsChart } from "./visitor-charts";
import { VisitorSessionList } from "./components/visitor-session-list";
import { useAdmin } from "../services/context";
import { canCode } from "../accounts/permissions";
import { createVisitorApi } from "./http-api";
import { Button, Card, ErrorState, Modal, PageTitle, Skeleton } from "../shared/ui/primitives";
import { DataTable, type TableState } from "../shared/tables/data-table";
import { dateTime } from "../shared/lib/text";

function useVisitorApi() {
  const { http } = useAdmin();
  return useMemo(() => {
    if (!http) throw new Error("Visitor API unavailable");
    return createVisitorApi(http);
  }, [http]);
}
const device = (value: string) =>
  ({ mobile: "Di động", tablet: "Máy tính bảng", desktop: "Máy tính" })[value] ?? value;
export function ServerVisitorDetail({ id, scope }: { id: string; scope?: VisitorScopeInput }) {
  const runtime = useAdmin(),
    api = useVisitorApi();
  const [defaultDates] = useState(() => resolveFilterDates({ preset: "1m" }));
  const filter = scope ?? defaultDates;
  const enabled = canCode(runtime.session, "customer_access.view");
  const visitor = useQuery({
    queryKey: ["bibi-admin", "http-visitor", runtime.session?.userId, id, filter],
    enabled,
    queryFn: ({ signal }) => api.get(id, signal, filter),
  });
  const history = useInfiniteQuery({
    queryKey: ["bibi-admin", "visitor-history", runtime.session?.userId, id, filter],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) => api.sessionHistory(id, filter, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (runtime.sessionLoading) return <Skeleton />;
  if (!enabled) return <ErrorState error={new Error("Bạn không có quyền xem khách truy cập")} />;
  if (visitor.isPending || history.isPending) return <Skeleton />;
  if (visitor.error || (!history.data && history.error))
    return (
      <ErrorState
        error={visitor.error ?? history.error}
        onRetry={() => {
          void visitor.refetch();
          void history.refetch();
        }}
      />
    );
  const v = visitor.data!;
  const sessions = [
    ...new Map(
      history.data!.pages.flatMap((page) => page.items).map((session) => [session.id, session]),
    ).values(),
  ];
  return (
    <div className="a-visitor-detail">
      <Card>
        <h2>Thông tin truy cập</h2>
        <dl className="a-key-values">
          {[
            ["IP công khai", v.ipStatus === "verified" ? v.ipAddress : "Chưa xác định"],
            ["Vị trí", [v.city, v.country].filter(Boolean).join(", ") || "Chưa xác định"],
            ["Thiết bị–Hệ điều hành", `${device(v.deviceType)} · ${v.operatingSystem}`],
            ["Trình duyệt", v.browser],
            ["Số phiên trong khoảng ngày", v.sessionCount],
            ["Trang khác nhau đã ghi nhận", v.distinctPageCount],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="a-visitor-ip">{value}</dd>
            </div>
          ))}
        </dl>
        {v.ipStatus !== "verified" && (
          <p className="a-muted">
            Nguồn IP chưa xác minh; dữ liệu cũ không có IP công khai đầy đủ.
          </p>
        )}
      </Card>
      <Card>
        <h2>Các phiên truy cập</h2>
        <p className="a-muted">
          Phiên được chọn theo ngày bắt đầu; danh sách URL bao gồm cả hoạt động tiếp nối sau khoảng
          ngày lọc.
        </p>
        <VisitorSessionList
          items={sessions}
          hasMore={history.hasNextPage}
          loading={history.isFetchingNextPage}
          error={history.isFetchNextPageError ? history.error : undefined}
          onMore={() => {
            if (!history.isFetchingNextPage) void history.fetchNextPage();
          }}
        />
      </Card>
    </div>
  );
}
export function ServerVisitors() {
  const runtime = useAdmin(),
    api = useVisitorApi();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [state, setState] = useState<TableState>(() => ({
    page: 1,
    pageSize: 20,
    search: "",
    filters: { ...resolveFilterDates({ preset: "1m" }) },
  }));
  const [selected, setSelected] = useState<string | null>(() =>
    typeof search.visitor === "string" ? search.visitor : null,
  );
  const [allProducts, setAllProducts] = useState(false);
  const scope = useMemo<VisitorScopeInput>(
    () => ({
      from: state.filters.from,
      to: state.filters.to,
      search: state.search,
      deviceType: (state.filters.deviceType || undefined) as VisitorScopeInput["deviceType"],
      browser: state.filters.browser || undefined,
    }),
    [state.filters, state.search],
  );
  const enabled = canCode(runtime.session, "customer_access.view");
  const visitors = useQuery({
    queryKey: ["bibi-admin", "http-visitors", runtime.session?.userId, state],
    enabled,
    queryFn: ({ signal }) => api.list(state, signal),
  });
  const options = useQuery({
    queryKey: ["bibi-admin", "http-visitor-options", runtime.session?.userId, scope],
    enabled,
    queryFn: ({ signal }) => api.filterOptions(signal, scope),
  });
  const report = useQuery({
    queryKey: ["bibi-admin", "http-visitor-report", runtime.session?.userId, scope],
    enabled,
    queryFn: ({ signal }) => api.report(signal, scope),
  });
  const columns = useMemo<ColumnDef<VisitorDto, unknown>[]>(
    () => [
      {
        id: "index",
        header: "STT",
        enableSorting: false,
        cell: ({ row }) => (state.page - 1) * state.pageSize + row.index + 1,
      },
      {
        id: "ip",
        header: "IP công khai",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="a-visitor-ip">
            {row.original.ipStatus === "verified" ? row.original.ipAddress : "Chưa xác định"}
          </span>
        ),
      },
      {
        id: "location",
        header: "Vị trí",
        enableSorting: false,
        cell: ({ row }) =>
          [row.original.city, row.original.country].filter(Boolean).join(", ") || "Chưa xác định",
      },
      {
        id: "device",
        header: "Thiết bị–Hệ điều hành",
        enableSorting: false,
        cell: ({ row }) => `${device(row.original.deviceType)} · ${row.original.operatingSystem}`,
      },
      { accessorKey: "browser", header: "Trình duyệt", enableSorting: false },
      { accessorKey: "sessionCount", header: "Phiên", enableSorting: false },
      {
        accessorKey: "lastSeenAt",
        header: "Gần nhất",
        enableSorting: false,
        cell: ({ row }) => dateTime(row.original.lastSeenAt),
      },
      {
        id: "detail",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            aria-label={`Chi tiết khách ${(state.page - 1) * state.pageSize + row.index + 1}`}
            onClick={() => setSelected(row.original.id)}
          >
            Chi tiết
          </Button>
        ),
      },
    ],
    [state.page, state.pageSize],
  );
  if (runtime.sessionLoading) return <Skeleton />;
  if (!enabled) return <ErrorState error={new Error("Bạn không có quyền xem khách truy cập")} />;
  return (
    <div className="a-visitor-overview">
      <PageTitle
        title="Khách truy cập"
        description="Lịch sử phiên truy cập và sản phẩm được quan tâm."
        actions={
          <Button
            disabled={visitors.isFetching || report.isFetching}
            onClick={() => {
              void visitors.refetch();
              void options.refetch();
              void report.refetch();
            }}
          >
            Tải lại
          </Button>
        }
      />
      <Card>
        <VisitorFilters
          dates={{ from: scope.from, to: scope.to }}
          onApply={(dates) =>
            setState((current) => ({
              ...current,
              page: 1,
              filters: { ...current.filters, ...dates },
            }))
          }
        />
        <div className="a-visitor-filters">
          {[
            {
              key: "deviceType",
              label: "Thiết bị",
              values: options.data?.deviceTypes.map((value) => ({ value, label: device(value) })),
            },
            {
              key: "browser",
              label: "Trình duyệt",
              values: options.data?.browsers.map((value) => ({ value, label: value })),
            },
          ].map((filter) => (
            <label key={filter.key}>
              {filter.label}
              <select
                value={state.filters[filter.key] ?? ""}
                onChange={(event) =>
                  setState({
                    ...state,
                    page: 1,
                    filters: { ...state.filters, [filter.key]: event.target.value },
                  })
                }
              >
                <option value="">Tất cả</option>
                {filter.values?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="a-muted">
          Dữ liệu được tính theo thời điểm bắt đầu phiên. Số khách là số trình duyệt được ghi nhận,
          không phải số người duy nhất.
        </p>
        {options.error && (
          <ErrorState error={options.error} onRetry={() => void options.refetch()} />
        )}
      </Card>
      {report.isPending ? (
        <Skeleton rows={3} />
      ) : report.error ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <div className="a-visitor-kpis">
            {[
              ["Tổng lượt truy cập", report.data.totalSessions],
              ["Khách truy cập", report.data.totalVisitors],
              ["Khách quan tâm sản phẩm", report.data.totalInterestedVisitors ?? 0],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <span className="a-kpi-label">{label}</span>
                <strong className="a-kpi-value">{Number(value).toLocaleString("vi-VN")}</strong>
              </Card>
            ))}
          </div>
          <Card>
            <h2>Lượt truy cập theo thời gian</h2>
            <p className="a-muted">
              Mỗi lượt tương ứng một phiên; tải lại trang không tự tạo lượt mới.
            </p>
            <VisitorSessionsChart report={report.data} />
          </Card>
        </>
      )}
      <Card>
        <h2>Danh sách khách truy cập</h2>
        <p className="a-muted">
          IP chỉ hiển thị khi nguồn từ hosting đã được xác minh. Lịch sử cũ không thể khôi phục IP
          đầy đủ.
        </p>
        <DataTable
          columns={columns}
          result={
            visitors.data ?? { items: [], total: 0, page: state.page, pageSize: state.pageSize }
          }
          state={state}
          onStateChange={setState}
          selectable={false}
          loading={visitors.isPending}
          error={visitors.error}
          onRetry={() => void visitors.refetch()}
          mobileRow={(v) => (
            <article className="a-visitor-card">
              <strong className="a-visitor-ip">
                {v.ipStatus === "verified" ? v.ipAddress : "Chưa xác định"}
              </strong>
              <p>
                {device(v.deviceType)} · {v.operatingSystem} · {v.browser}
              </p>
              <p>
                {v.sessionCount} phiên · {dateTime(v.lastSeenAt)}
              </p>
              <Button onClick={() => setSelected(v.id)}>Chi tiết</Button>
            </article>
          )}
        />
      </Card>
      <Card>
        <div className="a-visitor-section-heading">
          <div>
            <h2>Sản phẩm được quan tâm</h2>
            <p className="a-muted">
              Top 10 · Mỗi trình duyệt chỉ tính một lần cho mỗi sản phẩm trong khoảng ngày đã chọn.
            </p>
          </div>
          <Button onClick={() => setAllProducts(true)}>Xem tất cả</Button>
        </div>
        {report.isPending ? (
          <Skeleton />
        ) : report.error ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : (
          <VisitorProductsChart report={report.data} />
        )}
      </Card>
      <Modal
        open={!!selected}
        title="Chi tiết khách truy cập"
        description="Phiên bắt đầu trong khoảng ngày đã chọn, cùng toàn bộ trang đã ghi nhận trong mỗi phiên."
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        wide
      >
        {selected && (
          <div className="a-dialog-body">
            <ServerVisitorDetail
              key={selected + JSON.stringify(scope)}
              id={selected}
              scope={scope}
            />
          </div>
        )}
      </Modal>
      <Modal
        open={allProducts}
        title="Tất cả sản phẩm được quan tâm"
        onOpenChange={setAllProducts}
        wide
      >
        {allProducts && <VisitorProductTable key={JSON.stringify(scope)} scope={scope} />}
      </Modal>
    </div>
  );
}
function VisitorProductTable({ scope }: { scope: VisitorScopeInput }) {
  const api = useVisitorApi();
  const [page, setPage] = useState(1);
  const result = useQuery({
    queryKey: ["bibi-admin", "visitor-products", scope, page],
    queryFn: ({ signal }) => api.productReport(scope, page, signal),
  });
  return (
    <div className="a-dialog-body">
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        <>
          <table className="a-visitor-products-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Khách quan tâm</th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((product) => (
                <tr key={product.slug}>
                  <td>{product.name}</td>
                  <td>{product.interestedVisitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.data.total && <p>Chưa ghi nhận sản phẩm trong khoảng ngày này.</p>}
          <div className="a-actions">
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Trang trước
            </Button>
            <span>
              Trang {page} · {result.data.total} sản phẩm
            </span>
            <Button disabled={page * 20 >= result.data.total} onClick={() => setPage(page + 1)}>
              Trang sau
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
