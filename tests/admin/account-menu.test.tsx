import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "../../src/features/admin/shell/account-menu";
const logout = vi.fn();
vi.mock("../../src/features/admin/services/context", () => ({
  useAdmin: () => ({ logout, session: { userId: "user-1", roleId: "super-admin" } }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../../src/features/admin/accounts/account-avatar", () => ({
  ProfileAvatar: () => <span>MN</span>,
}));
it("shows the account name and only profile/logout, closes with Escape and restores focus", async () => {
  render(
    <AccountMenu
      user={{
        id: "user-1",
        name: "Minh Nguyễn",
        email: "minh@example.test",
        roleId: "super-admin",
        active: true,
        lastLogin: null,
        createdAt: "",
        updatedAt: "",
        revision: 1,
      }}
    />,
  );
  const u = userEvent.setup(),
    trigger = screen.getByRole("button", { name: "Tài khoản Minh Nguyễn" });
  await u.click(trigger);
  expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  expect(screen.getByRole("menuitem", { name: "Hồ sơ" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Đăng xuất" })).toBeInTheDocument();
  await u.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  await u.click(trigger);
  await u.click(screen.getByRole("menuitem", { name: "Đăng xuất" }));
  expect(logout).toHaveBeenCalledOnce();
});
