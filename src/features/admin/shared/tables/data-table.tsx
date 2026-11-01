import { useEffect, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Columns3,
  Search,
} from "lucide-react";
import { Button, EmptyState, ErrorState, Skeleton } from "../ui/primitives";
import type { ListResult } from "../../services/contracts";
export interface TableState {
  page: number;
  pageSize: number;
  search: string;
  filters: Record<string, string>;
  sort?: { field: string; direction: "asc" | "desc" };
  columnVisibility?: VisibilityState;
}
export function DataTable<T extends { id: string }>({
  columns,
  result,
  state,
  onStateChange,
  clientRows,
  loading,
  error,
  onRetry,
  onExport,
  selection,
  onSelectionChange,
  selectable = true,
}: {
  columns: ColumnDef<T, unknown>[];
  result: ListResult<T>;
  state: TableState;
  onStateChange: (s: TableState) => void;
  clientRows?: T[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onExport?: () => void;
  selection?: RowSelectionState;
  onSelectionChange?: (s: RowSelectionState) => void;
  selectable?: boolean;
}) {
  const [localSelection, setLocalSelection] = useState<RowSelectionState>({});
  const [showColumns, setShowColumns] = useState(false);
  const [q, setQ] = useState(state.search);
  const rowsSelected = selection ?? localSelection;
  useEffect(() => {
    const timer = setTimeout(() => {
      if (q !== state.search) onStateChange({ ...state, page: 1, search: q });
    }, 250);
    return () => clearTimeout(timer);
  }, [q, state, onStateChange]);
  const table = useReactTable({
    data: clientRows ?? result.items,
    columns,
    getRowId: (r) => r.id,
    manualPagination: !clientRows,
    manualSorting: !clientRows,
    manualFiltering: !clientRows,
    rowCount: clientRows?.length ?? result.total,
    state: {
      pagination: { pageIndex: state.page - 1, pageSize: state.pageSize },
      sorting: state.sort ? [{ id: state.sort.field, desc: state.sort.direction === "desc" }] : [],
      globalFilter: state.search,
      columnVisibility: state.columnVisibility ?? {},
      rowSelection: rowsSelected,
    },
    onSortingChange: (up) => {
      const next = typeof up === "function" ? up(table.getState().sorting) : up;
      onStateChange({
        ...state,
        page: 1,
        sort: next[0] ? { field: next[0].id, direction: next[0].desc ? "desc" : "asc" } : undefined,
      });
    },
    onColumnVisibilityChange: (up) => {
      const next = typeof up === "function" ? up(state.columnVisibility ?? {}) : up;
      onStateChange({ ...state, columnVisibility: next });
    },
    onRowSelectionChange: (up) => {
      const next = typeof up === "function" ? up(rowsSelected) : up;
      (onSelectionChange ?? setLocalSelection)(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });
  const total = clientRows ? table.getFilteredRowModel().rows.length : result.total;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  return (
    <>
      <div className="a-toolbar">
        <div style={{ position: "relative", flex: "1 1 180px", maxWidth: 300 }}>
          <Search
            size={15}
            style={{ position: "absolute", left: 10, top: 12, color: "var(--a-muted)" }}
          />
          <input
            style={{ paddingLeft: 33 }}
            aria-label="Tìm trong bảng"
            placeholder="Tìm kiếm…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button onClick={() => setShowColumns((v) => !v)} aria-expanded={showColumns}>
          <Columns3 size={14} />
          Cột
        </Button>
        {onExport && (
          <Button onClick={onExport}>
            <Download size={14} />
            Xuất CSV
          </Button>
        )}
        <span style={{ fontSize: 11, color: "var(--a-muted)", marginLeft: "auto" }}>
          {total} bản ghi
        </span>
      </div>
      {showColumns && (
        <div className="a-columns">
          {table
            .getAllLeafColumns()
            .filter((c) => c.getCanHide())
            .map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={c.getIsVisible()}
                  onChange={c.getToggleVisibilityHandler()}
                />
                {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
              </label>
            ))}
        </div>
      )}
      {Object.values(rowsSelected).filter(Boolean).length > 0 && (
        <p style={{ fontSize: 11, marginBottom: 10 }}>
          Đã chọn {Object.values(rowsSelected).filter(Boolean).length} bản ghi{" "}
          <Button
            size="sm"
            variant="link"
            onClick={() => (onSelectionChange ?? setLocalSelection)({})}
          >
            Bỏ chọn
          </Button>
        </p>
      )}
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton rows={5} />
      ) : !table.getRowModel().rows.length ? (
        <EmptyState />
      ) : (
        <div className="a-table-wrap" tabIndex={0} aria-label="Bảng dữ liệu có thể cuộn ngang">
          <table className="a-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {selectable && (
                    <th className="a-select-cell">
                      <input
                        type="checkbox"
                        aria-label="Chọn trang hiện tại"
                        checked={table.getIsAllPageRowsSelected()}
                        onChange={table.getToggleAllPageRowsSelectedHandler()}
                      />
                    </th>
                  )}
                  {hg.headers.map((h) => (
                    <th key={h.id} style={{ width: h.getSize() }}>
                      <button
                        onClick={
                          h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined
                        }
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanSort() && <ArrowDownUp size={11} aria-hidden />}
                      </button>
                      {h.column.getCanResize() && (
                        <div
                          className="a-resizer"
                          onMouseDown={h.getResizeHandler()}
                          onTouchStart={h.getResizeHandler()}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} data-selected={row.getIsSelected()}>
                  {selectable && (
                    <td className="a-select-cell">
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${row.id}`}
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="a-pagination">
        <div className="a-actions">
          <span>Dòng mỗi trang</span>
          <select
            aria-label="Số dòng mỗi trang"
            value={state.pageSize}
            onChange={(e) => onStateChange({ ...state, page: 1, pageSize: Number(e.target.value) })}
          >
            {[...new Set([state.pageSize, 10, 20, 50, 100])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n}>{n}</option>
              ))}
          </select>
        </div>
        <div className="a-actions">
          <span>
            Trang {state.page} / {pages}
          </span>
          <Button
            size="sm"
            aria-label="Trang đầu"
            disabled={state.page <= 1}
            onClick={() => onStateChange({ ...state, page: 1 })}
          >
            <ChevronsLeft size={15} />
          </Button>
          <Button
            size="sm"
            aria-label="Trang trước"
            disabled={state.page <= 1}
            onClick={() => onStateChange({ ...state, page: state.page - 1 })}
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            size="sm"
            aria-label="Trang sau"
            disabled={state.page >= pages}
            onClick={() => onStateChange({ ...state, page: state.page + 1 })}
          >
            <ChevronRight size={15} />
          </Button>
          <Button
            size="sm"
            aria-label="Trang cuối"
            disabled={state.page >= pages}
            onClick={() => onStateChange({ ...state, page: pages })}
          >
            <ChevronsRight size={15} />
          </Button>
        </div>
      </div>
    </>
  );
}
