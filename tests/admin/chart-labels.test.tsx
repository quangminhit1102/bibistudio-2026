import { it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Chart from "../../src/features/admin/shared/charts/chart";
vi.mock("recharts", () =>
  Object.fromEntries(
    [
      "ResponsiveContainer",
      "LineChart",
      "Line",
      "AreaChart",
      "Area",
      "BarChart",
      "Bar",
      "PieChart",
      "Pie",
      "Cell",
      "XAxis",
      "YAxis",
      "CartesianGrid",
      "Tooltip",
      "Legend",
    ].map((name) => [name, () => null]),
  ),
);
it("provides full labels and distinct reference metadata in mobile rankings without relying on hover", () => {
  render(
    <Chart
      kind="horizontal-bar"
      label="Theo khách hàng"
      unit="VND"
      data={[
        {
          name: "Nhà sách có tên rất dài cần đọc đầy đủ để phân biệt chi nhánh",
          reference: "KH-001",
          value: 1234567890,
        },
        {
          name: "Nhà sách có tên rất dài cần đọc đầy đủ để phân biệt chi nhánh",
          reference: "KH-002",
          value: 0,
        },
      ]}
    />,
  );
  expect(
    screen.getAllByText("Nhà sách có tên rất dài cần đọc đầy đủ để phân biệt chi nhánh"),
  ).toHaveLength(2);
  expect(screen.getByText("KH-001")).toBeInTheDocument();
  expect(screen.getByText("KH-002")).toBeInTheDocument();
  expect(
    within(screen.getAllByRole("listitem")[0]).getByText(/1\.234\.567\.890/),
  ).toBeInTheDocument();
});
