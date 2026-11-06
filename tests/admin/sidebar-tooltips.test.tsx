import { expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarNavigation } from "../../src/features/admin/shell/sidebar-navigation";
import { navigation } from "../../src/features/admin/shell/navigation";
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    activeOptions: _,
    ...props
  }: React.PropsWithChildren<{ to: string; activeOptions: unknown }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
function Menu({ collapsed = true }: { collapsed?: boolean }) {
  return (
    <SidebarNavigation
      collapsed={collapsed}
      groups={navigation.slice(0, 1)}
      pathname="/admin/analytics/visitors"
      open={new Set(["overview"])}
      toggle={() => {}}
    />
  );
}
it("shows a named tooltip by hover and keyboard focus only when collapsed and closes by Escape", async () => {
  const user = userEvent.setup(),
    view = render(<Menu />);
  const link = screen.getByRole("link", { name: "Khách truy cập" });
  expect(link).toHaveAttribute("aria-label", "Khách truy cập");
  expect(link).not.toHaveAttribute("title");
  await user.hover(link);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Khách truy cập");
  expect(link).toHaveAttribute("href", "/admin/analytics/visitors");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  await user.unhover(link);
  act(() => link.focus());
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Khách truy cập");
  view.rerender(<Menu collapsed={false} />);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Khách truy cập" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
