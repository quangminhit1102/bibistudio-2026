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
import { ensureDataset } from "../demo/registry";
export function createEntityService<K extends EntityKey>(
  store: AdminStore,
  entity: K,
  session: () => DemoSession | null,
  resource: Resource = resourceForEntity(entity),
): EntityService<K> {
  const generation = store.generation;
  const authorize = async (action: Action) => {
    if (store.generation !== generation)
      throw new ServiceError("aborted", "Phiên thao tác đã thay đổi. Tải lại trước khi tiếp tục.");
    const s = session();
    requirePermission(s, resource, action, s ? await store.get("roles", s.roleId) : undefined);
    if (store.generation !== generation)
      throw new ServiceError("aborted", "Đã hủy thao tác của phiên cũ.");
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
  const service: EntityService<K> = {
    async export(input) {
      await authorize("export");
      const rows: AdminModels[K][] = [];
      let page = 1;
      while (true) {
        const result = await service.list({ ...input, page, pageSize: 200 });
        rows.push(...result.items);
        if (rows.length >= result.total) break;
        page++;
      }
      return rows;
    },
    async bulk(action, records) {
      await authorize(action.type === "delete" ? "delete" : "update");
      let updated = 0;
      const failures: { id: string; message: string }[] = [];
      for (const record of records) {
        try {
          if (action.type === "delete") await service.remove(record.id, record.revision);
          else await service.update(record.id, action.values, record.revision);
          updated++;
        } catch (e) {
          failures.push({
            id: record.id,
            message: e instanceof Error ? e.message : "Không thể lưu bản ghi.",
          });
        }
      }
      return { updated, failures };
    },
    async list(input) {
      await authorize("view");
      assertNotAborted(input.signal);
      let rows = await store.list(entity);
      const search = normalizeSearch(input.search ?? "");
      if (search) rows = rows.filter((r) => normalizeSearch(JSON.stringify(r)).includes(search));
      const filters = input.filters ?? {};
      if ((entity === "products" || entity === "books") && filters.availability)
        rows = rows.filter((row) => {
          const item = row as AdminModels["books"];
          return filters.availability === "in-stock"
            ? item.stock - item.reserved > 0
            : filters.availability === "out-of-stock"
              ? item.stock - item.reserved <= 0
              : true;
        });
      const dateField = ["createdAt", "lastSeenAt", "startedAt"].includes(filters.dateField)
        ? filters.dateField
        : "createdAt";
      if (filters.from)
        rows = rows.filter(
          (r) =>
            Date.parse(String((r as unknown as Record<string, unknown>)[dateField])) >=
            Date.parse(filters.from + "T00:00:00+07:00"),
        );
      if (filters.to)
        rows = rows.filter(
          (r) =>
            Date.parse(String((r as unknown as Record<string, unknown>)[dateField])) <
            Date.parse(filters.to + "T00:00:00+07:00") + 86400000,
        );
      for (const [key, value] of Object.entries(filters).filter(
        ([k]) => !["from", "to", "dateField", "availability"].includes(k),
      ))
        if (value && value !== "all")
          rows = rows.filter((r) => {
            const field = (r as unknown as Record<string, unknown>)[key];
            return Array.isArray(field) ? field.includes(value) : String(field) === value;
          });
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
      if (
        entity === "users" &&
        (input as CreateInput<"users">).roleId === "super-admin" &&
        session()?.roleId !== "super-admin"
      )
        throw new ServiceError("forbidden", "Chỉ Super Admin được cấp vai trò này.");
      if (
        [
          "audit",
          "orders",
          "payments",
          "stock",
          "visitors",
          "sessions",
          "purchaseSlips",
          "notificationReads",
        ].includes(entity)
      )
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
        if (
          (entity === "products" || entity === "books") &&
          (row as AdminModels["products"]).reserved !== 0
        )
          throw new ServiceError("validation", "Sản phẩm mới không được kế thừa lượng giữ hàng.");
        await tx.put(entity, row);
        await audit(tx, "create", row.id, null, row);
        return row;
      });
    },
    async update(id, input, revision) {
      await authorize("update");
      if (
        ["audit", "stock", "orders", "payments", "purchaseSlips", "notificationReads"].includes(
          entity,
        )
      )
        throw new ServiceError("validation", "Dùng quy trình chuyên biệt để cập nhật.");
      return store.transaction(entityKeys, async (tx) => {
        const before = await tx.get(entity, id);
        if (!before) throw new ServiceError("not-found", "Không tìm thấy dữ liệu.");
        if (
          session()?.roleId !== "super-admin" &&
          ((entity === "users" &&
            ((before as AdminModels["users"]).roleId === "super-admin" ||
              (input as Partial<CreateInput<"users">>).roleId === "super-admin")) ||
            (entity === "roles" && id === "super-admin"))
        )
          throw new ServiceError(
            "forbidden",
            "Chỉ Super Admin được chỉnh sửa quyền quản trị cao nhất.",
          );
        if (before.revision !== revision)
          throw new ServiceError("conflict", "Dữ liệu đã thay đổi. Tải lại trước khi lưu.");
        if (
          (entity === "products" || entity === "books") &&
          "reserved" in input &&
          (input as Partial<CreateInput<"products">>).reserved !==
            (before as AdminModels["products"]).reserved
        )
          throw new ServiceError(
            "validation",
            "Lượng giữ hàng chỉ thay đổi qua quy trình đơn hàng.",
          );
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
        if (
          (entity === "products" || entity === "books") &&
          (row as AdminModels["products"]).stock !== (before as AdminModels["products"]).stock
        ) {
          const now = new Date().toISOString();
          await tx.put("stock", {
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            revision: 1,
            entity,
            entityId: id,
            delta:
              (row as AdminModels["products"]).stock - (before as AdminModels["products"]).stock,
            balance: (row as AdminModels["products"]).stock,
            reason: "Điều chỉnh qua biểu mẫu chỉnh sửa",
          });
        }
        await audit(tx, "update", id, before, row);
        return row;
      });
    },
    async remove(id, revision) {
      await authorize("delete");
      if (
        [
          "products",
          "books",
          "categories",
          "authors",
          "publishers",
          "tags",
          "users",
          "roles",
          "media",
        ].includes(entity)
      )
        await Promise.all([
          ensureDataset(store, "posts"),
          ensureDataset(store, "purchaseSlips"),
          ensureDataset(store, "users"),
        ]);
      await authorize("delete");
      if (
        [
          "audit",
          "stock",
          "orders",
          "payments",
          "visitors",
          "sessions",
          "purchaseSlips",
          "notificationReads",
        ].includes(entity)
      )
        throw new ServiceError("validation", "Lịch sử không thể xóa.");
      return store.transaction(entityKeys, async (tx) => {
        const row = await tx.get(entity, id);
        if (!row) throw new ServiceError("not-found", "Không tìm thấy dữ liệu.");
        if (
          entity === "users" &&
          (row as AdminModels["users"]).roleId === "super-admin" &&
          session()?.roleId !== "super-admin"
        )
          throw new ServiceError("forbidden", "Chỉ Super Admin được xóa tài khoản có vai trò này.");
        if (row.revision !== revision) throw new ServiceError("conflict", "Dữ liệu đã thay đổi.");
        await assertDeletable(entity, id, tx);
        await tx.remove(entity, id);
        await audit(tx, "delete", id, row, null);
      });
    },
  };
  return service;
}
