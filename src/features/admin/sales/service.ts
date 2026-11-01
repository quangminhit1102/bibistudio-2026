import type {
  AdminStore,
  DemoSession,
  Order,
  OrderStatus,
  PaymentStatus,
  AdminTransaction,
} from "../services/contracts";
import { authorizeOperation } from "../accounts/permissions";
import { ServiceError } from "../services/errors";
export const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: ["Refunded"],
  Cancelled: [],
  Refunded: [],
};
export const paymentTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  Pending: ["Paid", "Failed"],
  Failed: ["Pending"],
  Paid: ["Refunded"],
  Refunded: [],
};
export const orderLabels: Record<OrderStatus, string> = {
  Pending: "Chờ xác nhận",
  Confirmed: "Đã xác nhận",
  Processing: "Đang chuẩn bị",
  Shipped: "Đang giao",
  Delivered: "Đã giao",
  Cancelled: "Đã hủy",
  Refunded: "Đã hoàn tiền demo",
};
export const paymentLabels: Record<PaymentStatus, string> = {
  Pending: "Chưa thanh toán",
  Paid: "Đã thanh toán",
  Failed: "Thất bại",
  Refunded: "Đã hoàn tiền demo",
};
export const totalOrder = (order: Pick<Order, "items" | "shipping" | "discount">) =>
  order.items.reduce((n, i) => n + i.quantity * i.unitPrice, 0) + order.shipping - order.discount;
async function authorize(store: AdminStore, session: DemoSession | null) {
  return authorizeOperation(store, session, "sales", "update");
}
async function audit(
  tx: AdminTransaction,
  session: DemoSession | null,
  before: Order,
  after: Order,
  action: string,
) {
  await tx.put("audit", {
    id: crypto.randomUUID(),
    createdAt: after.updatedAt,
    updatedAt: after.updatedAt,
    revision: 1,
    actor: session!.userId,
    resource: "orders",
    action,
    recordId: before.id,
    before: JSON.stringify(before),
    after: JSON.stringify(after),
  });
}
async function syncPayment(tx: AdminTransaction, order: Order) {
  const rows = (await tx.list("payments")).filter((p) => p.orderId === order.id);
  for (const p of rows)
    await tx.put("payments", {
      ...p,
      status: order.paymentStatus,
      updatedAt: order.updatedAt,
      revision: p.revision + 1,
    });
}
export async function transitionOrder(
  store: AdminStore,
  session: DemoSession | null,
  id: string,
  next: OrderStatus,
  revision: number,
) {
  const assertActive = await authorize(store, session);
  return store.transaction(
    ["orders", "products", "books", "stock", "payments", "audit"],
    async (tx) => {
      assertActive();
      const before = await tx.get("orders", id);
      if (!before) throw new ServiceError("not-found", "Không tìm thấy đơn hàng.");
      if (before.revision !== revision)
        throw new ServiceError("conflict", "Đơn hàng đã thay đổi. Tải lại trước khi thao tác.");
      if (!orderTransitions[before.status].includes(next))
        throw new ServiceError("validation", "Chuyển trạng thái đơn hàng không hợp lệ.");
      if (next === "Refunded" && before.paymentStatus !== "Paid")
        throw new ServiceError("validation", "Chỉ hoàn tiền khi đơn đã thanh toán.");
      const now = new Date().toISOString();
      for (const item of before.items) {
        if (
          next !== "Processing" &&
          next !== "Shipped" &&
          !(next === "Cancelled" && before.status === "Processing")
        )
          continue;
        const product = await tx.get(item.entity, item.id);
        if (!product) throw new ServiceError("validation", "Sản phẩm của đơn không còn tồn tại.");
        let { stock, reserved } = product;
        if (next === "Processing") {
          if (stock - reserved < item.quantity)
            throw new ServiceError("validation", `Không đủ tồn kho: ${item.name}`);
          reserved += item.quantity;
        } else if (next === "Shipped") {
          if (reserved < item.quantity || stock < item.quantity)
            throw new ServiceError("validation", "Lượng giữ hàng không hợp lệ.");
          stock -= item.quantity;
          reserved -= item.quantity;
          await tx.put("stock", {
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            revision: 1,
            entity: item.entity,
            entityId: item.id,
            delta: -item.quantity,
            balance: stock,
            reason: `Giao đơn ${before.number}`,
            orderId: id,
          });
        } else reserved -= item.quantity;
        if (reserved < 0) throw new ServiceError("validation", "Số lượng giữ hàng không hợp lệ.");
        await tx.put(item.entity, {
          ...product,
          stock,
          reserved,
          updatedAt: now,
          revision: product.revision + 1,
        });
      }
      const paymentStatus =
        next === "Refunded" || (next === "Cancelled" && before.paymentStatus === "Paid")
          ? "Refunded"
          : before.paymentStatus;
      const after: Order = {
        ...before,
        status: next,
        paymentStatus,
        revision: before.revision + 1,
        updatedAt: now,
        timeline: [...before.timeline, { status: next, at: now }],
      };
      await tx.put("orders", after);
      if (after.paymentStatus !== before.paymentStatus) await syncPayment(tx, after);
      await audit(tx, session, before, after, "transition:" + next);
      assertActive();
      return after;
    },
  );
}
export async function transitionPayment(
  store: AdminStore,
  session: DemoSession | null,
  id: string,
  next: PaymentStatus,
  revision: number,
) {
  const assertActive = await authorize(store, session);
  return store.transaction(["orders", "payments", "audit"], async (tx) => {
    assertActive();
    const before = await tx.get("orders", id);
    if (!before) throw new ServiceError("not-found", "Không tìm thấy đơn.");
    if (before.revision !== revision) throw new ServiceError("conflict", "Đơn đã thay đổi.");
    if (
      !paymentTransitions[before.paymentStatus].includes(next) ||
      before.status === "Cancelled" ||
      before.status === "Refunded"
    )
      throw new ServiceError("validation", "Trạng thái thanh toán không hợp lệ.");
    if (next === "Refunded")
      throw new ServiceError("validation", "Dùng thao tác hoàn tiền ở đơn đã giao.");
    const after = {
      ...before,
      paymentStatus: next,
      updatedAt: new Date().toISOString(),
      revision: revision + 1,
    };
    await tx.put("orders", after);
    await syncPayment(tx, after);
    await audit(tx, session, before, after, "payment:" + next);
    assertActive();
    return after;
  });
}
export async function updateOrderNotes(
  store: AdminStore,
  session: DemoSession | null,
  id: string,
  notes: string,
  revision: number,
) {
  const assertActive = await authorize(store, session);
  if (notes.length > 5000) throw new ServiceError("validation", "Ghi chú tối đa5000 ký tự.");
  return store.transaction(["orders", "audit"], async (tx) => {
    assertActive();
    const before = await tx.get("orders", id);
    if (!before) throw new ServiceError("not-found", "Không tìm thấy đơn.");
    if (before.revision !== revision) throw new ServiceError("conflict", "Đơn đã thay đổi.");
    const after = { ...before, notes, revision: revision + 1, updatedAt: new Date().toISOString() };
    await tx.put("orders", after);
    await audit(tx, session, before, after, "notes");
    assertActive();
    return after;
  });
}
