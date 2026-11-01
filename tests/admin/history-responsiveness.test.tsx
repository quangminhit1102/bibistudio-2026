import { Component, Profiler, useState, type ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DataTable, type TableState } from "../../src/features/admin/shared/tables/data-table";

class RenderBudgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">Table exceeded render budget</p>
    ) : (
      this.props.children
    );
  }
}

it("a sorted client table settles after rendering and remains navigable", async () => {
  const rows = [
    { id: "event-1", at: "2026-11-01", name: "Phiếu mới" },
    { id: "event-2", at: "2026-10-31", name: "Phiếu cũ" },
  ];
  const columns = [
    { accessorKey: "name", header: "Phiếu" },
    { accessorKey: "at", header: "Thời điểm" },
  ];
  let commits = 0;
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  function HistoryFlow() {
    const [page, setPage] = useState("history");
    const [state, setState] = useState<TableState>({
      page: 1,
      pageSize: 1,
      search: "",
      filters: {},
      sort: { field: "at", direction: "desc" },
    });
    return (
      <>
        <button onClick={() => setPage("transactions")}>Giao dịch</button>
        {page === "transactions" ? (
          <h1>Giao dịch mô phỏng</h1>
        ) : (
          <DataTable
            columns={columns}
            result={{ items: [], total: rows.length, page: state.page, pageSize: state.pageSize }}
            clientRows={rows}
            state={state}
            onStateChange={setState}
            selectable={false}
          />
        )}
      </>
    );
  }
  try {
    render(
      <RenderBudgetBoundary>
        <Profiler
          id="history"
          onRender={() => {
            // Stop a real update loop so the regression test itself cannot hang.
            if (++commits > 40) throw new Error("Unbounded table updates");
          }}
        >
          <HistoryFlow />
        </Profiler>
      </RenderBudgetBoundary>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(screen.getByRole("button", { name: "Cột", exact: true }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trang sau", exact: true }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText("Phiếu cũ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Giao dịch", exact: true }));
    expect(screen.getByRole("heading", { name: "Giao dịch mô phỏng" })).toBeInTheDocument();
  } finally {
    errors.mockRestore();
  }
});
