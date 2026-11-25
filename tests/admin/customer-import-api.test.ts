import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { importCustomers } from "../../src/features/admin/customers/api";
import { businessFixture } from "./business-fixtures";
import { parseCustomerWorkbook } from "../../src/features/admin/customers/import/parse";
import { workbook } from "./customer-import-fixture";
import { AdminHttpError, type AdminHttpClient } from "../../src/lib/admin-http";
let f: Awaited<ReturnType<typeof businessFixture>>;
beforeEach(async () => {
  f = await businessFixture("customer-import-api");
});
afterEach(async () => {
  await f.store.destroy();
});
const row = (i: number, name: string) => ({ row: i, action: "create" as const, fields: { name } });
it("explains HTTP payload limits in Vietnamese instead of showing proxy/parser text", async () => {
  const request = vi
    .fn()
    .mockRejectedValue(new AdminHttpError(413, "HTTP_ERROR", "request entity too large"));
  await expect(
    importCustomers(
      {
        ...f,
        session: { kind: "http", userId: "test", principal: {} as never },
        http: { request } as unknown as AdminHttpClient,
      },
      { dryRun: true, rows: [] },
    ),
  ).rejects.toMatchObject({
    status: 413,
    code: "PAYLOAD_TOO_LARGE",
    message: "Dữ liệu import quá lớn so với giới hạn máy chủ. Vui lòng chia nhỏ file và thử lại.",
  });
});
it("rejects create-only demo imports without exposing matches or writing audit", async () => {
  const role = (await f.store.get("roles", "super-admin"))!;
  await f.store.transaction(["roles"], (tx) =>
    tx.put("roles", { ...role, id: "creator", permissions: { bookstore: ["create"] } }),
  );
  for (const dryRun of [true, false])
    await expect(
      importCustomers(
        { ...f, session: { userId: "creator", roleId: "creator" } },
        { dryRun, rows: [row(2, "Existing")] },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  expect((await f.store.list("audit")).filter((a) => a.action === "customer.import")).toHaveLength(
    0,
  );
});
it.each(["inactive", "changed-role"])("rejects demo import for a %s account", async (state) => {
  const user = (await f.store.get("users", f.session.userId))!;
  await f.store.transaction(["users"], (tx) =>
    tx.put("users", {
      ...user,
      ...(state === "inactive" ? { active: false } : { roleId: "viewer" }),
    }),
  );
  const count = (await f.store.list("customers")).length;
  for (const dryRun of [true, false])
    await expect(importCustomers(f, { dryRun, rows: [row(2, "Rejected")] })).rejects.toMatchObject({
      code: "forbidden",
    });
  expect((await f.store.list("customers")).length).toBe(count);
});
it("demo dry-run finds existing and earlier-file duplicates; commit atomically writes counts and one audit", async () => {
  const existing = (await f.store.get("customers", f.customerId))!;
  const rows = [row(2, "New person"), row(3, "  NEW   PERSON "), row(4, existing.name)];
  const before = (await f.store.list("customers")).length;
  const preview = await importCustomers(f, { dryRun: true, rows });
  expect(preview.rows[1]).toMatchObject({ status: "duplicate", inFile: 2 });
  expect(preview.rows[2].matches[0].id).toBe(existing.id);
  expect((await f.store.list("customers")).length).toBe(before);
  const committed = await importCustomers(f, {
    dryRun: false,
    rows: [rows[0], { ...rows[1], action: "skip" }, { ...rows[2], action: "skip" }],
  });
  expect(committed).toMatchObject({ created: 1, updated: 0, skipped: 2, committed: true });
  expect((await f.store.list("audit")).filter((a) => a.action === "customer.import")).toHaveLength(
    1,
  );
});
it("demo update preserves blank cells and extra values, rejects stale revisions and rolls back errors", async () => {
  const c = (await f.store.get("customers", f.customerId))!;
  const update = {
    row: 2,
    action: "update" as const,
    targetId: c.id,
    revision: c.revision,
    fields: { name: c.name, representative: "New rep", address: "" },
  };
  await importCustomers(f, { dryRun: false, rows: [update] });
  expect(await f.store.get("customers", c.id)).toMatchObject({
    address: c.address,
    representative: "New rep",
    revision: c.revision + 1,
  });
  const count = (await f.store.list("customers")).length;
  await expect(
    importCustomers(f, { dryRun: false, rows: [row(1, "Must rollback"), update] }),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  await expect(
    importCustomers(f, { dryRun: false, rows: [row(1, "Must rollback"), row(2, "")] }),
  ).rejects.toThrow();
  expect((await f.store.list("customers")).length).toBe(count);
  expect(await importCustomers(f, { dryRun: false, rows: [] })).toMatchObject({
    created: 0,
    updated: 0,
    skipped: 0,
    committed: true,
  });
});
it("rejects a nonmatching demo update target without writes", async () => {
  const existing = (await f.store.get("customers", f.customerId))!;
  const rows = [
    {
      row: 2,
      action: "update" as const,
      targetId: existing.id,
      revision: existing.revision,
      fields: { name: "Unrelated different customer" },
    },
  ];
  const preview = await importCustomers(f, { dryRun: true, rows });
  expect(preview.rows[0].errors).toContainEqual(expect.objectContaining({ field: "targetId" }));
  await expect(importCustomers(f, { dryRun: false, rows })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  expect(await f.store.get("customers", existing.id)).toEqual(existing);
});
it("demo enforces create and update permissions", async () => {
  await expect(
    importCustomers(
      { ...f, session: { userId: "reader", roleId: "viewer" } },
      { dryRun: true, rows: [] },
    ),
  ).rejects.toThrow();
  const roleId = "create-only";
  await f.store.transaction(["roles"], async (tx) =>
    tx.put("roles", {
      id: roleId,
      name: "Creator",
      createdAt: "x",
      updatedAt: "x",
      revision: 1,
      permissions: { bookstore: ["view", "create"] },
    }),
  );
  await expect(
    importCustomers(
      { ...f, session: { userId: "reader", roleId } },
      {
        dryRun: true,
        rows: [{ ...row(2, "Test"), action: "update", targetId: f.customerId, revision: 1 }],
      },
    ),
  ).rejects.toThrow();
});
it("keeps inferred/defaulted blank workbook cells out of update writes and HTTP payloads", async () => {
  const stored = (await f.store.get("customers", f.customerId))!;
  await f.store.transaction(["customers"], async (tx) =>
    tx.put("customers", { ...stored, vatRate: 17, kind: "company" }),
  );
  const parsed = await parseCustomerWorkbook(
    await workbook([
      ["Tên", "VAT", "Loại khách"],
      [stored.name, "", ""],
    ]),
    { extraFields: [] },
  );
  const update = {
    ...parsed.rows[0],
    action: "update" as const,
    targetId: stored.id,
    revision: stored.revision,
  };
  await importCustomers(f, { dryRun: false, rows: [update] });
  expect(await f.store.get("customers", stored.id)).toMatchObject({ vatRate: 17, kind: "company" });
  const request = vi.fn(async () => ({
    rows: [],
    created: 0,
    updated: 0,
    skipped: 0,
    committed: false,
  }));
  await importCustomers(
    {
      ...f,
      session: { kind: "http", userId: "test", principal: {} as never },
      http: { request } as unknown as AdminHttpClient,
    },
    { dryRun: true, rows: [update] },
  );
  expect(request).toHaveBeenCalledWith("/api/customers/import", {
    method: "POST",
    body: {
      dryRun: true,
      rows: [
        {
          row: update.row,
          action: "update",
          targetId: stored.id,
          revision: stored.revision,
          fields: { name: stored.name },
        },
      ],
    },
  });
});
