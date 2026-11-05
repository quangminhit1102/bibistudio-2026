import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { AccessLogRecord } from "../../../../backend/src/http/contracts";
import { useAdmin } from "../services/context";
import { canCode } from "../accounts/permissions";
import { createAccessLogApi } from "./http-api";
import { Button, Card, ErrorState, Modal, PageTitle, Skeleton } from "../shared/ui/primitives";
import { DataTable, type TableState } from "../shared/tables/data-table";
import { dateTime } from "../shared/lib/text";
const time = (value: string | null) => (value ? dateTime(value) : "Chưa xác định");
const kind = { page: "Trang", asset: "Tài nguyên", api: "API", other: "Khác" };
const deviceLabel = (value: string | null) =>
  ({ desktop: "Máy tính", mobile: "Di động", tablet: "Máy tính bảng", unknown: "Chưa xác định" })[
    value ?? ""
  ] ??
  value ??
  "Chưa xác định";
function Detail({
  id,
  onClose,
  api,
  identity,
  scope,
}: {
  id: string;
  onClose: () => void;
  api: ReturnType<typeof createAccessLogApi>;
  identity: string | undefined;
  scope: "current" | "archive";
}) {
  const data = useQuery({
    queryKey: ["bibi-admin", "access-log", identity, scope, id],
    queryFn: ({ signal }) => api.get(id, scope, signal),
  });
  return (
    <Modal
      open
      title="Chi tiết bản ghi"
      description="Thông tin request HTTP đã ghi nhận. IP được che."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="a-dialog-body">
        {data.isPending ? (
          <Skeleton />
        ) : data.error ? (
          <ErrorState error={data.error} onRetry={() => void data.refetch()} />
        ) : (
          <dl className="a-key-values">
            {[
              ["ID", data.data.id],
              ["Thời gian", time(data.data.occurredAt)],
              ["IP đã che", data.data.ipPrefix],
              ["Đường dẫn", data.data.pathname],
              ["Phương thức", data.data.method],
              ["HTTP", data.data.status],
              ["Số byte", data.data.bytes],
              ["Thiết bị", deviceLabel(data.data.deviceType)],
              ["Hệ điều hành", data.data.operatingSystem],
              ["Trình duyệt", data.data.browser],
              ["Nguồn giới thiệu", data.data.referrer],
              ["Nguồn", data.data.sourceName ?? data.data.sourceId],
              ["Dòng trong nguồn", data.data.ordinal],
              ["Kết quả đọc", data.data.parseStatus === "error" ? data.data.errorCode : "Đã đọc"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd style={{ overflowWrap: "anywhere" }}>{value ?? "Chưa xác định"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Modal>
  );
}
export function ServerAccessLogs() {
  const runtime = useAdmin();
  const api = useMemo(() => {
    if (!runtime.http) throw new Error("Access log API unavailable");
    return createAccessLogApi(runtime.http);
  }, [runtime.http]);
  const [state, setState] = useState<TableState>({
      page: 1,
      pageSize: 20,
      search: "",
      filters: { scope: "current" },
    }),
    [selected, setSelected] = useState<string | null>(null);
  const enabled = canCode(runtime.session, "customer_access.view");
  const identity = runtime.session?.userId;
  const scope = state.filters.scope === "archive" ? "archive" : "current";
  const logs = useQuery({
    queryKey: ["bibi-admin", "access-logs", identity, state],
    enabled,
    queryFn: ({ signal }) => api.list(state, signal),
  });
  const status = useQuery({
    queryKey: ["bibi-admin", "access-log-status", identity, scope],
    enabled,
    queryFn: ({ signal }) => api.status(scope, signal),
  });
  const columns = useMemo<ColumnDef<AccessLogRecord, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID bản ghi",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="link"
            aria-label={`Xem bản ghi ${row.original.id}`}
            onClick={() => setSelected(row.original.id)}
          >
            {row.original.id.slice(0, 10)}
          </Button>
        ),
      },
      {
        accessorKey: "occurredAt",
        header: "Thời gian",
        enableSorting: false,
        cell: ({ row }) => time(row.original.occurredAt),
      },
      { accessorKey: "ipPrefix", header: "IP đã che", enableSorting: false },
      {
        accessorKey: "pathname",
        header: "Đường dẫn",
        enableSorting: false,
        cell: ({ row }) => (
          <span style={{ overflowWrap: "anywhere" }}>
            {row.original.pathname ?? "Không đọc được dòng"}
          </span>
        ),
      },
      { accessorKey: "method", header: "Phương thức", enableSorting: false },
      { accessorKey: "status", header: "HTTP", enableSorting: false },
      {
        id: "device",
        header: "Thiết bị–Hệ điều hành",
        enableSorting: false,
        cell: ({ row }) =>
          [deviceLabel(row.original.deviceType), row.original.operatingSystem]
            .filter(Boolean)
            .join("–") || "Chưa xác định",
      },
      { accessorKey: "browser", header: "Trình duyệt", enableSorting: false },
      {
        accessorKey: "parseStatus",
        header: "Kết quả đọc",
        enableSorting: false,
        cell: ({ row }) => (row.original.parseStatus === "error" ? "Lỗi định dạng" : "Đã đọc"),
      },
    ],
    [],
  );
  const filter = (key: string, value: string) =>
    setState((old) => ({ ...old, page: 1, filters: { ...old.filters, [key]: value } }));
  if (runtime.sessionLoading) return <Skeleton />;
  if (!enabled) return <ErrorState error={new Error("Bạn không có quyền xem nhật ký truy cập")} />;
  const s = status.data;
  return (
    <>
      <PageTitle
        title="Khách truy cập"
        description="Nhật ký cPanel: mỗi dòng là một request HTTP, gồm trang, ảnh, API và bot. Đây không phải số khách hoặc phiên duy nhất."
        actions={
          <Button
            onClick={() => {
              void logs.refetch();
              void status.refetch();
            }}
          >
            Tải lại
          </Button>
        }
      />
      <Card className="a-access-log-summary">
        <div className="a-visitor-filters a-log-scope">
          <label>
            Phạm vi nhật ký
            <select
              aria-label="Phạm vi nhật ký"
              value={scope}
              onChange={(event) => {
                setSelected(null);
                setState((old) => ({
                  ...old,
                  page: 1,
                  filters: { ...old.filters, scope: event.target.value },
                }));
              }}
            >
              <option value="current">Log mới</option>
              <option value="archive">Lịch sử archive</option>
            </select>
          </label>
        </div>
        <p className="a-muted">
          {scope === "current"
            ? "Bản chụp file đang ghi; xem lịch sử lâu dài trong Lịch sử archive."
            : "Lịch sử archive đã nhập được giữ lâu dài, kể cả khi hosting xóa nguồn."}
        </p>
        <h2>Kiểm tra cập nhật mỗi 15 phút</h2>
        <p className="a-muted">IP đã che; nguồn IP hosting chưa được xác minh.</p>
        {status.isPending ? (
          <Skeleton rows={2} />
        ) : status.error ? (
          <ErrorState error={status.error} onRetry={() => void status.refetch()} />
        ) : (
          s && (
            <>
              <strong className="a-log-total">{s.total.toLocaleString("vi-VN")} bản ghi</strong>
              <p className="a-log-state" data-state={s.state} role="status">
                {
                  {
                    never: "Chưa chạy đồng bộ",
                    complete: "Đã đồng bộ",
                    pending: "Chưa đồng bộ đủ",
                    error: "Đồng bộ có lỗi",
                  }[s.state as "never" | "complete" | "pending" | "error"]
                }
              </p>
              {s.stale && (
                <p role="status">
                  Quá 45 phút hoặc chưa có lần kiểm tra; dữ liệu có thể chưa cập nhật.
                </p>
              )}
              <dl className="a-key-values">
                {[
                  ["Lần kiểm tra gần nhất", time(s.lastSyncAt)],
                  scope === "current"
                    ? ["File nguồn cập nhật", time(s.sourceModifiedAt ?? null)]
                    : ["Dữ liệu nguồn đến", time(s.sourceThrough)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <details className="a-log-notes">
                <summary>Phạm vi và trạng thái nguồn</summary>
                <p>
                  {scope === "current"
                    ? "Bản chụp được thay sau mỗi lần cập nhật thành công và có thể đổi khi hosting xoay file. Đây không phải kho lịch sử lâu dài."
                    : "Chỉ gồm các archive đã có thể nhập. Lịch sử bị hosting xóa trước khi nhập không thể phục hồi; bản ghi archive đã nhập được giữ lâu dài."}
                </p>
                <p>
                  Hai phạm vi có thể chứa cùng request và được tính riêng. Nút Tải lại lấy dữ liệu
                  đã nhập; độ mới phụ thuộc lúc hosting cập nhật nguồn. Nhật ký không xác định danh
                  tính, vị trí hoặc phiên khách.
                </p>
                <p>
                  Lần thành công gần nhất: {time(s.lastSuccessAt)} · Lỗi định dạng: {s.parseErrors}
                </p>
                <p>
                  Sớm nhất: {time(s.earliest)} · Gần nhất: {time(s.latest)}
                </p>
                {s.sources.map((source) => (
                  <p key={source.basename} style={{ overflowWrap: "anywhere" }}>
                    {source.basename} · {source.recordCount} bản ghi ·{" "}
                    {source.errorCode ??
                      {
                        complete: "Đã nhập",
                        pending: "Đang chờ",
                        error: "Có lỗi",
                        diverged: "Nguồn thay đổi",
                      }[source.state] ??
                      source.state}
                  </p>
                ))}
              </details>
            </>
          )
        )}
      </Card>
      <Card>
        <details className="a-log-filters">
          <summary>
            <span>Bộ lọc nâng cao</span>
            {Object.entries(state.filters).some(([key, value]) => key !== "scope" && value) && (
              <small>
                {" "}
                ·{" "}
                {
                  Object.entries(state.filters).filter(([key, value]) => key !== "scope" && value)
                    .length
                }{" "}
                đang dùng
              </small>
            )}
          </summary>
          <div className="a-visitor-filters">
            {(
              [
                ["from", "Từ ngày (UTC)", "date"],
                ["to", "Đến ngày (UTC)", "date"],
                ["ipPrefix", "IP đã che", "text"],
                ["pathname", "Đường dẫn chính xác", "text"],
                ["status", "Mã HTTP", "number"],
              ] as const
            ).map(([key, label, type]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={label}
                  type={type}
                  value={state.filters[key] ?? ""}
                  onChange={(e) => filter(key, e.target.value)}
                />
              </label>
            ))}
            <label>
              Nhóm tài nguyên
              <select
                aria-label="Nhóm tài nguyên"
                value={state.filters.resourceKind ?? ""}
                onChange={(e) => filter("resourceKind", e.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(kind).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bot (ước lượng)
              <select
                aria-label="Bot (ước lượng)"
                value={state.filters.isBot ?? ""}
                onChange={(e) => filter("isBot", e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="true">Có dấu hiệu bot</option>
                <option value="false">Không có dấu hiệu bot</option>
              </select>
            </label>
            <label>
              Kết quả đọc
              <select
                aria-label="Kết quả đọc"
                value={state.filters.parseStatus ?? ""}
                onChange={(e) => filter("parseStatus", e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="parsed">Đã đọc</option>
                <option value="error">Lỗi định dạng</option>
              </select>
            </label>
            <Button onClick={() => setState({ ...state, page: 1, search: "", filters: { scope } })}>
              Xóa bộ lọc
            </Button>
          </div>
        </details>
        <DataTable
          columns={columns}
          result={logs.data ?? { items: [], total: 0, page: state.page, pageSize: state.pageSize }}
          state={state}
          onStateChange={setState}
          pageSizes={[20, 50, 100]}
          selectable={false}
          loading={logs.isPending}
          error={logs.error}
          onRetry={() => void logs.refetch()}
          mobileRow={(row) => (
            <article className="a-visitor-card">
              <strong>{time(row.occurredAt)}</strong>
              <p style={{ overflowWrap: "anywhere" }}>{row.pathname ?? "Lỗi định dạng"}</p>
              <p>
                {row.method} · {row.status} · {row.ipPrefix ?? "Chưa xác định"}
              </p>
              <Button aria-label={`Xem bản ghi ${row.id}`} onClick={() => setSelected(row.id)}>
                Xem chi tiết
              </Button>
            </article>
          )}
        />
      </Card>
      {selected && (
        <Detail
          key={identity + selected}
          id={selected}
          onClose={() => setSelected(null)}
          api={api}
          identity={identity}
          scope={scope}
        />
      )}
    </>
  );
}
