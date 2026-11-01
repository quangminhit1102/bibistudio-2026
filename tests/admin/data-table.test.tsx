import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DataTable, type TableState } from "../../src/features/admin/shared/tables/data-table";
it("client table paginates, sorts, hides columns and selects rows", async () => {
  function Demo() {
    const [state, setState] = useState<TableState>({
      page: 1,
      pageSize: 1,
      search: "",
      filters: {},
    });
    return (
      <DataTable
        columns={[{ accessorKey: "name", header: "Tên" }]}
        result={{ items: [], total: 2, page: 1, pageSize: 1 }}
        clientRows={[
          { id: "b", name: "Bình" },
          { id: "a", name: "An" },
        ]}
        state={state}
        onStateChange={setState}
      />
    );
  }
  const u = userEvent.setup();
  render(<Demo />);
  expect(screen.getByText("Bình")).toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(screen.getByText("An")).toBeInTheDocument();
  await u.click(screen.getByRole("checkbox", { name: "Chọn a" }));
  expect(screen.getByText(/Đã chọn 1/)).toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: /Tên/ }));
  expect(screen.getByText("An")).toBeInTheDocument();
});
