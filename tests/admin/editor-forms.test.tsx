import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PostForm from "../../src/features/admin/content/components/post-form";
import ProductForm from "../../src/features/admin/products/components/product-form";
import { postConfig } from "../../src/features/admin/content/config";
import { productConfig } from "../../src/features/admin/products/config";
vi.mock("../../src/features/admin/services/context", () => {
  const runtime = {
    ensure: async () => {},
    store: {
      list: async () => [
        { id: "user-1", name: "BiBi", kind: "content" },
        { id: "cat-journal", name: "Nhật ký", kind: "content" },
        { id: "cat-notebook", name: "Sổ tay", kind: "product" },
      ],
      get: async () => undefined,
    },
  };
  return { useAdmin: () => runtime };
});
vi.mock("../../src/features/admin/content/components/rich-editor", async () => {
  const React = await import("react");
  return {
    default: ({
      value,
      onChange,
      onReadyChange,
      label,
    }: {
      value: string;
      onChange: (value: string) => void;
      onReadyChange?: (ready: boolean) => void;
      label?: string;
    }) => {
      React.useEffect(() => {
        onReadyChange?.(true);
      }, [onReadyChange]);
      return (
        <textarea
          aria-label={label ?? "Nội dung bài viết"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
  };
});
vi.mock("../../src/features/admin/content/components/media-picker", () => ({
  default: () => null,
}));
function mount(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  return userEvent.setup();
}
it("generates a new article slug until manually edited, then saves draft with current values", async () => {
  const save = vi.fn();
  const user = mount(
    <PostForm initial={{ ...postConfig.defaults }} onSave={save} onCancel={() => {}} />,
  );
  await user.type(screen.getByLabelText(/^Tiêu đề\s*\*?$/), "Sổ tay Đà Lạt");
  expect(screen.getByLabelText(/^Đường dẫn/)).toHaveValue("so-tay-da-lat");
  await user.clear(screen.getByLabelText(/^Đường dẫn/));
  await user.type(screen.getByLabelText(/^Đường dẫn/), "nhat-ky");
  await user.type(screen.getByLabelText(/^Tiêu đề\s*\*?$/), " mới");
  expect(screen.getByLabelText(/^Đường dẫn/)).toHaveValue("nhat-ky");
  await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sổ tay Đà Lạt mới", slug: "nhat-ky", status: "draft" }),
    ),
  );
});
it("keeps edited values visible after a revision conflict and preserves existing slugs", async () => {
  const user = mount(
    <PostForm
      initial={{ ...postConfig.defaults, id: "p", title: "Cũ", slug: "giu-slug" }}
      onSave={async () => {
        throw new Error("Dữ liệu đã thay đổi.");
      }}
      onCancel={() => {}}
    />,
  );
  await user.type(screen.getByLabelText(/^Tiêu đề\s*\*?$/), " mới");
  expect(screen.getByLabelText(/^Đường dẫn/)).toHaveValue("giu-slug");
  await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu đã thay đổi.");
  expect(screen.getByLabelText(/^Tiêu đề\s*\*?$/)).toHaveValue("Cũ mới");
});
it("previews an unsaved product without invoking save and keeps internal amounts out of the preview", async () => {
  const save = vi.fn();
  const user = mount(
    <ProductForm
      initial={{
        ...productConfig.defaults,
        id: "product",
        name: "Sổ tay",
        sku: "B-1",
        slug: "so-tay",
        price: 123456,
        stock: 7,
        reserved: 2,
      }}
      onSave={save}
      onCancel={() => {}}
    />,
  );
  await user.type(screen.getByLabelText(/^Tên sản phẩm/), " mới");
  await user.click(screen.getByRole("button", { name: "Xem trước" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Sổ tay mới");
  expect(screen.getByRole("dialog")).not.toHaveTextContent("123.456");
  expect(save).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ price: 123456, stock: 7, reserved: 2 }),
    ),
  );
});
