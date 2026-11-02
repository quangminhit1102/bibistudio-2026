import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useAdmin, useEntity, useRole } from "../../services/context";
import type { PurchaseSlip } from "../../services/contracts";
import { can } from "../../accounts/permissions";
import { DataTable, type TableState } from "../../shared/tables/data-table";
import { PageTitle, Badge, ErrorState, useNotice } from "../../shared/ui/primitives";
import { money, makeCsv, downloadBlob, dateTime } from "../../shared/lib/text";
import { useSlipOptions } from "../hooks";
import { VoidSlip } from "../components/void-slip";
export default function Slips() {
  const runtime = useAdmin(),
    role = useRole(),
    options = useSlipOptions(),
    notice = useNotice(),
    navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [columnVisibility, setColumnVisibility] = useState<TableState["columnVisibility"]>();
  const state = useMemo<TableState>(
    () => ({
      page: Math.max(1, Number(search.page) || 1),
      pageSize: [10, 20, 50, 100].includes(Number(search.size)) ? Number(search.size) : 10,
      search: String(search.q ?? ""),
      filters: Object.fromEntries(
        Object.entries(search)
          .filter(([key]) => key.startsWith("f_"))
          .map(([key, v]) => [key.slice(2), String(v)]),
      ),
      sort: {
        field: String(search.sort ?? "createdAt"),
        direction: search.dir === "asc" ? "asc" : "desc",
      },
      columnVisibility,
    }),
    [search, columnVisibility],
  );
  const update = useCallback(
    (next: TableState) => {
      setColumnVisibility(next.columnVisibility);
      const query: Record<string, string | number> = { page: next.page, size: next.pageSize };
      if (next.search) query.q = next.search;
      for (const [key, v] of Object.entries(next.filters)) if (v) query[`f_${key}`] = v;
      if (next.sort) {
        query.sort = next.sort.field;
        query.dir = next.sort.direction;
      }
      void navigate({
        to: "/admin/sales/slips" as "/admin",
        search: query as never,
        replace: true,
      });
    },
    [navigate],
  );
  const input = { ...state, filters: { ...state.filters, dateField: "createdAt" } };
  const result = useEntity("purchaseSlips", input);
  useEffect(() => {
    if (result.data && result.data.page !== state.page)
      update({ ...state, page: result.data.page });
  }, [result.data, state, update]);
  const returnTo =
    "/admin/sales/slips?" +
    new URLSearchParams(Object.entries(search).map(([k, v]) => [k, String(v)]));
  const columns: ColumnDef<PurchaseSlip, unknown>[] = [
    {
      accessorKey: "number",
      header: "Phiếu",
      cell: ({ row }) => (
        <Link to={`/admin/sales/slips/${row.id}` as "/admin"} search={{ returnTo } as never}>
          <strong>{row.original.number}</strong>
        </Link>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Ngày giờ tạo",
      cell: ({ getValue }) => dateTime(String(getValue())),
    },
    {
      id: "customer",
      accessorFn: (s) => s.customerSnapshot.name,
      header: "Khách mua hàng",
      enableSorting: false,
    },
    {
      id: "quantity",
      header: "Số lượng",
      enableSorting: false,
      cell: ({ row }) => row.original.items.reduce((n, i) => n + i.quantity, 0),
    },
    {
      accessorKey: "total",
      header: "Tổng tiền",
      cell: ({ getValue }) => money(Number(getValue())),
    },
    {
      accessorKey: "vatApplied",
      header: "VAT",
      cell: ({ getValue }) => <Badge>{getValue() ? "Có VAT" : "Không VAT"}</Badge>,
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ getValue }) => <Badge>{getValue() === "void" ? "Đã hủy" : "Đã lưu"}</Badge>,
    },
    {
      id: "actions",
      header: "Thao tác",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="a-actions">
          <Link
            className="a-btn a-btn-sm"
            to={`/admin/sales/slips/${row.id}` as "/admin"}
            search={{ returnTo } as never}
          >
            Xem
          </Link>
          {row.original.status === "saved" &&
            can(runtime.session, "sales", "update", role.data) && (
              <>
                <Link
                  className="a-btn a-btn-sm"
                  to={`/admin/sales/slips/${row.id}/edit` as "/admin"}
                  search={{ returnTo } as never}
                >
                  Sửa
                </Link>
                <VoidSlip slip={row.original} />
              </>
            )}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageTitle
        title="Phiếu mua hàng"
        description="Phiếu đã lưu ghi nhận doanh thu, không phải xác nhận tiền đã thu. Phiếu hủy không tính báo cáo."
        actions={
          can(runtime.session, "sales", "create", role.data) && (
            <Link
              to={"/admin/sales/slips/create" as "/admin"}
              search={{ returnTo } as never}
              className="a-btn a-btn-primary"
            >
              Tạo phiếu
            </Link>
          )
        }
      />
      <div className="a-toolbar">
        <select
          aria-label="Lọc khách mua hàng"
          value={state.filters.customerId ?? ""}
          onChange={(e) =>
            update({ ...state, page: 1, filters: { ...state.filters, customerId: e.target.value } })
          }
        >
          <option value="">Tất cả khách</option>
          {options.data?.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {!c.active ? " · Ngừng sử dụng" : ""}
            </option>
          ))}
        </select>
        <select
          aria-label="Trạng thái phiếu"
          value={state.filters.status ?? ""}
          onChange={(e) =>
            update({ ...state, page: 1, filters: { ...state.filters, status: e.target.value } })
          }
        >
          <option value="">Tất cả trạng thái</option>
          <option value="saved">Đã lưu</option>
          <option value="void">Đã hủy</option>
        </select>
        <select
          aria-label="VAT"
          value={state.filters.vatApplied ?? ""}
          onChange={(e) =>
            update({ ...state, page: 1, filters: { ...state.filters, vatApplied: e.target.value } })
          }
        >
          <option value="">Tất cả VAT</option>
          <option value="true">Có VAT</option>
          <option value="false">Không VAT</option>
        </select>
        <input
          type="date"
          aria-label="Lọc từ ngày"
          value={state.filters.from ?? ""}
          onChange={(e) =>
            update({ ...state, page: 1, filters: { ...state.filters, from: e.target.value } })
          }
        />
        <input
          type="date"
          aria-label="Lọc đến ngày"
          value={state.filters.to ?? ""}
          onChange={(e) =>
            update({ ...state, page: 1, filters: { ...state.filters, to: e.target.value } })
          }
        />
      </div>
      {options.error && <ErrorState error={options.error} onRetry={() => void options.refetch()} />}
      <DataTable
        columns={columns}
        state={state}
        onStateChange={update}
        result={result.data ?? { items: [], total: 0, page: state.page, pageSize: state.pageSize }}
        loading={result.isPending}
        error={result.error}
        onRetry={() => void result.refetch()}
        selectable={false}
        onExport={
          can(runtime.session, "sales", "export", role.data)
            ? async () => {
                try {
                  const all = await runtime.service("purchaseSlips").export(input);
                  downloadBlob(
                    new Blob(
                      [
                        makeCsv([
                          [
                            "Phiếu",
                            "Ngày giờ",
                            "Khách",
                            "Sản phẩm",
                            "Số lượng",
                            "Đơn giá",
                            "Tổng phiếu",
                            "VAT",
                            "Trạng thái",
                          ],
                          ...all.flatMap((s) =>
                            s.items.map((i) => [
                              s.number,
                              dateTime(s.createdAt),
                              s.customerSnapshot.name,
                              i.name,
                              i.quantity,
                              i.unitPrice,
                              s.total,
                              s.vatApplied ? "Có VAT" : "Không VAT",
                              s.status === "void" ? "Đã hủy" : "Đã lưu",
                            ]),
                          ),
                        ]),
                      ],
                      { type: "text/csv;charset=utf-8" },
                    ),
                    "phieu-mua-hang.csv",
                  );
                } catch (e) {
                  notice(e instanceof Error ? e.message : "Không thể xuất phiếu", "error");
                }
              }
            : undefined
        }
      />
    </>
  );
}
