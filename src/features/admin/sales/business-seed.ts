import { seedBase, DEMO_NOW } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
import type { AdminProduct, Customer, PurchaseSlip } from "../services/contracts";
export function seed(context?: { products?: AdminProduct[] }): SeedBatch {
  const customers: Customer[] = Array.from({ length: 12 }, (_, i) => ({
    ...seedBase(`customer-${i + 1}`),
    name: `${["Nhà sách", "Cá nhân", "Công ty"][i % 3]} demo ${i + 1}`,
    kind: (["bookstore", "individual", "company"] as const)[i % 3],
    address: "Địa chỉ mô phỏng — Việt Nam",
    vatApplied: i % 2 === 0,
    notes: "Khách mua hàng mô phỏng",
    active: i !== 11,
    phone: "",
    email: "",
  }));
  const products = (context?.products ?? []).filter(
    (p) => p.sku && p.name && Number.isSafeInteger(p.price) && p.price >= 0,
  );
  const counts = new Map<number, number>();
  const purchaseSlips: PurchaseSlip[] = products.length
    ? Array.from({ length: 30 }, (_, i) => {
        const customer = customers[i % customers.length];
        const base = seedBase(`slip-demo-${i + 1}`, i * 22);
        const year = Number(
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Ho_Chi_Minh",
            year: "numeric",
          }).format(new Date(base.createdAt)),
        );
        const seq = (counts.get(year) ?? 0) + 1;
        counts.set(year, seq);
        const items = [0, 1].map((offset) => {
          const p = products[(i + offset) % products.length];
          return {
            lineId: `${base.id}-${offset}`,
            productId: p.id,
            name: p.name,
            sku: p.sku,
            quantity: 1 + (i % 3),
            unitPrice: p.price,
          };
        });
        return {
          ...base,
          number: `PMH-${year}-${String(seq).padStart(4, "0")}`,
          customerId: customer.id,
          customerSnapshot: { name: customer.name, kind: customer.kind, address: customer.address },
          vatApplied: customer.vatApplied,
          items,
          total: items.reduce((n, row) => n + row.quantity * row.unitPrice, 0),
          notes: "Phiếu mô phỏng — không trừ kho",
          status: i % 9 === 8 ? "void" : "saved",
          voidedAt: i % 9 === 8 ? DEMO_NOW : null,
          voidReason: i % 9 === 8 ? "Hủy phiếu demo" : "",
        };
      })
    : [];
  return {
    customers,
    purchaseSlips,
    settings: [...counts].map(([year, count]) => ({
      ...seedBase(`purchase-slip-counter:${year}`),
      key: `purchase-slip-counter:${year}`,
      values: { next: count + 1 },
    })),
  };
}
