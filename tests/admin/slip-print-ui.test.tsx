import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrintEditor } from "../../src/features/admin/sales/components/slip-print";
import { loadPrintDraft } from "../../src/features/admin/sales/print-draft";

describe("print editor", () => {
  it("edits VAT and lines, blocks invalid input, resets and closes without saving", async () => {
    const { draft } = await loadPrintDraft(
      {
        id: "s",
        number: "PMH-2026-0002",
        createdAt: "2026-11-12T00:00:00Z",
        updatedAt: "2026-11-12T00:00:00Z",
        revision: 1,
        customerId: "c",
        customerSnapshot: { name: "Khách", address: "Địa chỉ", kind: "bookstore" },
        vatApplied: true,
        total: 26000000,
        notes: "",
        status: "saved",
        voidedAt: null,
        voidReason: "",
        items: [
          { lineId: "l", productId: "p", sku: "001", name: "Sổ", quantity: 1000, unitPrice: 26000 },
        ],
      },
      { customer: async () => null, product: async () => null },
    );
    const original = structuredClone(draft),
      close = vi.fn();
    render(<PrintEditor initial={draft} warnings={[]} onClose={close} />);
    const printButton = screen.getByRole("button", { name: "In / Lưu PDF" });
    expect(printButton).toBeDisabled();
    const iframe = screen.getByTitle("Phiếu giao hàng xem trước") as HTMLIFrameElement;
    const print = vi.spyOn(iframe.contentWindow!, "print").mockImplementation(() => {});
    vi.spyOn(iframe.contentWindow!, "focus").mockImplementation(() => {});
    fireEvent.load(iframe);
    expect(printButton).toBeEnabled();
    fireEvent.click(printButton);
    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByTestId("print-total")).toHaveTextContent("28.080.000");
    fireEvent.change(screen.getByLabelText("Tính VAT"), { target: { value: "no" } });
    expect(screen.getByTestId("print-total")).toHaveTextContent("26.000.000");
    expect(screen.getByLabelText("Thuế suất VAT")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Số lượng dòng 1"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "In / Lưu PDF" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Số lượng");
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục dữ liệu phiếu" }));
    expect(printButton).toBeDisabled();
    expect(screen.getByLabelText("Số lượng dòng 1")).toHaveValue(1000);
    fireEvent.click(screen.getByRole("button", { name: "Thêm dòng sản phẩm" }));
    await waitFor(() => expect(screen.getByLabelText("Sản phẩm dòng 2")).toHaveFocus());
    expect(screen.getByRole("button", { name: "In / Lưu PDF" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Xóa dòng 2" }));
    expect(draft).toEqual(original);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại phiếu" }));
    expect(close).toHaveBeenCalledOnce();
  });
});
