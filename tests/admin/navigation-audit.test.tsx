import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavigationExample } from "../../src/features/admin/components/navigation";
it("shows the selected destination after choosing a dropdown item", async () => {
  render(<NavigationExample name="Dropdown Menu" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Chọn module" }));
  await user.click(screen.getByRole("menuitem", { name: "Báo cáo" }));
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn: Báo cáo");
});
it("returns focus to the root when collapsing a tree from a child with ArrowLeft", async () => {
  render(<NavigationExample name="Tree View" />);
  const user = userEvent.setup();
  const root = screen.getByRole("treeitem", { name: "▸ Bộ sưu tập Việt Nam" });
  await user.click(root);
  await user.click(screen.getByRole("treeitem", { name: "Hà Nội" }));
  await user.keyboard("{ArrowLeft}");
  expect(root).toHaveAttribute("aria-expanded", "false");
  expect(root).toHaveFocus();
});

it("keeps the tree focusable while Tab lands on the root item", async () => {
  render(<NavigationExample name="Tree View" />);
  const user = userEvent.setup();
  const tree = screen.getByRole("tree");
  const root = screen.getByRole("treeitem", { name: "▸ Bộ sưu tập Việt Nam" });
  expect(tree).toHaveAttribute("tabindex", "-1");
  await user.tab();
  expect(root).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(root).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{End}");
  expect(screen.getByRole("treeitem", { name: "Hà Nội" })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(screen.getByRole("treeitem", { name: "▸ Bộ sưu tập Việt Nam" })).toHaveFocus();
});
