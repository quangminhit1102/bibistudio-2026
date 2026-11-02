import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileForm } from "../../src/features/admin/accounts/profile-form";
vi.mock("../../src/features/admin/shared/forms/preference-form", () => ({
  UnsavedDialog: () => null,
}));
vi.mock("../../src/features/admin/accounts/profile-avatar", () => ({
  prepareAvatar: async (file: File) => ({ file, width: 10, height: 10 }),
}));
vi.mock("../../src/features/admin/accounts/account-avatar", () => ({
  ProfileAvatar: () => <span>Ảnh</span>,
}));
const user = {
  id: "user-1",
  name: "Minh",
  email: "minh@example.test",
  roleId: "super-admin",
  active: true,
  lastLogin: null,
  revision: 1,
  createdAt: "",
  updatedAt: "",
};
afterEach(() => vi.unstubAllGlobals());
it("previews without autosave and releases object URLs on removal and unmount", async () => {
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: revoke });
  const save = vi.fn();
  const view = render(<ProfileForm user={user} onSave={save} />);
  const file = new File(["image"], "x.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Chọn ảnh đại diện"), { target: { files: [file] } });
  expect(await screen.findByAltText("Ảnh đại diện đã chọn")).toHaveAttribute("src", "blob:preview");
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh" }));
  await waitFor(() =>
    expect(screen.queryByAltText("Ảnh đại diện đã chọn")).not.toBeInTheDocument(),
  );
  expect(revoke).toHaveBeenCalledWith("blob:preview");
  view.unmount();
});
it("keeps draft after failed save and commits name email avatar in a single action", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("Hết dung lượng"))
    .mockResolvedValue({ ...user, name: "Minh mới", revision: 2 });
  render(<ProfileForm user={user} onSave={save} />);
  fireEvent.change(screen.getByLabelText("Họ tên"), { target: { value: "Minh mới" } });
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Hết dung lượng"));
  expect(screen.getByLabelText("Họ tên")).toHaveValue("Minh mới");
  fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenLastCalledWith({ name: "Minh mới", email: user.email }, 1, {
    kind: "keep",
  });
});
