import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useAdmin, useEntity, useRole } from "../services/context";
import { can } from "../accounts/permissions";
import { adjustStock } from "../products/inventory-service";
import type { AdminProduct, AdminBook } from "../services/contracts";
import { DataTable, type TableState } from "./tables/data-table";
import { PageTitle, Button, Modal, Field, Card, useNotice } from "./ui/primitives";
import { date } from "./lib/text";
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
  const history = useEntity(
    "stock",
    { page: 1, pageSize: 30, filters: { entity }, sort: { field: "createdAt", direction: "desc" } },
    entity === "books" ? "bookstore" : "products",
  );
  const [editing, setEditing] = useState<AdminProduct | AdminBook | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const columns: ColumnDef<AdminProduct | AdminBook, unknown>[] = [
    { accessorKey: "name", header: "Sản phẩm", size: 280 },
    { accessorKey: "stock", header: "Tồn thực tế" },
    { accessorKey: "reserved", header: "Đã giữ" },
    {
      id: "available",
      header: "Khả dụng",
      cell: ({ row }) => row.original.stock - row.original.reserved,
    },
    {
      id: "adjust",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          disabled={
            !can(
              runtime.session,
              entity === "books" ? "bookstore" : "products",
              "update",
              role.data,
            )
          }
          size="sm"
          onClick={() => {
            setEditing(row.original);
            setDelta(0);
            setReason("");
            setError("");
          }}
        >
          Điều chỉnh
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageTitle
        title={entity === "books" ? "Tồn kho sách" : "Tồn kho sản phẩm"}
        description="Điều chỉnh có lý do, lịch sử và kiểm tra lượng đang giữ cho đơn hàng."
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
        <h2>Lịch sử điều chỉnh</h2>
        <div className="a-table-wrap" style={{ marginTop: 18 }}>
          <table className="a-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Sản phẩm</th>
                <th>Thay đổi</th>
                <th>Số dư</th>
                <th>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {history.data?.items.map((r) => (
                <tr key={r.id}>
                  <td>{date(r.createdAt)}</td>
                  <td>{r.entityId}</td>
                  <td>
                    {r.delta > 0 ? "+" : ""}
                    {r.delta}
                  </td>
                  <td>{r.balance}</td>
                  <td>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.data?.total && (
            <p style={{ padding: 18, color: "var(--a-muted)", fontSize: 12 }}>
              Chưa có điều chỉnh trong dữ liệu này.
            </p>
          )}
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
              await adjustStock(runtime.store, runtime.session, {
                entity,
                id: editing.id,
                delta,
                reason,
                revision: editing.revision,
              });
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
            <input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
          </Field>
          <Field label="Lý do">
            <textarea required value={reason} onChange={(e) => setReason(e.target.value)} />
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
