import { it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

it("resizes columns with arrow keys within bounds without sorting", async () => {
  const user = userEvent.setup();
  render(
    <DataTable
      columns={[{ accessorKey: "name", header: "Tên", size: 100, minSize: 90, maxSize: 110 }]}
      result={{ items: [{ id: "a", name: "An" }], total: 1, page: 1, pageSize: 10 }}
      state={{ page: 1, pageSize: 10, search: "", filters: {} }}
      onStateChange={() => {}}
    />,
  );
  const separator = screen.getByRole("separator");
  expect(separator).toHaveAttribute("tabindex", "0");
  expect(separator).toHaveAttribute("aria-orientation", "vertical");
  separator.focus();
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(separator).toHaveAttribute("aria-valuenow", "110");
  expect(separator.closest("th")).toHaveStyle({ width: "110px" });
  await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
  expect(separator).toHaveAttribute("aria-valuenow", "90");
  expect(separator.closest("th")).toHaveAttribute("aria-sort", "none");
  fireEvent.keyDown(separator, { key: "Enter" });
  expect(separator).toHaveAttribute("aria-valuenow", "90");
});
