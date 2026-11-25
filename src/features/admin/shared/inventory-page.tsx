import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useAdmin, useEntity, useRole } from "../services/context";
import { can } from "../accounts/permissions";
import { adjustStock, listStockMovements } from "../products/inventory-service";
import type { AdminProduct, AdminBook } from "../services/contracts";
import { DataTable, type TableState } from "./tables/data-table";
import {
  PageTitle,
  Button,
  Modal,
  Field,
  Card,
  ErrorState,
  Skeleton,
  useNotice,
} from "./ui/primitives";
import { dateTime } from "./lib/text";
export function InventoryPage({ entity }: { entity: "products" | "books" }) {
  const runtime = useAdmin();
  const role = useRole();
  const notice = useNotice();
  const client = useQueryClient();
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: 10,
    search: "",
    filters: {},
  });
  const records = useEntity(entity, state);
  const [historyPage, setHistoryPage] = useState(1);
  const [productId, setProductId] = useState("");
  const history = useQuery({
    queryKey: ["bibi-admin", "stock-movements", entity, historyPage, productId, runtime.session],
    enabled:
      !!runtime.session &&
      can(runtime.session, entity === "books" ? "bookstore" : "products", "view", role.data),
    queryFn: async ({ signal }) => {
      if (runtime.session?.kind !== "http" || entity === "books") await runtime.ensure("stock");
      return listStockMovements(
        runtime.store,
        runtime.session,
        { entity, page: historyPage, productId },
        runtime.http,
        signal,
      );
    },
  });
  const historyProducts = useMemo(() => {
    const names = new Map(records.data?.items.map((r) => [r.id, r.name]));
    for (const r of history.data?.items ?? []) names.set(r.productId, r.productName);
    if (productId && !names.has(productId)) names.set(productId, productId);
    return [...names];
  }, [records.data, history.data, productId]);
  const [editing, setEditing] = useState<AdminProduct | AdminBook | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canUpdate = can(
    runtime.session,
    entity === "books" ? "bookstore" : "products",
    "update",
    role.data,
  );
  const columns = useMemo<ColumnDef<AdminProduct | AdminBook, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Sản phẩm", size: 280 },
      { accessorKey: "stock", header: "Số lượng tồn" },
      {
        id: "adjust",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            disabled={!canUpdate}
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDelta(0);
              setReason("");
              setError("");
            }}
          >
            Điều chỉnh thủ công
          </Button>
        ),
      },
    ],
    [canUpdate],
  );
  return (
    <>
      <PageTitle
        title={entity === "books" ? "Tồn kho sách" : "Tồn kho sản phẩm"}
        description="Điều chỉnh thủ công có lý do và lưu lịch sử thay đổi."
      />
      <DataTable
        columns={columns}
        result={records.data ?? { items: [], total: 0, page: state.page, pageSize: state.pageSize }}
        state={state}
        onStateChange={setState}
        loading={records.isPending}
        error={records.error}
        onRetry={() => void records.refetch()}
        selectable={false}
      />
      <Card className="a-inventory-history">
        <h2>Lịch sử thay đổi</h2>
        <Field label="Lọc lịch sử theo sản phẩm">
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setHistoryPage(1);
            }}
          >
            <option value="">Tất cả sản phẩm</option>
            {historyProducts.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        {history.isPending && <Skeleton rows={3} />}
        {history.error && (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        )}
        <div className="a-table-wrap" style={{ marginTop: 18 }}>
          <table className="a-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Sản phẩm</th>
                <th>Thay đổi</th>
                <th>Trước → sau</th>
                <th>Lý do</th>
                <th>Người sửa</th>
              </tr>
            </thead>
            <tbody>
              {history.data?.items.map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.createdAt)}</td>
                  <td>{r.productName}</td>
                  <td>
                    {r.delta > 0 ? "+" : ""}
                    {r.delta}
                  </td>
                  <td>
                    {r.stockBefore} → {r.stockAfter}
                  </td>
                  <td>{r.reason}</td>
                  <td>{r.actorName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.data?.total === 0 && (
            <p style={{ padding: 18, color: "var(--a-muted)", fontSize: 12 }}>
              Chưa có điều chỉnh trong dữ liệu này.
            </p>
          )}
        </div>
        <div className="a-form-footer">
          <Button
            aria-label="Lịch sử trước"
            disabled={historyPage === 1 || history.isFetching}
            onClick={() => setHistoryPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span>
            Trang {historyPage} / {Math.max(1, Math.ceil((history.data?.total ?? 0) / 30))}
          </span>
          <Button
            aria-label="Lịch sử tiếp"
            disabled={!history.data || historyPage * 30 >= history.data.total || history.isFetching}
            onClick={() => setHistoryPage((p) => p + 1)}
          >
            Tiếp
          </Button>
        </div>
      </Card>
      <Modal
        open={!!editing}
        onOpenChange={(v) => {
          if (!v && !busy) setEditing(null);
        }}
        title="Điều chỉnh tồn kho"
      >
        <form
          className="a-dialog-body"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editing) return;
            setBusy(true);
            setError("");
            try {
              await adjustStock(
                runtime.store,
                runtime.session,
                {
                  entity,
                  id: editing.id,
                  delta,
                  reason,
                  revision: editing.revision,
                },
                runtime.http,
              );
              await client.invalidateQueries({ queryKey: ["bibi-admin"] });
              notice("Đã cập nhật tồn kho và lịch sử.");
              setEditing(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Thao tác thất bại");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p style={{ marginBottom: 18 }}>{editing?.name}</p>
          <Field label="Thay đổi số lượng (+ nhập / − xuất)">
            <input
              type="number"
              required
              step={1}
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
            />
          </Field>
          <p>Tồn sau điều chỉnh: {(editing?.stock ?? 0) + delta}</p>
          <Field label="Lý do">
            <textarea
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {error && (
            <p className="a-error" role="alert">
              {error}
            </p>
          )}
          <div className="a-form-footer">
            <Button type="submit" variant="primary" loading={busy}>
              Lưu điều chỉnh
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
