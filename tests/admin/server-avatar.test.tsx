import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvatarEditor } from "../../src/features/admin/accounts/avatar-editor";
import { profile } from "./helpers/http-client";
vi.mock("../../src/features/admin/accounts/server-avatar", () => ({
  ServerAvatar: () => <span>Ảnh hiện tại</span>,
}));
it("choosing an image only previews; explicit save uploads, metadata dirty blocks actions", async () => {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }),
  );
  const upload = vi
    .fn()
    .mockResolvedValue({ ...profile, phone: null, avatarId: "new", revision: 2 });
  const api = { upload, remove: vi.fn() },
    saved = vi.fn();
  const user = { ...profile, phone: null, avatarId: null };
  const view = render(<AvatarEditor user={user} api={api} onSaved={saved} metadataDirty={false} />);
  fireEvent.change(screen.getByLabelText("Chọn ảnh đại diện"), {
    target: { files: [new File(["png"], "a.png", { type: "image/png" })] },
  });
  expect(upload).not.toHaveBeenCalled();
  expect(screen.getByAltText("Xem trước ảnh đại diện")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Lưu ảnh" }));
  await vi.waitFor(() => expect(saved).toHaveBeenCalled());
  view.rerender(<AvatarEditor user={user} api={api} onSaved={saved} metadataDirty />);
  expect(screen.getByLabelText("Chọn ảnh đại diện")).toBeDisabled();
  expect(screen.getByText(/Lưu hoặc hoàn tác thông tin/)).toBeInTheDocument();
});
