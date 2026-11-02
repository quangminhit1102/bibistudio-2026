import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ActionMenu, Modal, Tooltip, Button } from "../../src/features/admin/shared/ui/primitives";
import { AdminThemeContext } from "../../src/features/admin/shared/ui/admin-theme";
afterEach(cleanup);
it.each(["menu", "modal", "tooltip"] as const)(
  "live theme reaches %s portal on immediate keyboard open",
  async (kind) => {
    function Page() {
      const [dark, setDark] = useState(false),
        [open, setOpen] = useState(false);
      return (
        <AdminThemeContext.Provider value={dark}>
          <div className={"admin-root " + (dark ? "dark" : "")}>
            <button onClick={() => setDark((v) => !v)}>Đổi theme</button>
            {kind === "menu" ? (
              <ActionMenu label="Mở" items={[{ label: "Hồ sơ", onSelect: () => {} }]} />
            ) : kind === "modal" ? (
              <>
                <button onClick={() => setOpen(true)}>Mở</button>
                <Modal open={open} onOpenChange={setOpen} title="Hồ sơ">
                  Nội dung
                </Modal>
              </>
            ) : (
              <Tooltip label="Hồ sơ">
                <Button>Mở</Button>
              </Tooltip>
            )}
          </div>
        </AdminThemeContext.Provider>
      );
    }
    const u = userEvent.setup();
    render(<Page />);
    await u.click(screen.getByRole("button", { name: "Đổi theme" }));
    await u.tab();
    if (kind !== "tooltip") await u.keyboard("{Enter}");
    const content = await screen.findByRole(
      kind === "menu" ? "menu" : kind === "modal" ? "dialog" : "tooltip",
    );
    expect(content.closest(".admin-root")).toHaveClass("dark");
  },
);
