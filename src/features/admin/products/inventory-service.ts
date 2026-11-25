import type { AdminStore, DemoSession } from "../services/contracts";
import { authorizeOperation } from "../accounts/permissions";
import { ServiceError } from "../services/errors";
import type { AdminHttpClient } from "../../../lib/admin-http";
import type { ListResult } from "../services/contracts";
import type { StockMovementDto } from "../../../../backend/src/content/service";

export type StockMovement = Pick<
  StockMovementDto,
  | "id"
  | "productId"
  | "productName"
  | "delta"
  | "stockBefore"
  | "stockAfter"
  | "reason"
  | "actorName"
  | "createdAt"
>;

export async function listStockMovements(
  store: AdminStore,
  session: DemoSession | null,
  input: { entity: "products" | "books"; page: number; productId: string },
  http?: AdminHttpClient,
  signal?: AbortSignal,
): Promise<ListResult<StockMovement>> {
  const pageSize = 30;
  if (session?.kind === "http" && input.entity === "products") {
    if (!http) throw new ServiceError("storage", "Không thể kết nối máy chủ.");
    const params = new URLSearchParams({ page: String(input.page), pageSize: String(pageSize) });
    if (input.productId) params.set("productId", input.productId);
    return http.request(`/api/stock-movements?${params}`, { signal });
  }
  const assertActive = await authorizeOperation(
    store,
    session,
    input.entity === "books" ? "bookstore" : "products",
    "view",
  );
  const rows = (await store.list("stock"))
    .filter(
      (r) => r.entity === input.entity && (!input.productId || r.entityId === input.productId),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const items = await Promise.all(
    rows.slice((input.page - 1) * pageSize, input.page * pageSize).map(async (r) => ({
      id: r.id,
      productId: r.entityId,
      productName: (await store.get(input.entity, r.entityId))?.name ?? r.entityId,
      delta: r.delta,
      stockBefore: r.balance - r.delta,
      stockAfter: r.balance,
      reason: r.reason,
      actorName: null,
      createdAt: r.createdAt,
    })),
  );
  assertActive();
  return { items, total: rows.length, page: input.page, pageSize };
}
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
  http?: AdminHttpClient,
) {
  if (session?.kind === "http" && input.entity === "products") {
    if (!http) throw new ServiceError("storage", "Không thể kết nối máy chủ.");
    const { delta, reason, revision } = input;
    return http.request(`/api/products/${encodeURIComponent(input.id)}/stock-adjustments`, {
      method: "POST",
      body: { delta, reason, revision },
    });
  }
  const assertActive = await authorizeOperation(
    store,
    session,
    input.entity === "books" ? "bookstore" : "products",
    "update",
  );
  if (!input.reason.trim() || !Number.isInteger(input.delta) || input.delta === 0)
    throw new ServiceError("validation", "Nhập số lượng nguyên khác0 và lý do điều chỉnh.");
  return store.transaction([input.entity, "stock", "audit"], async (tx) => {
    assertActive();
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
    assertActive();
  });
}
