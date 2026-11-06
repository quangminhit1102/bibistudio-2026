import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProductForm from "../../src/features/admin/products/components/product-form";
import PostForm from "../../src/features/admin/content/components/post-form";
import { productConfig } from "../../src/features/admin/products/config";
import { postConfig } from "../../src/features/admin/content/config";
import { writeRichContent } from "../../src/features/admin/content/rich-content";
vi.mock("../../src/features/admin/services/context", () => ({
  useAdmin: () => ({
    ensure: async () => {},
    store: { list: async () => [], get: async () => undefined },
  }),
}));
vi.mock("../../src/features/admin/content/components/media-picker", () => ({
  default: () => null,
}));
vi.mock("../../src/features/admin/products/components/product-gallery", () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange([...value].reverse())}>
      Đảo thứ tự ảnh
    </button>
  ),
}));
vi.mock("../../src/features/admin/content/components/rich-editor", async () => {
  const React = await import("react");
  return {
    default: ({
      value,
      onChange,
      onReadyChange,
    }: {
      value: string;
      onChange: (s: string) => void;
      onReadyChange?: (b: boolean) => void;
    }) => {
      React.useEffect(() => {
        onReadyChange?.(true);
        if (!value) onChange(writeRichContent("<p><br></p>"));
      }, []);
      return (
        <textarea
          aria-label="Nội dung thử nghiệm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
  };
});
for (const kind of ["post", "product"] as const) {
  it(`${kind}: editor initialization is pristine and reverting the name clears actual changes`, async () => {
    const dirty = vi.fn(),
      client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Form = kind === "post" ? PostForm : ProductForm,
      defaults = kind === "post" ? postConfig.defaults : productConfig.defaults;
    const view = render(
      <QueryClientProvider client={client}>
        <Form
          initial={{ ...defaults }}
          onSave={async () => {}}
          onCancel={() => {}}
          onDirtyChange={dirty}
        />
      </QueryClientProvider>,
    );
    await screen.findByRole("textbox", { name: "Nội dung thử nghiệm" });
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
    expect(dirty.mock.calls.some(([v]) => v === true)).toBe(false);
    const user = userEvent.setup(),
      name = screen.getByLabelText(kind === "post" ? /^Tiêu đề\s*\*?$/ : /^Tên sản phẩm\s*\*?$/);
    await user.type(name, "Mới");
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(true));
    await user.clear(name);
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
    view.unmount();
    client.clear();
  });
}
it("preserves drafts on refetch, treats gallery ordering as a change, and resets baseline only after successful save", async () => {
  const dirty = vi.fn(),
    save = vi.fn().mockRejectedValueOnce(new Error("Lưu thất bại")).mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const initial = {
    ...productConfig.defaults,
    id: "p",
    name: "Gốc",
    sku: "SKU-1",
    slug: "goc",
    imageIds: ["a", "b"],
  };
  const ui = (row: Record<string, unknown>) => (
    <QueryClientProvider client={client}>
      <ProductForm initial={row} onSave={save} onCancel={() => {}} onDirtyChange={dirty} />
    </QueryClientProvider>
  );
  const view = render(ui(initial)),
    user = userEvent.setup();
  await screen.findByRole("textbox", { name: "Nội dung thử nghiệm" });
  await user.click(screen.getByRole("button", { name: "Đảo thứ tự ảnh" }));
  expect(dirty).toHaveBeenLastCalledWith(true);
  await user.click(screen.getByRole("button", { name: "Đảo thứ tự ảnh" }));
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
  const name = screen.getByLabelText(/^Tên sản phẩm\s*\*?$/);
  await user.type(name, " mới");
  view.rerender(ui({ ...initial, name: "Bản refetch" }));
  expect(name).toHaveValue("Gốc mới");
  expect(dirty).toHaveBeenLastCalledWith(true);
  await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await screen.findByText("Lưu thất bại");
  expect(dirty).toHaveBeenLastCalledWith(true);
  await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
  await user.type(name, " tiếp");
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(true));
  await user.clear(name);
  await user.type(name, "Gốc mới");
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
  view.unmount();
  client.clear();
});
