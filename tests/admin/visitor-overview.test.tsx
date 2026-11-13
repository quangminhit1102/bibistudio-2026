import { expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VisitorFilters } from "../../src/features/admin/analytics/components/visitor-filters";
test("visitor controls expose only date fields and block invalid custom range", () => {
  const apply = vi.fn();
  const { container } = render(
    <VisitorFilters dates={{ from: "2026-10-14", to: "2026-11-13" }} onApply={apply} />,
  );
  for (const label of ["1 tháng", "6 tháng", "1 năm", "Khoảng ngày"])
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1 tháng" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Khoảng ngày" }));
  expect(container.querySelectorAll('input[type="date"]')).toHaveLength(2);
  expect(container.querySelector('input[type="time"], input[type="datetime-local"]')).toBeNull();
  fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-11-14" } });
  expect(screen.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-11-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
  expect(apply).toHaveBeenCalledWith({ from: "2026-11-01", to: "2026-11-13" });
});
