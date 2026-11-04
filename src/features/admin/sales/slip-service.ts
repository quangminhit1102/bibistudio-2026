import type {
  AdminStore,
  AdminTransaction,
  DemoSession,
  PurchaseSlip,
  Action,
} from "../services/contracts";
import { authorizeOperation, requirePermission } from "../accounts/permissions";
import { ensureDataset } from "../demo/registry";
import { ServiceError } from "../services/errors";
import { calculateSlipTotal, parseSlipDraft, type SlipDraft } from "./slip-schema";

export function createSlipService(
  store: AdminStore,
  session: () => DemoSession | null,
  clock: () => Date = () => new Date(),
) {
  async function write(
    action: Action,
    work: (tx: AdminTransaction, actor: DemoSession, now: string) => Promise<PurchaseSlip>,
  ) {
    const actor = session(),
      generation = store.generation;
    if (!actor) throw new ServiceError("forbidden", "Vui lòng chọn tài khoản.");
    if (actor.kind !== "http") await ensureDataset(store, "users");
    const assertActive = await authorizeOperation(store, actor, "sales", action);
    await ensureDataset(store, "purchaseSlips");
    const current = () => {
      assertActive();
      if (
        store.generation !== generation ||
        session()?.userId !== actor.userId ||
        session()?.roleId !== actor.roleId
      )
        throw new ServiceError("aborted", "Phiên đã thay đổi. Thao tác phiếu đã bị hủy.");
    };
    current();
    const instant = clock();
    if (!Number.isFinite(instant.getTime()))
      throw new ServiceError("validation", "Ngày giờ không hợp lệ.");
    const now = instant.toISOString();
    return store.transaction(
      ["purchaseSlips", "settings", "audit", "customers", "products", "users", "roles"],
      async (tx) => {
        current();
        const user = actor.kind !== "http" ? await tx.get("users", actor.userId) : undefined,
          role = actor.kind !== "http" ? await tx.get("roles", actor.roleId) : undefined;
        if (actor.kind !== "http" && (!user?.active || user.roleId !== actor.roleId))
          throw new ServiceError(
            "forbidden",
            "Tài khoản không còn hoạt động hoặc quyền đã thay đổi.",
          );
        requirePermission(actor, "sales", action, role);
        const result = await work(tx, actor, now);
        current();
        return result;
      },
    );
  }
  async function audit(
    tx: AdminTransaction,
    actor: DemoSession,
    now: string,
    action: string,
    before: PurchaseSlip | null,
    after: PurchaseSlip,
  ) {
    await tx.put("audit", {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      actor: actor.userId,
      resource: "purchaseSlips",
      action,
      recordId: after.id,
      before: JSON.stringify(before),
      after: JSON.stringify(after),
    });
  }
  async function values(tx: AdminTransaction, draft: SlipDraft, before?: PurchaseSlip) {
    const customer = await tx.get("customers", draft.customerId);
    if (!customer || (!customer.active && before?.customerId !== customer.id))
      throw new ServiceError("validation", "Chọn khách mua hàng đang sử dụng.");
    const items = [];
    for (const line of draft.items) {
      const oldLine = before?.items.find(
        (i) => i.lineId === line.lineId && i.productId === line.productId,
      );
      const product = await tx.get("products", line.productId);
      if (!product || (product.status === "hidden" && !oldLine))
        throw new ServiceError(
          "validation",
          "Sản phẩm không tồn tại hoặc đã ẩn. Chọn lại sản phẩm.",
        );
      items.push({
        ...line,
        name: oldLine?.name ?? product.name,
        sku: oldLine?.sku ?? product.sku,
      });
    }
    return {
      customerId: customer.id,
      customerSnapshot:
        before?.customerId === customer.id
          ? before.customerSnapshot
          : { name: customer.name, address: customer.address, kind: customer.kind },
      vatApplied: draft.vatApplied,
      notes: draft.notes,
      items,
      total: calculateSlipTotal(items),
    };
  }
  async function existing(tx: AdminTransaction, id: string, revision: number) {
    const row = await tx.get("purchaseSlips", id);
    if (!row) throw new ServiceError("not-found", "Không tìm thấy phiếu mua hàng.");
    if (row.revision !== revision)
      throw new ServiceError("conflict", "Phiếu đã thay đổi. Tải lại trước khi lưu.");
    if (row.status !== "saved") throw new ServiceError("validation", "Phiếu đã hủy chỉ được xem.");
    return row;
  }
  return {
    async create(input: SlipDraft): Promise<PurchaseSlip> {
      const draft = parseSlipDraft(input);
      return write("create", async (tx, actor, now) => {
        const data = await values(tx, draft);
        const year = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
          year: "numeric",
        }).format(new Date(now));
        const key = `purchase-slip-counter:${year}`,
          counter = await tx.get("settings", key),
          prefix = `PMH-${year}-`;
        const used = (await tx.list("purchaseSlips"))
          .filter((s) => s.number.startsWith(prefix))
          .map((s) => Number(s.number.slice(prefix.length)))
          .filter((n) => Number.isSafeInteger(n) && n > 0);
        const next = counter?.values.next;
        if (
          next !== undefined &&
          (typeof next !== "number" || !Number.isSafeInteger(next) || next < 1)
        )
          throw new ServiceError("validation", "Bộ đếm số phiếu không hợp lệ.");
        const sequence = Math.max(typeof next === "number" ? next : 1, ...used.map((n) => n + 1));
        if (!Number.isSafeInteger(sequence + 1))
          throw new ServiceError("validation", "Số phiếu vượt giới hạn an toàn.");
        const row: PurchaseSlip = {
          ...data,
          id: crypto.randomUUID(),
          number: prefix + String(sequence).padStart(4, "0"),
          createdAt: now,
          updatedAt: now,
          revision: 1,
          status: "saved",
          voidedAt: null,
          voidReason: "",
        };
        await tx.put("settings", {
          id: key,
          key,
          createdAt: counter?.createdAt ?? now,
          updatedAt: now,
          revision: (counter?.revision ?? 0) + 1,
          values: { next: sequence + 1 },
        });
        await tx.put("purchaseSlips", row);
        await audit(tx, actor, now, "create", null, row);
        return row;
      });
    },
    async update(id: string, input: SlipDraft, revision: number): Promise<PurchaseSlip> {
      const draft = parseSlipDraft(input);
      return write("update", async (tx, actor, now) => {
        const before = await existing(tx, id, revision);
        const after = {
          ...before,
          ...(await values(tx, draft, before)),
          revision: revision + 1,
          updatedAt: now,
        };
        await tx.put("purchaseSlips", after);
        await audit(tx, actor, now, "update", before, after);
        return after;
      });
    },
    async void(id: string, reason: string, revision: number): Promise<PurchaseSlip> {
      if (!reason.trim() || reason.length > 1000)
        throw new ServiceError("validation", "Nhập lý do hủy phiếu (tối đa 1.000 ký tự).");
      return write("update", async (tx, actor, now) => {
        const before = await existing(tx, id, revision);
        const after: PurchaseSlip = {
          ...before,
          status: "void",
          voidedAt: now,
          voidReason: reason.trim(),
          updatedAt: now,
          revision: revision + 1,
        };
        await tx.put("purchaseSlips", after);
        await audit(tx, actor, now, "void", before, after);
        return after;
      });
    },
  };
}
