import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { VisitorDto } from "../../../../backend/src/http/contracts";
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
export function ServerVisitorDetail({ id }: { id: string }) {
  const runtime = useAdmin(),
    api = useVisitorApi();
  const [page, setPage] = useState(1);
  const enabled = canCode(runtime.session, "customer_access.view");
  const visitor = useQuery({
    queryKey: ["bibi-admin", "http-visitor", runtime.session?.userId, id],
    enabled,
    queryFn: ({ signal }) => api.get(id, signal),
  });
  const sessions = useQuery({
    queryKey: ["bibi-admin", "http-visitor-sessions", runtime.session?.userId, id, page],
    enabled,
    queryFn: ({ signal }) => api.sessions(id, page, signal),
  });
  if (runtime.sessionLoading || visitor.isPending || sessions.isPending) return <Skeleton />;
  if (!enabled) return <ErrorState error={new Error("Bạn không có quyền xem khách truy cập")} />;
  if (visitor.error || sessions.error)
    return (
      <ErrorState
        error={visitor.error ?? sessions.error}
        onRetry={() => {
          void visitor.refetch();
          void sessions.refetch();
        }}
      />
    );
  const v = visitor.data!;
  return (
    <div className="a-detail-grid">
      <Card>
        <h2>{v.anonymousId}</h2>
        <dl className="a-key-values">
          {[
            ["IP đã che", v.ipAddress],
            ["Vị trí", [v.city, v.country].filter(Boolean).join(", ") || "Chưa xác định"],
            ["Thiết bị–Hệ điều hành", `${device(v.deviceType)}–${v.operatingSystem}`],
            ["Trình duyệt", v.browser],
            ["Số phiên", v.sessionCount],
            ["Trang khác nhau đã xem", v.distinctPageCount],
            ["Lần đầu", dateTime(v.firstSeenAt)],
            ["Lần gần nhất", dateTime(v.lastSeenAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="a-muted">
          ID ẩn danh của trình duyệt; không xác định danh tính cá nhân. Vị trí chưa được suy đoán từ
          IP.
        </p>
      </Card>
      <Card>
        <h2>Phiên và sản phẩm quan tâm</h2>
        {sessions.data!.items.map((session) => (
          <article className="a-visitor-session" key={session.id}>
            <strong>{dateTime(session.startedAt)}</strong>
            <dl className="a-key-values">
              <div>
                <dt>Trang đầu</dt>
                <dd>{session.landingPath}</dd>
              </div>
              <div>
                <dt>Trang ghi nhận gần nhất</dt>
                <dd>{session.lastReceivedPath}</dd>
              </div>
              <div>
                <dt>Trang khác nhau đã xem</dt>
                <dd>{session.distinctPageCount}</dd>
              </div>
            </dl>
            <h3>Sản phẩm quan tâm</h3>
            {session.products.length ? (
              <ul>
                {session.products.map((product) => (
                  <li key={product.slug}>{product.name}</li>
                ))}
              </ul>
            ) : (
              <p>Chưa ghi nhận sản phẩm.</p>
            )}
            <details>
              <summary>Các trang đã ghi nhận</summary>
              <ul>
                {session.pages.map((path) => (
                  <li key={path.path}>{path.path}</li>
                ))}
              </ul>
            </details>
            {session.truncated && (
              <p>Đã đạt giới hạn ghi nhận của phiên; danh sách có thể chưa đầy đủ.</p>
            )}
          </article>
        ))}
        {!sessions.data!.items.length && <p>Chưa có phiên trong thời gian lưu trữ.</p>}
        <div className="a-actions">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Phiên trước
          </Button>
          <span>Trang {page}</span>
          <Button disabled={page * 20 >= sessions.data!.total} onClick={() => setPage(page + 1)}>
            Phiên sau
          </Button>
        </div>
        <p className="a-muted">
          Mỗi trang/sản phẩm chỉ ghi một liên kết trong phiên. Đây không phải lịch sử từng thao tác
          hay thời lượng truy cập.
        </p>
      </Card>
    </div>
  );
}
export function ServerVisitors() {
  const runtime = useAdmin(),
    api = useVisitorApi();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: 20,
    search: "",
    filters: {},
  });
  const [selected, setSelected] = useState<string | null>(() =>
    typeof search.visitor === "string" ? search.visitor : null,
  );
  const enabled = canCode(runtime.session, "customer_access.view");
  const visitors = useQuery({
    queryKey: ["bibi-admin", "http-visitors", runtime.session?.userId, state],
    enabled,
    queryFn: ({ signal }) => api.list(state, signal),
  });
  const options = useQuery({
    queryKey: ["bibi-admin", "http-visitor-options", runtime.session?.userId],
    enabled,
    queryFn: ({ signal }) => api.filterOptions(signal),
  });
  const report = useQuery({
    queryKey: ["bibi-admin", "http-visitor-report", runtime.session?.userId],
    enabled,
    queryFn: ({ signal }) => api.report(signal),
  });
  const columns = useMemo<ColumnDef<VisitorDto, unknown>[]>(
    () => [
      {
        accessorKey: "anonymousId",
        header: "ID khách",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="link"
            aria-label={`Xem ${row.original.anonymousId}`}
            onClick={() => setSelected(row.original.id)}
          >
            {row.original.anonymousId}
          </Button>
        ),
      },
      { accessorKey: "ipAddress", header: "IP đã che", enableSorting: false },
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
        cell: ({ row }) => `${device(row.original.deviceType)}–${row.original.operatingSystem}`,
      },
      { accessorKey: "browser", header: "Trình duyệt", enableSorting: false },
      { accessorKey: "sessionCount", header: "Phiên", enableSorting: false },
      {
        accessorKey: "lastSeenAt",
        header: "Gần nhất",
        enableSorting: false,
        cell: ({ row }) => dateTime(row.original.lastSeenAt),
      },
    ],
    [],
  );
  if (runtime.sessionLoading) return <Skeleton />;
  if (!enabled) return <ErrorState error={new Error("Bạn không có quyền xem khách truy cập")} />;
  return (
    <>
      <PageTitle
        title="Khách truy cập"
        description="Khách ẩn danh và sản phẩm được quan tâm trong 90 ngày gần nhất. IP đã được che."
        actions={
          <Button
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
        <h2>Sản phẩm được quan tâm</h2>
        {report.isPending ? (
          <Skeleton rows={2} />
        ) : report.error ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : (
          <>
            <p>
              {report.data!.totalVisitors} khách · {report.data!.totalSessions} phiên
            </p>
            {report.data!.products.length ? (
              <ul>
                {report.data!.products.slice(0, 10).map((product) => (
                  <li key={product.slug}>
                    {product.name} · {product.interestedVisitors} khách
                  </li>
                ))}
              </ul>
            ) : (
              <p>Chưa ghi nhận sản phẩm được quan tâm.</p>
            )}
          </>
        )}
      </Card>
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
          {
            key: "product",
            label: "Sản phẩm quan tâm",
            values: options.data?.products.map((product) => ({
              value: product.slug,
              label: product.name,
            })),
          },
        ].map((filter) => (
          <label key={filter.key}>
            {filter.label}
            <select
              aria-label={filter.label}
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
      {options.error && <ErrorState error={options.error} onRetry={() => void options.refetch()} />}
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
            <strong>{v.anonymousId}</strong>
            <p>{[v.city, v.country].filter(Boolean).join(", ") || "Chưa xác định"}</p>
            <p>
              {device(v.deviceType)}–{v.operatingSystem} · {v.sessionCount} phiên
            </p>
            <Button aria-label={`Xem ${v.anonymousId}`} onClick={() => setSelected(v.id)}>
              Xem sản phẩm quan tâm
            </Button>
          </article>
        )}
      />
      <Modal
        open={!!selected}
        title="Chi tiết khách truy cập"
        description="Các trang khác nhau và sản phẩm được ghi nhận trong phiên."
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        wide
      >
        {selected && (
          <div className="a-dialog-body">
            <ServerVisitorDetail id={selected} />
          </div>
        )}
      </Modal>
    </>
  );
}
