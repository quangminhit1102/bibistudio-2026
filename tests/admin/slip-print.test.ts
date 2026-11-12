import { describe, expect, it } from "vitest";
import {
  amountInWords,
  calculatePrintTotals,
  loadPrintDraft,
  type SlipPrintSource,
} from "../../src/features/admin/sales/print-draft";
import { printDocument } from "../../src/features/admin/sales/print-document";
import type { PurchaseSlip } from "../../src/features/admin/services/contracts";
import { ServiceError } from "../../src/features/admin/services/errors";

export const printSlip: PurchaseSlip = {
  id: "s1",
  number: "PMH-2026-0002",
  createdAt: "2026-11-12T04:00:00Z",
  updatedAt: "2026-11-12T04:00:00Z",
  revision: 1,
  customerId: "c1",
  customerSnapshot: { name: "Khách cũ", address: "Địa chỉ cũ", kind: "bookstore" },
  vatApplied: true,
  status: "saved",
  notes: "",
  voidedAt: null,
  voidReason: "",
  items: [
    { lineId: "l1", productId: "p1", sku: "001", name: "Tên cũ", quantity: 1000, unitPrice: 26000 },
  ],
  total: 26000000,
};
const source: SlipPrintSource = {
  customer: async () => ({ name: "Nhã Nam", address: "Đường sách" }),
  product: async () => ({ name: "Sổ tay A6", sku: "008938565196048" }),
};
describe("delivery-slip print draft", () => {
  it("uses linked data but preserves saved quantities/prices and original records", async () => {
    const original = structuredClone(printSlip);
    const { draft, warnings } = await loadPrintDraft(printSlip, source);
    expect(warnings).toEqual([]);
    expect(draft.customer).toBe("Nhã Nam");
    expect(draft.items[0]).toMatchObject({
      name: "Sổ tay A6",
      code: "008938565196048",
      quantity: 1000,
      price: 26000,
    });
    draft.items[0].name = "Bản in";
    expect(printSlip).toEqual(original);
  });
  it("falls back only for missing or forbidden relations and reports it", async () => {
    const { draft, warnings } = await loadPrintDraft(printSlip, {
      customer: async () => null,
      product: async () => {
        throw new ServiceError("forbidden", "No access");
      },
    });
    expect(draft.customer).toBe("Khách cũ");
    expect(draft.items[0].name).toBe("Tên cũ");
    expect(warnings).toHaveLength(2);
    await expect(
      loadPrintDraft(printSlip, {
        ...source,
        customer: async () => {
          throw new Error("offline");
        },
      }),
    ).rejects.toThrow("offline");
  });
  it("calculates VAT once and Vietnamese words from the grand total", async () => {
    const { draft } = await loadPrintDraft(printSlip, source);
    expect(calculatePrintTotals(draft)).toEqual({
      subtotal: 26000000,
      tax: 2080000,
      total: 28080000,
    });
    expect(amountInWords(28080000)).toBe("Hai mươi tám triệu không trăm tám mươi nghìn đồng");
    draft.vat = false;
    expect(calculatePrintTotals(draft).total).toBe(26000000);
    draft.vat = true;
    draft.items[0].quantity = 1;
    draft.items[0].price = 5;
    draft.vatRate = "10";
    expect(calculatePrintTotals(draft)).toEqual({ subtotal: 5, tax: 1, total: 6 });
    draft.vatRate = "8.25";
    draft.items[0].price = 10000;
    expect(calculatePrintTotals(draft).tax).toBe(825);
    expect(amountInWords(0)).toBe("Không đồng");
  });
  it("rejects invalid/empty numeric values, dates, names and overflow", async () => {
    const { draft } = await loadPrintDraft(printSlip, source);
    for (const quantity of ["", 0, -1, 1.5, Infinity]) {
      expect(() =>
        calculatePrintTotals({ ...draft, items: [{ ...draft.items[0], quantity }] }),
      ).toThrow();
    }
    for (const rate of ["", "101", "-1", "8.123", "NaN"]) {
      expect(() => calculatePrintTotals({ ...draft, vatRate: rate })).toThrow();
    }
    expect(() => calculatePrintTotals({ ...draft, date: "2026-02-30" })).toThrow();
    expect(() => calculatePrintTotals({ ...draft, customer: " " })).toThrow();
    expect(() =>
      calculatePrintTotals({
        ...draft,
        items: [{ ...draft.items[0], quantity: Number.MAX_SAFE_INTEGER }],
      }),
    ).toThrow();
  });
  it("escapes user text and produces a self-contained A4 document", async () => {
    const { draft } = await loadPrintDraft(printSlip, source);
    draft.customer = '<img src=x onerror="alert(1)">';
    const html = printDocument(draft);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("VAT 8%");
    expect(html).toContain("28,080,000");
    expect(html).toContain("text-align:center");
    expect(html).toContain("size:A4 portrait");
    expect(html).toContain("table-header-group");
    draft.vat = false;
    expect(printDocument(draft)).not.toContain("VAT 8%");
  });
});
