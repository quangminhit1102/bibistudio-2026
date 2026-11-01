import type { AdminStore, DemoSession } from "../services/contracts";
import { requirePermission } from "../accounts/permissions";
import { ServiceError } from "../services/errors";
export async function adjustStock(
  store: AdminStore,
  session: DemoSession | null,
  input: {
    entity: "products" | "books";
    id: string;
    delta: number;
    reason: string;
    revision: number;
  },
) {
  requirePermission(
    session,
    input.entity === "books" ? "bookstore" : "products",
    "update",
    session ? await store.get("roles", session.roleId) : undefined,
  );
  if (!input.reason.trim() || !Number.isInteger(input.delta) || input.delta === 0)
    throw new ServiceError("validation", "Nhập số lượng nguyên khác0 và lý do điều chỉnh.");
  return store.transaction([input.entity, "stock", "audit"], async (tx) => {
    const before = await tx.get(input.entity, input.id);
    if (!before) throw new ServiceError("not-found", "Không tìm thấy sản phẩm.");
    if (before.revision !== input.revision)
      throw new ServiceError("conflict", "Tồn kho đã thay đổi. Tải lại trước khi điều chỉnh.");
    const stock = before.stock + input.delta;
    if (stock < before.reserved)
      throw new ServiceError("validation", "Tồn kho không thể âm hoặc thấp hơn lượng đang giữ.");
    const now = new Date().toISOString();
    await tx.put(input.entity, { ...before, stock, updatedAt: now, revision: before.revision + 1 });
    await tx.put("stock", {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      entity: input.entity,
      entityId: input.id,
      delta: input.delta,
      reason: input.reason,
      balance: stock,
    });
    await tx.put("audit", {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      actor: session!.userId,
      resource: input.entity,
      action: "adjust-stock",
      recordId: input.id,
      before: String(before.stock),
      after: String(stock),
    });
  });
}
