import { AdminHttpError, type AdminHttpClient } from "@/lib/admin-http";
import {
  duplicateKeys,
  validateImportFields,
  customerExtra,
  type ImportRow as ServerImportRow,
  type ImportResult,
} from "../../../../backend/src/content/customer-import";
import type { AdminStore, Customer, DemoSession } from "../services/contracts";
import { authorizeOperation, requirePermission } from "../accounts/permissions";
import { customerConfig } from "./config";
import { ServiceError } from "../services/errors";
export type { ImportResult } from "../../../../backend/src/content/customer-import";
export type ImportRow = ServerImportRow & {
  emptyFields?: string[];
  actionChosen?: boolean;
  kindInferred?: boolean;
};

type ImportRuntime = {
  store: AdminStore;
  session: DemoSession | null;
  http?: AdminHttpClient;
  ensure?: (entity: "customers") => Promise<void>;
};
export async function importCustomers(
  runtime: ImportRuntime,
  input: { dryRun: boolean; rows: ImportRow[] },
): Promise<ImportResult> {
  input = {
    ...input,
    rows: input.rows.map(
      ({ emptyFields, actionChosen: _actionChosen, kindInferred: _kindInferred, ...row }) => ({
        ...row,
        fields:
          row.action === "update"
            ? Object.fromEntries(
                Object.entries(row.fields).filter(([key]) => !emptyFields?.includes(key)),
              )
            : row.fields,
      }),
    ),
  };
  if (runtime.session?.kind === "http") {
    if (!runtime.http) throw new Error("Phiên HTTP không khả dụng");
    try {
      return await runtime.http.request<ImportResult>("/api/customers/import", {
        method: "POST",
        body: input,
      });
    } catch (error) {
      if (error instanceof AdminHttpError && error.status === 413)
        throw new AdminHttpError(
          413,
          "PAYLOAD_TOO_LARGE",
          "Dữ liệu import quá lớn so với giới hạn máy chủ. Vui lòng chia nhỏ file và thử lại.",
        );
      throw error;
    }
  }
  if (input.rows.length > 1000) throw new AdminHttpError(400, "TOO_MANY_ROWS", "Tối đa 1.000 dòng");
  const generation = runtime.store.generation;
  const session = runtime.session;
  await runtime.ensure?.("customers");
  await runtime.store.prepare?.(["customers", "audit", "roles"]);
  if (generation !== runtime.store.generation)
    throw new ServiceError("aborted", "Phiên thao tác đã thay đổi");
  const assertActive = await authorizeOperation(runtime.store, session, "bookstore", "create");
  await authorizeOperation(runtime.store, session, "bookstore", "view");
  if (input.rows.some((r) => r.action === "update"))
    await authorizeOperation(runtime.store, session, "bookstore", "update");
  const outcome = await runtime.store.transaction(["customers", "audit", "roles"], async (tx) => {
    assertActive();
    const role = session ? await tx.get("roles", session.roleId) : undefined;
    requirePermission(session, "bookstore", "create", role);
    requirePermission(session, "bookstore", "view", role);
    if (input.rows.some((r) => r.action === "update"))
      requirePermission(session, "bookstore", "update", role);
    const existing = await tx.list("customers");
    const result: ImportResult = { rows: [], created: 0, updated: 0, skipped: 0, committed: false };
    const prepared: ImportRow["fields"][] = [];
    const targets = new Set<string>();
    let stale = false;
    for (const [index, row] of input.rows.entries()) {
      const parsed = validateImportFields(row.fields, row.action === "update");
      const fields = parsed.success ? parsed.data : row.fields;
      prepared.push(parsed.success ? parsed.data : {});
      const errors =
        parsed.success || row.action === "skip"
          ? []
          : parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }));
      const matches = existing.flatMap((c) => {
        const by = duplicateKeys(fields, c);
        return by.length ? [{ id: c.id, name: c.name, revision: c.revision, by }] : [];
      });
      const earlier = input.rows
        .slice(0, index)
        .find((r) => duplicateKeys(fields, r.fields).length);
      if (row.action === "update") {
        const target = existing.find((c) => c.id === row.targetId);
        if (!target || !row.revision)
          errors.push({
            field: "targetId",
            message: "Khách hàng cập nhật không tồn tại hoặc thiếu revision",
          });
        else if (target.revision !== row.revision || targets.has(target.id)) {
          stale = true;
          errors.push({ field: "revision", message: "Dữ liệu đã thay đổi, vui lòng tải lại" });
        } else if (!matches.some((match) => match.id === target.id)) {
          errors.push({
            field: "targetId",
            message: "Khách hàng cập nhật không khớp tên, điện thoại hoặc email của dòng",
          });
        }
        if (target) {
          targets.add(target.id);
          if (prepared[index].extra) {
            prepared[index].extra = { ...target.extra, ...prepared[index].extra };
            if (!customerExtra.safeParse(prepared[index].extra).success)
              errors.push({ field: "extra", message: "Tối đa 30 trường mở rộng" });
          }
        }
      }
      result.rows.push({
        row: row.row,
        status: errors.length ? "error" : matches.length || earlier ? "duplicate" : "ok",
        errors,
        matches,
        ...(earlier ? { inFile: earlier.row } : {}),
      });
    }
    if (input.dryRun) return { result };
    if (stale || result.rows.some((r) => r.errors.length))
      return { result, error: stale ? "REVISION_CONFLICT" : "INVALID_INPUT" };
    const ids: string[] = [];
    for (const [index, row] of input.rows.entries()) {
      if (row.action === "skip") {
        result.skipped++;
        continue;
      }
      const fields = prepared[index];
      const now = new Date().toISOString();
      const target = existing.find((c) => c.id === row.targetId);
      const saved =
        row.action === "update" && target
          ? { ...target, ...fields, updatedAt: now, revision: target.revision + 1 }
          : {
              ...customerConfig.defaults,
              ...fields,
              id: crypto.randomUUID(),
              createdAt: now,
              updatedAt: now,
              revision: 1,
            };
      await tx.put("customers", saved as Customer);
      ids.push(saved.id);
      if (row.action === "update") result.updated++;
      else result.created++;
    }
    const now = new Date().toISOString();
    await tx.put("audit", {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      actor: runtime.session!.userId,
      resource: "customers",
      action: "customer.import",
      recordId: "",
      before: "null",
      after: JSON.stringify({
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        customerIds: ids,
      }),
    });
    result.committed = true;
    return { result };
  });
  if (outcome.error)
    throw new AdminHttpError(
      outcome.error === "REVISION_CONFLICT" ? 409 : 400,
      outcome.error,
      "Dữ liệu import không hợp lệ hoặc đã thay đổi",
      { rows: outcome.result.rows },
    );
  return outcome.result;
}
