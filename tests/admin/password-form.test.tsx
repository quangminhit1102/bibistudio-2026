import { expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PasswordForm } from "../../src/features/admin/accounts/password-form";

const fields = ["Mật khẩu hiện tại", "Mật khẩu mới", "Nhập lại mật khẩu mới"] as const;
const fill = (current: string, next: string, again = next) =>
  [current, next, again].forEach((value, i) =>
    fireEvent.change(screen.getByLabelText(fields[i]), { target: { value } }),
  );
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
const values = () =>
  fields.map((label) => (screen.getByLabelText(label) as HTMLInputElement).value);

test("the three fields are password inputs the browser can fill, and all are needed", () => {
  render(<PasswordForm onChange={vi.fn()} />);
  expect(fields.map((label) => screen.getByLabelText(label).getAttribute("type"))).toEqual([
    "password",
    "password",
    "password",
  ]);
  expect(fields.map((label) => screen.getByLabelText(label).getAttribute("autocomplete"))).toEqual([
    "current-password",
    "new-password",
    "new-password",
  ]);
  expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDisabled();
  fill("old-pass-1", "new-pass-22", "");
  expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDisabled();
  fill("old-pass-1", "new-pass-22");
  expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeEnabled();
});

test.each([
  [
    "a new password under 8 characters",
    "old-pass-1",
    "1234567",
    "1234567",
    "Mật khẩu mới cần ít nhất 8 ký tự",
  ],
  [
    "a new password over 72 bytes",
    "old-pass-1",
    "ấ".repeat(25),
    "ấ".repeat(25),
    "Mật khẩu mới quá dài",
  ],
  [
    "a different confirmation",
    "old-pass-1",
    "new-pass-22",
    "new-pass-23",
    "Hai ô mật khẩu mới không khớp",
  ],
  [
    "the current password again",
    "old-pass-1",
    "old-pass-1",
    "old-pass-1",
    "Mật khẩu mới phải khác mật khẩu hiện tại",
  ],
])("%s is refused before anything is sent", async (_name, current, next, again, message) => {
  const onChange = vi.fn();
  render(<PasswordForm onChange={onChange} />);
  fill(current, next, again);
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(onChange).not.toHaveBeenCalled();
  expect(values()).toEqual([current, next, again]);
});

test("the password is sent as typed, spaces included, and the fields are emptied after success", async () => {
  const onChange = vi.fn(async () => {});
  render(<PasswordForm onChange={onChange} />);
  fill(" old pass 1 ", " mật khẩu ");
  submit();
  await waitFor(() => expect(values()).toEqual(["", "", ""]));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(" old pass 1 ", " mật khẩu ");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("a refusal from the server is shown and the fields keep what was typed", async () => {
  const onChange = vi.fn().mockRejectedValue(new Error("Vui lòng thử lại sau"));
  render(<PasswordForm onChange={onChange} />);
  fill("old-pass-1", "new-pass-22");
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng thử lại sau");
  expect(values()).toEqual(["old-pass-1", "new-pass-22", "new-pass-22"]);
  expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeEnabled();
});

test("a second click while the change is being saved sends nothing more", async () => {
  let finish = () => {};
  const onChange = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  render(<PasswordForm onChange={onChange} />);
  fill("old-pass-1", "new-pass-22");
  submit();
  submit();
  expect(onChange).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(values()).toEqual(["", "", ""]));
});
