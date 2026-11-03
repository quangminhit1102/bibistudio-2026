import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import RichEditor from "../../src/features/admin/content/components/rich-editor";
import { tinyAssetBase } from "../../src/features/admin/content/components/tiny-config";
import { AdminThemeContext } from "../../src/features/admin/shared/ui/admin-theme";
import { writeRichContent } from "../../src/features/admin/content/rich-content";
const vendor = vi.hoisted(() => ({ fail: false }));
vi.mock("@tinymce/tinymce-react", () => ({
  Editor: (props: {
    tinymceScriptSrc: string;
    licenseKey: string;
    initialValue: string;
    onScriptsLoadError?: () => void;
    onInit?: () => void;
  }) => {
    return (
      <button
        onClick={() => (vendor.fail ? props.onScriptsLoadError?.() : props.onInit?.())}
        data-src={props.tinymceScriptSrc}
        data-license={props.licenseKey}
        data-html={props.initialValue}
      >
        Khởi tạo editor
      </button>
    );
  },
}));
vi.mock("../../src/features/admin/services/context", () => {
  const runtime = { store: { get: async () => undefined, getBlob: async () => undefined } };
  return { useAdmin: () => runtime };
});
it("keeps the current unsaved body when switching the editor theme", async () => {
  const { rerender } = render(
    <AdminThemeContext.Provider value={false}>
      <RichEditor value="Cũ" onChange={() => {}} />
    </AdminThemeContext.Provider>,
  );
  await screen.findByRole("button", { name: "Khởi tạo editor" });
  rerender(
    <AdminThemeContext.Provider value={true}>
      <RichEditor value={writeRichContent("<p>Nội dung vừa sửa</p>")} onChange={() => {}} />
    </AdminThemeContext.Provider>,
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Khởi tạo editor" })).toHaveAttribute(
      "data-html",
      "<p>Nội dung vừa sửa</p>",
    ),
  );
});
vi.mock("../../src/features/admin/content/components/media-picker", () => ({
  default: () => null,
}));
it("loads a local GPL editor and reports readiness without changing stored content on init", async () => {
  const change = vi.fn(),
    ready = vi.fn();
  render(<RichEditor value="Giữ nguyên" onChange={change} onReadyChange={ready} />);
  const start = await screen.findByRole("button", { name: "Khởi tạo editor" });
  expect(start).toHaveAttribute("data-src", tinyAssetBase + "tinymce.min.js");
  expect(start).toHaveAttribute("data-license", "gpl");
  start.click();
  await waitFor(() => expect(ready).toHaveBeenLastCalledWith(true));
  expect(change).not.toHaveBeenCalled();
});
it("shows retry and keeps saving disabled when self-host assets fail", async () => {
  vendor.fail = true;
  const ready = vi.fn();
  render(<RichEditor value="Giữ nguyên" onChange={() => {}} onReadyChange={ready} />);
  (await screen.findByRole("button", { name: "Khởi tạo editor" })).click();
  expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được");
  expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  expect(ready).toHaveBeenLastCalledWith(false);
  vendor.fail = false;
});
