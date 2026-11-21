import { expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RefreshButton } from "../../src/features/admin/shared/ui/refresh-button";
test("manual refresh uses shared label and disables repeated requests while loading", () => {
  const refresh = vi.fn();
  const view = render(<RefreshButton onClick={refresh} />);
  fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
  expect(refresh).toHaveBeenCalledTimes(1);
  view.rerender(<RefreshButton loading onClick={refresh} />);
  expect(screen.getByRole("button", { name: "Làm mới" })).toBeDisabled();
});
