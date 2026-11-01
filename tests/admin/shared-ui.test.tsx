import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Modal } from "../../src/features/admin/shared/ui/primitives";
import { useState } from "react";
it("loading actions disable clicks and retain an accessible name", () => {
  render(<Button loading>Lưu</Button>);
  expect(screen.getByRole("button", { name: /Lưu/ })).toBeDisabled();
});
it("dialog has a name, closes by Escape and restores focus", async () => {
  function Demo() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Mở</Button>
        <Modal open={open} onOpenChange={setOpen} title="Biểu mẫu">
          <label>
            Tên
            <input />
          </label>
        </Modal>
      </>
    );
  }
  const u = userEvent.setup();
  render(<Demo />);
  await u.click(screen.getByRole("button", { name: "Mở" }));
  expect(screen.getByRole("dialog", { name: "Biểu mẫu" })).toBeInTheDocument();
  await u.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
