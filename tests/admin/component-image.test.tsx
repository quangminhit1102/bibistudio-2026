import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormExample } from "../../src/features/admin/components/forms";
afterEach(() => vi.unstubAllGlobals());
it("rejects forged image data before preview and preserves the previous valid image", async () => {
  const create = vi.fn(() => "blob:valid"),
    revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }),
  );
  const view = render(<FormExample name="Image Upload" />);
  const input = view.container.querySelector("input[type=file]")!;
  const valid = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "valid.png", {
    type: "image/png",
  });
  fireEvent.change(input, { target: { files: [valid] } });
  expect(await screen.findByAltText("Ảnh xem trước")).toHaveAttribute("src", "blob:valid");
  fireEvent.change(input, {
    target: { files: [new File(["not an image"], "forged.png", { type: "image/png" })] },
  });
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Nội dung file không khớp"),
  );
  expect(screen.getByAltText("Ảnh xem trước")).toHaveAttribute("src", "blob:valid");
  expect(create).toHaveBeenCalledOnce();
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:valid");
});
