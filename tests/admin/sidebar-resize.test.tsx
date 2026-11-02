import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { sidebarWidth, useSidebarResize } from "../../src/features/admin/shell/sidebar-resize";
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
function Demo({ enabled = true }: { enabled?: boolean }) {
  const r = useSidebarResize(enabled);
  return (
    <div>
      <output>{r.width}</output>
      {r.separator}
    </div>
  );
}
it("clamps against desktop workspace and absolute limits", () => {
  expect(sidebarWidth(500, 1440)).toBe(400);
  expect(sidebarWidth(400, 1024)).toBe(384);
  expect(sidebarWidth(10, 1440)).toBe(220);
});
it("restores preference, keyboard steps, resets and preserves preference through viewport changes", () => {
  localStorage.setItem("bibi-admin:sidebar-width", "350");
  window.innerWidth = 1440;
  render(<Demo />);
  const s = screen.getByRole("separator");
  expect(s).toHaveAttribute("aria-valuenow", "350");
  fireEvent.keyDown(s, { key: "ArrowRight" });
  expect(localStorage.getItem("bibi-admin:sidebar-width")).toBe("360");
  window.innerWidth = 1024;
  fireEvent(window, new Event("resize"));
  expect(s).toHaveAttribute("aria-valuenow", "360");
  fireEvent.keyDown(s, { key: "End" });
  expect(s).toHaveAttribute("aria-valuenow", "384");
  window.innerWidth = 1440;
  fireEvent(window, new Event("resize"));
  expect(s).toHaveAttribute("aria-valuenow", "384");
  fireEvent.doubleClick(s);
  expect(s).toHaveAttribute("aria-valuenow", "236");
});
it("corrupt or unavailable storage does not break resizing", () => {
  localStorage.setItem("bibi-admin:sidebar-width", "garbage");
  window.innerWidth = 1440;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  render(<Demo />);
  const s = screen.getByRole("separator");
  expect(s).toHaveAttribute("aria-valuenow", "236");
  fireEvent.keyDown(s, { key: "Home" });
  expect(s).toHaveAttribute("aria-valuenow", "220");
});
it("retains the preferred width when the viewport clamps the rendered width", () => {
  window.innerWidth = 1440;
  localStorage.setItem("bibi-admin:sidebar-width", "400");
  render(<Demo />);
  const s = screen.getByRole("separator");
  window.innerWidth = 1024;
  fireEvent(window, new Event("resize"));
  expect(s).toHaveAttribute("aria-valuenow", "384");
  expect(localStorage.getItem("bibi-admin:sidebar-width")).toBe("400");
  window.innerWidth = 1440;
  fireEvent(window, new Event("resize"));
  expect(s).toHaveAttribute("aria-valuenow", "400");
});
it("blocked reads use the default and collapsed mode removes keyboard interaction", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  window.innerWidth = 1440;
  const v = render(<Demo />),
    s = screen.getByRole("separator");
  expect(s).toHaveAttribute("aria-valuenow", "236");
  v.rerender(<Demo enabled={false} />);
  expect(s).toHaveAttribute("tabindex", "-1");
  fireEvent.keyDown(s, { key: "End" });
  expect(s).toHaveAttribute("aria-valuenow", "236");
});
it("pointer movement uses the grab offset and cancel restores the previous preference", () => {
  window.innerWidth = 1440;
  render(<Demo />);
  const s = screen.getByRole("separator");
  s.setPointerCapture = vi.fn();
  s.releasePointerCapture = vi.fn();
  s.hasPointerCapture = () => true;
  const pointer = (type: string, x: number) => {
    const e = new Event(type, { bubbles: true });
    Object.assign(e, { pointerId: 1, button: 0, clientX: x });
    fireEvent(s, e);
  };
  pointer("pointerdown", 238);
  pointer("pointermove", 300);
  expect(s).toHaveAttribute("aria-valuenow", "298");
  pointer("pointercancel", 300);
  expect(s).toHaveAttribute("aria-valuenow", "236");
  expect(localStorage.getItem("bibi-admin:sidebar-width")).toBeNull();
  pointer("pointerdown", 238);
  pointer("pointermove", 320);
  pointer("pointerup", 320);
  expect(localStorage.getItem("bibi-admin:sidebar-width")).toBe("318");
});
