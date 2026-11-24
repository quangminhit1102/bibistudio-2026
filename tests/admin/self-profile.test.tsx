import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SelfProfileForm } from "../../src/features/admin/accounts/self-profile-form";
import { profile } from "./helpers/http-client";
const initial = { ...profile, phone: null, avatarId: null };
it("self form edits only name/email/phone, preserves draft on refetch and save failure", async () => {
  const onSave = vi
    .fn()
    .mockRejectedValueOnce(new Error("Dữ liệu đã thay đổi"))
    .mockImplementation(async (d, r) => ({ ...initial, ...d, revision: r + 1 }));
  const dirty = vi.fn();
  const view = render(<SelfProfileForm initial={initial} onSave={onSave} onDirtyChange={dirty} />);
  expect(screen.getByLabelText("Tên tài khoản")).toHaveAttribute("readonly");
  expect(screen.queryByLabelText(/Mật khẩu/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "Tên mới" } });
  view.rerender(
    <SelfProfileForm
      initial={{ ...initial, displayName: "Server mới", revision: 2 }}
      onSave={onSave}
      onDirtyChange={dirty}
    />,
  );
  expect(screen.getByLabelText("Tên hiển thị")).toHaveValue("Tên mới");
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu đã thay đổi");
  expect(screen.getByLabelText("Tên hiển thị")).toHaveValue("Tên mới");
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Lưu thông tin" })).toBeDisabled());
  expect(onSave.mock.calls[0][0]).toEqual({ displayName: "Tên mới", email: null, phone: null });
});
it("the master account edits its own name, email and phone like any user", async () => {
  const onSave = vi.fn(async (d, r) => ({ ...initial, isMaster: true, ...d, revision: r + 1 }));
  render(<SelfProfileForm initial={{ ...initial, isMaster: true }} onSave={onSave} />);
  expect(screen.getByLabelText("Tên tài khoản")).toHaveAttribute("readonly");
  for (const label of ["Tên hiển thị", "Email", "Số điện thoại"])
    expect(screen.getByLabelText(label)).not.toHaveAttribute("readonly");
  expect(screen.queryByText("Tài khoản quản trị gốc được bảo vệ")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lưu thông tin" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "Quản trị mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]).toEqual([
    { displayName: "Quản trị mới", email: null, phone: null },
    initial.revision,
  ]);
});
it("phone validates locally and reverting metadata resets the dirty state", async () => {
  const save = vi.fn(),
    dirty = vi.fn();
  render(<SelfProfileForm initial={initial} onSave={save} onDirtyChange={dirty} />);
  const input = screen.getByLabelText("Số điện thoại");
  fireEvent.change(input, { target: { value: "abc" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("7–15");
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "" } });
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
});
