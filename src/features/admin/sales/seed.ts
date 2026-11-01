import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
import type { Order } from "../services/contracts";
export function seed(): SeedBatch {
  const orders: Order[] = Array.from({ length: 100 }, (_, i) => {
    const createdAt = seedBase("x", i % 30).createdAt;
    const status = (["Pending", "Confirmed", "Delivered", "Delivered", "Cancelled"] as const)[
      i % 5
    ];
    const item = {
      entity: "products" as const,
      id: `product-${(i % 50) + 1}`,
      name: `Sản phẩm demo ${(i % 50) + 1}`,
      quantity: 1 + (i % 3),
      unitPrice: 45000 + ((i % 50) % 7) * 10000,
    };
    return {
      ...seedBase(`order-${i + 1}`, i % 30),
      number: `BIBI-${1000 + i + 1}`,
      visitorId: `visitor-${(i % 80) + 1}`,
      customer: {
        name: `Khách demo ${i + 1}`,
        email: `customer${i + 1}@example.test`,
        address: "Địa chỉ giả lập — Việt Nam",
      },
      items: [item],
      discount: 0,
      shipping: 25000,
      total: item.quantity * item.unitPrice + 25000,
      status,
      paymentStatus: status === "Delivered" ? "Paid" : "Pending",
      notes: "",
      timeline: (status === "Delivered"
        ? ["Pending", "Confirmed", "Processing", "Shipped", "Delivered"]
        : status === "Confirmed"
          ? ["Pending", "Confirmed"]
          : status === "Cancelled"
            ? ["Pending", "Cancelled"]
            : ["Pending"]
      ).map((status, index) => ({
        status: status as Order["status"],
        at: new Date(Date.parse(createdAt) + index * 60000).toISOString(),
      })),
    };
  });
  return {
    orders,
    payments: orders.map((o) => ({
      ...seedBase(`payment-${o.id}`),
      orderId: o.id,
      amount: o.total,
      status: o.paymentStatus,
      method: "Demo — không thu tiền",
    })),
    stock: [],
  };
}
