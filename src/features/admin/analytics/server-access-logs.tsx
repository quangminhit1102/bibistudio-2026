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
function Detail({
  id,
  onClose,
  api,
  identity,
}: {
  id: string;
  onClose: () => void;
  api: ReturnType<typeof createAccessLogApi>;
  identity: string | undefined;
}) {
  const data = useQuery({
    queryKey: ["bibi-admin", "access-log", identity, id],
    queryFn: ({ signal }) => api.get(id, signal),
  });
  return (
    <Modal
      open
      title="Chi tiết bản ghi"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
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
            ["Thiết bị", data.data.deviceType],
            ["Hệ điều hành", data.data.operatingSystem],
            ["Trình duyệt", data.data.browser],
            ["Nguồn giới thiệu", data.data.referrer],
            ["ID nguồn", data.data.sourceId],
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
      filters: {},
    }),
    [selected, setSelected] = useState<string | null>(null);
  const enabled = canCode(runtime.session, "customer_access.view");
  const identity = runtime.session?.userId;
  const logs = useQuery({
    queryKey: ["bibi-admin", "access-logs", identity, state],
    enabled,
    queryFn: ({ signal }) => api.list(state, signal),
  });
  const status = useQuery({
    queryKey: ["bibi-admin", "access-log-status", identity],
    enabled,
    queryFn: ({ signal }) => api.status(signal),
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
          [row.original.deviceType, row.original.operatingSystem].filter(Boolean).join("–") ||
          "Chưa xác định",
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
      <Card>
        <h2>Kiểm tra cập nhật mỗi 15 phút</h2>
        <p className="a-muted">
          Nút Tải lại lấy dữ liệu đã nhập mới nhất. Thời điểm có bản ghi mới còn phụ thuộc lúc
          hosting cập nhật log nguồn.
        </p>
        <p className="a-muted">
          IP lấy từ log hosting, đã che và chưa xác minh nguồn IP thực. Nhật ký vận hành tách riêng
          với thống kê sản phẩm; không suy đoán vị trí hay danh tính.
        </p>
        {status.isPending ? (
          <Skeleton rows={2} />
        ) : status.error ? (
          <ErrorState error={status.error} onRetry={() => void status.refetch()} />
        ) : (
          s && (
            <>
              <strong>{s.total.toLocaleString("vi-VN")} bản ghi</strong>
              <p>
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
                  ["Lần chạy gần nhất", time(s.lastSyncAt)],
                  ["Lần thành công gần nhất", time(s.lastSuccessAt)],
                  ["Dữ liệu nguồn đến", time(s.sourceThrough)],
                  ["Lỗi định dạng", s.parseErrors],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <details>
                <summary>Phạm vi và trạng thái nguồn</summary>
                <p>
                  Chỉ gồm các archive đã có thể nhập. Lịch sử bị hosting xóa trước khi nhập không
                  thể phục hồi. Bản ghi đã nhập được giữ trong cơ sở dữ liệu.
                </p>
                <p>
                  Sớm nhất: {time(s.earliest)} · Gần nhất: {time(s.latest)}
                </p>
                {s.sources.map((source) => (
                  <p key={source.basename} style={{ overflowWrap: "anywhere" }}>
                    {source.basename} · {source.recordCount} bản ghi ·{" "}
                    {source.errorCode ?? source.state}
                  </p>
                ))}
              </details>
            </>
          )
        )}
      </Card>
      <Card>
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
          <Button onClick={() => setState({ ...state, page: 1, search: "", filters: {} })}>
            Xóa bộ lọc
          </Button>
        </div>
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
        />
      )}
    </>
  );
}
