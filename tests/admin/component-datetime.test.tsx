import { it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FormExample } from "../../src/features/admin/components/forms";
it("commits native date and time input events to the visible controlled value", () => {
  for (const [name, value] of [
    ["Date Picker", "2026-11-02"],
    ["Time Picker", "14:30"],
  ]) {
    const view = render(<FormExample name={name} />);
    fireEvent.input(view.container.querySelector("input")!, { target: { value } });
    expect(screen.getByRole("status")).toHaveTextContent(value);
    cleanup();
  }
  const view = render(<FormExample name="Date Range Picker" />);
  const inputs = view.container.querySelectorAll("input");
  fireEvent.input(inputs[0], { target: { value: "2026-11-01" } });
  fireEvent.input(inputs[1], { target: { value: "2026-11-03" } });
  expect(screen.getByRole("status")).toHaveTextContent("2026-11-01 → 2026-11-03");
});
