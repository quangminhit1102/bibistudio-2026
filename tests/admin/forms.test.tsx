import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordForm } from "../../src/features/admin/shared/forms/record-form";
it("required form validates, exposes field error, then submits actual typed values", async () => {
  const save = vi.fn();
  render(
    <RecordForm
      fields={[
        { key: "name", label: "Tên sản phẩm", type: "text", required: true },
        { key: "price", label: "Giá", type: "number", min: 0 },
      ]}
      initial={{ name: "", price: 0 }}
      onSave={save}
      onCancel={() => {}}
    />,
  );
  const u = userEvent.setup();
  await u.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(save).not.toHaveBeenCalled();
  expect(await screen.findByText("Vui lòng nhập Tên sản phẩm")).toBeInTheDocument();
  await u.type(screen.getByLabelText(/Tên sản phẩm/), "Sổ mới");
  await u.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Sổ mới", price: 0 }));
});
