import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountForm } from "../../src/features/admin/accounts/account-form";
import { profile } from "./helpers/http-client";
const roles = [
  { id: "system-user", name: "Người dùng" },
  { id: "system-admin", name: "Quản trị viên" },
];
const account = {
  ...profile,
  active: true,
  createdAt: "2026-11-04T00:00:00Z",
  updatedAt: "2026-11-04T00:00:00Z",
};

test("account creation submits multiple role IDs and a password without a single-role projection", async () => {
  const save = vi.fn(async () => ({
    ...account,
    username: "new-user",
    displayName: "Tài khoản mới",
    roleIds: ["system-user", "system-admin"],
  }));
  render(<AccountForm roles={roles} onSave={save} />);
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Tên tài khoản" }), "new-user");
  await user.type(screen.getByRole("textbox", { name: "Tên hiển thị" }), "Tài khoản mới");
  await user.type(screen.getByLabelText("Mật khẩu"), "Only-test-Form!99");
  await user.click(screen.getByRole("checkbox", { name: "Quản trị viên" }));
  await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  expect(save).toHaveBeenCalledOnce();
  const draft = save.mock.calls[0][0];
  expect(draft.roleIds).toEqual(["system-user", "system-admin"]);
  expect(draft.password).toBe("Only-test-Form!99");
  expect("roleId" in draft).toBe(false);
});

test("failed account save keeps its draft and bound revision for a retry", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("Dữ liệu đã thay đổi. Vui lòng tải lại"))
    .mockResolvedValueOnce({ ...account, displayName: "Tên đã sửa", revision: 2 });
  render(<AccountForm initial={account} roles={roles} onSave={save} />);
  const user = userEvent.setup();
  const name = screen.getByRole("textbox", { name: "Tên hiển thị" });
  await user.clear(name);
  await user.type(name, "Tên đã sửa");
  await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu đã thay đổi");
  expect(name).toHaveValue("Tên đã sửa");
  await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  expect(save.mock.calls[1][1]).toBe(1);
  expect(save.mock.calls[1][0]).not.toHaveProperty("roleIds");
});

test("master account fields are read-only with no password or mutation submit control", async () => {
  const save = vi.fn();
  render(
    <AccountForm
      initial={{ ...account, isMaster: true, username: "admin" }}
      roles={roles}
      onSave={save}
    />,
  );
  expect(screen.getByRole("textbox", { name: "Tên tài khoản" })).toBeDisabled();
  expect(screen.queryByLabelText("Mật khẩu mới")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Lưu thông tin" })).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});
