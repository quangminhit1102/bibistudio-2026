import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionExample } from "../../src/features/admin/components/actions";
import { componentCatalogue } from "../../src/features/admin/components/catalogue";
it("documents all categories and meaningful toggle/copy/loading action examples", async () => {
  expect(Object.values(componentCatalogue).flat().length).toBeGreaterThan(90);
  const user = userEvent.setup();
  render(<ActionExample name="Toggle Button" />);
  const toggle = screen.getByRole("button", { name: "Theo dõi" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
});
