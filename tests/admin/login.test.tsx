import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Login } from "../../src/features/admin/accounts/pages/login";
const login = vi.fn().mockRejectedValue(new Error("Thông tin đăng nhập không đúng."));
vi.mock("../../src/features/admin/services/context", () => ({ useAdmin: () => ({ login }) }));
it("submits credentials and preserves username after failure, allows password visibility", async () => {
  render(<Login />);
  fireEvent.change(screen.getByLabelText("Tên tài khoản"), { target: { value: "bibi.admin" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu", { exact: true }), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
  expect(screen.getByLabelText("Mật khẩu", { exact: true })).toHaveAttribute("type", "text");
  fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập" }).closest("form")!);
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Thông tin đăng nhập không đúng."),
  );
  expect(screen.getByLabelText("Tên tài khoản")).toHaveValue("bibi.admin");
  expect(login).toHaveBeenCalledWith({ username: "bibi.admin", password: "wrong" });
});
