import {
  entityKeys,
  type AdminModels,
  type AdminStore,
  type CreateInput,
  type DemoSession,
  type EntityKey,
  type EntityService,
  type Resource,
  type Action,
} from "./contracts";
import { ServiceError, assertNotAborted } from "./errors";
import { validateRecord, assertDeletable } from "./validation";
import { requirePermission, resourceForEntity } from "../accounts/permissions";
import { normalizeSearch } from "../shared/lib/text";
export function createEntityService<K extends EntityKey>(
  store: AdminStore,
  entity: K,
  session: () => DemoSession | null,
  resource: Resource = resourceForEntity(entity),
): EntityService<K> {
  const authorize = async (action: Action) => {
    const s = session();
    requirePermission(s, resource, action, s ? await store.get("roles", s.roleId) : undefined);
  };
  const audit = async (
    tx: Parameters<Parameters<AdminStore["transaction"]>[1]>[0],
    action: string,
    id: string,
    before: unknown,
    after: unknown,
  ) => {
    await tx.put("audit", {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 1,
      actor: session()?.userId ?? "demo",
      resource: entity,
      action,
      recordId: id,
      before: JSON.stringify(before ?? null),
      after: JSON.stringify(after ?? null),
    });
  };
  return {
    async list(input) {
      await authorize("view");
      assertNotAborted(input.signal);
      let rows = await store.list(entity);
      const search = normalizeSearch(input.search ?? "");
      if (search) rows = rows.filter((r) => normalizeSearch(JSON.stringify(r)).includes(search));
      for (const [key, value] of Object.entries(input.filters ?? {}))
        if (value && value !== "all")
          rows = rows.filter(
            (r) => String((r as unknown as Record<string, unknown>)[key]) === value,
          );
      if (input.sort) {
        const { field, direction } = input.sort;
        rows.sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[field],
            bv = (b as unknown as Record<string, unknown>)[field];
          return (
            (typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av ?? "").localeCompare(String(bv ?? ""), "vi")) *
            (direction === "asc" ? 1 : -1)
          );
        });
      }
      const pageSize = Math.max(1, Math.min(200, input.pageSize)),
        total = rows.length,
        page = Math.max(1, Math.min(Math.ceil(total / pageSize) || 1, input.page));
      assertNotAborted(input.signal);
      return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
    },
    async get(id, signal) {
      await authorize("view");
      assertNotAborted(signal);
      const row = await store.get(entity, id);
      if (!row) throw new ServiceError("not-found", "Không tìm thấy dữ liệu.");
      return row;
    },
    async create(input) {
      await authorize("create");
      if (["audit", "orders", "payments", "stock", "visitors", "sessions"].includes(entity))
        throw new ServiceError("validation", "Dùng quy trình chuyên biệt cho dữ liệu này.");
      return store.transaction(entityKeys, async (tx) => {
        const now = new Date().toISOString();
        const row = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          revision: 1,
        } as AdminModels[K];
        await validateRecord(entity, row, tx);
        await tx.put(entity, row);
        await audit(tx, "create", row.id, null, row);
        return row;
      });
    },
    async update(id, input, revision) {
      await authorize("update");
      if (["audit", "stock", "orders", "payments"].includes(entity))
        throw new ServiceError("validation", "Dùng quy trình chuyên biệt để cập nhật.");
      return store.transaction(entityKeys, async (tx) => {
        const before = await tx.get(entity, id);
        if (!before) throw new ServiceError("not-found", "Không tìm thấy dữ liệu.");
        if (before.revision !== revision)
          throw new ServiceError("conflict", "Dữ liệu đã thay đổi. Tải lại trước khi lưu.");
        const row = {
          ...before,
          ...input,
          id,
          createdAt: before.createdAt,
          updatedAt: new Date().toISOString(),
          revision: revision + 1,
        } as AdminModels[K];
        await validateRecord(entity, row, tx, before);
        await tx.put(entity, row);
        await audit(tx, "update", id, before, row);
        return row;
      });
    },
    async remove(id, revision) {
      await authorize("delete");
      if (["audit", "stock", "orders", "payments", "visitors", "sessions"].includes(entity))
        throw new ServiceError("validation", "Lịch sử không thể xóa.");
      return store.transaction(entityKeys, async (tx) => {
        const row = await tx.get(entity, id);
        if (!row) throw new ServiceError("not-found", "Không tìm thấy dữ liệu.");
        if (row.revision !== revision) throw new ServiceError("conflict", "Dữ liệu đã thay đổi.");
        await assertDeletable(entity, id, tx);
        await tx.remove(entity, id);
        await audit(tx, "delete", id, row, null);
      });
    },
  };
}
