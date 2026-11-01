import { afterEach, beforeEach, expect, it } from "vitest";
import { businessFixture } from "./business-fixtures";
import { createSlipService } from "../../src/features/admin/sales/slip-service";
import { calculateSlipTotal, type SlipDraft } from "../../src/features/admin/sales/slip-schema";
import { createEntityService } from "../../src/features/admin/services/entity-service";
import type { AdminStore } from "../../src/features/admin/services/contracts";
let f: Awaited<ReturnType<typeof businessFixture>>;
const clock = () => new Date("2026-12-31T17:00:00Z");
const draft = (): SlipDraft => ({
  customerId: f.customerId,
  vatApplied: false,
  notes: "Test",
  items: [
    { lineId: "first", productId: "product-1", quantity: 2, unitPrice: 10000 },
    { lineId: "second", productId: "product-2", quantity: 3, unitPrice: 5000 },
  ],
});
beforeEach(async () => {
  f = await businessFixture("purchase-slip-service");
});
afterEach(async () => {
  await f.store.destroy();
});

it("calculates 35000 with either VAT label without touching inventory or payments", async () => {
  const service = createSlipService(f.store, () => f.session, clock);
  const products = await f.store.list("products"),
    payments = await f.store.list("payments");
  expect(calculateSlipTotal(draft().items)).toBe(35000);
  const a = await service.create(draft()),
    b = await service.create({ ...draft(), vatApplied: true });
  expect(a.total).toBe(35000);
  expect(b.total).toBe(35000);
  expect(a.vatApplied).toBe(false);
  expect(b.vatApplied).toBe(true);
  expect(a.number).toBe("PMH-2027-0001");
  expect(await f.store.list("products")).toEqual(products);
  expect(await f.store.list("payments")).toEqual(payments);
});

it("rejects empty invalid fractional duplicate and unsafe lines", async () => {
  const service = createSlipService(f.store, () => f.session, clock);
  const a = draft().items[0];
  for (const items of [
    [],
    [{ ...a, quantity: 0 }],
    [{ ...a, quantity: -1 }],
    [{ ...a, quantity: 1.5 }],
    [{ ...a, unitPrice: NaN }],
    [{ ...a, unitPrice: -1 }],
    [{ ...a, unitPrice: 1.5 }],
    [{ ...a, quantity: Number.MAX_SAFE_INTEGER, unitPrice: 2 }],
    [a, { ...a, lineId: "different" }],
    [a, { ...draft().items[1], lineId: a.lineId }],
    [
      { ...a, unitPrice: Number.MAX_SAFE_INTEGER, quantity: 1 },
      { ...draft().items[1], unitPrice: 1, quantity: 1 },
    ],
  ])
    await expect(service.create({ ...draft(), items })).rejects.toMatchObject({
      code: "validation",
    });
  expect(await f.store.list("purchaseSlips")).toHaveLength(30);
});

it("allocates unique numbers across service instances and does not reuse voided numbers", async () => {
  const a = createSlipService(f.store, () => f.session, clock),
    b = createSlipService(f.store, () => f.session, clock);
  const created = await Promise.all([a.create(draft()), b.create(draft())]);
  expect(new Set(created.map((s) => s.number)).size).toBe(2);
  const saved = created[0];
  const cancelled = await a.void(saved.id, "Nhập nhầm", saved.revision);
  expect(cancelled).toMatchObject({ status: "void", voidReason: "Nhập nhầm" });
  const next = await a.create(draft());
  expect(next.number).toBe("PMH-2027-0003");
  await expect(a.update(cancelled.id, draft(), cancelled.revision)).rejects.toMatchObject({
    code: "validation",
  });
});

it("failed audit rolls back slip and counter and permits safe retry", async () => {
  const broken: AdminStore = {
    ...f.store,
    transaction: (keys, work) =>
      f.store.transaction(keys, (tx) =>
        work({
          ...tx,
          put: async (entity, row) => {
            if (entity === "audit") throw new DOMException("Quota", "QuotaExceededError");
            await tx.put(entity, row);
          },
        }),
      ),
  };
  const failing = createSlipService(broken, () => f.session, clock);
  await expect(failing.create(draft())).rejects.toMatchObject({ code: "storage" });
  expect(await f.store.list("purchaseSlips")).toHaveLength(30);
  expect(await f.store.get("settings", "purchase-slip-counter:2027")).toBeUndefined();
  const saved = await createSlipService(f.store, () => f.session, clock).create(draft());
  expect(saved.number).toBe("PMH-2027-0001");
});

it("keeps customer and line snapshots after catalogue changes but switches customer explicitly", async () => {
  const service = createSlipService(f.store, () => f.session, clock);
  const original = await service.create(draft());
  const customers = createEntityService(f.store, "customers", () => f.session);
  const products = createEntityService(f.store, "products", () => f.session);
  await customers.update(
    f.customerId,
    { name: "Tên mới", address: "Mới", vatApplied: true, active: false },
    1,
  );
  await products.update(
    "product-1",
    { name: "Sản phẩm đổi tên", price: 999000, status: "hidden" },
    1,
  );
  const edited = await service.update(original.id, draft(), original.revision);
  expect(edited.customerSnapshot).toEqual(original.customerSnapshot);
  expect(edited.items).toEqual(original.items);
  expect(edited.createdAt).toBe(original.createdAt);
  expect(edited.number).toBe(original.number);
  const changed = await service.update(
    edited.id,
    { ...draft(), customerId: "customer-2", vatApplied: true },
    edited.revision,
  );
  expect(changed.customerSnapshot.name).toBe((await f.store.get("customers", "customer-2"))?.name);
  expect(changed.vatApplied).toBe(true);
  await expect(service.create(draft())).rejects.toMatchObject({ code: "validation" });
  await expect(service.create({ ...draft(), customerId: "customer-2" })).rejects.toMatchObject({
    code: "validation",
  });
});

it("rejects missing references stale revisions and empty void reasons without side effects", async () => {
  const service = createSlipService(f.store, () => f.session, clock);
  await expect(service.create({ ...draft(), customerId: "missing" })).rejects.toMatchObject({
    code: "validation",
  });
  await expect(
    service.create({ ...draft(), items: [{ ...draft().items[0], productId: "missing" }] }),
  ).rejects.toMatchObject({ code: "validation" });
  const slip = await service.create(draft());
  const audits = await f.store.list("audit");
  await expect(service.update(slip.id, draft(), 0)).rejects.toMatchObject({ code: "conflict" });
  await expect(service.void(slip.id, "", slip.revision)).rejects.toMatchObject({
    code: "validation",
  });
  expect(await f.store.list("audit")).toEqual(audits);
  await expect(
    createEntityService(f.store, "products", () => f.session).remove("product-1", 1),
  ).rejects.toMatchObject({ code: "validation" });
});

it("rejects viewer and inactive sessions and aborts generation changes before writes", async () => {
  await expect(
    createSlipService(f.store, () => ({ userId: "user-4", roleId: "viewer" }), clock).create(
      draft(),
    ),
  ).rejects.toMatchObject({ code: "forbidden" });
  const user = (await f.store.get("users", f.session.userId))!;
  await f.store.transaction(["users"], (tx) => tx.put("users", { ...user, active: false }));
  await expect(
    createSlipService(f.store, () => f.session, clock).create(draft()),
  ).rejects.toMatchObject({ code: "forbidden" });
  await f.store.transaction(["users"], (tx) => tx.put("users", user));
  const changing: AdminStore = {
    ...f.store,
    get generation() {
      return f.store.generation;
    },
    transaction: async (keys, work) => {
      f.store.invalidateOperations();
      return f.store.transaction(keys, work);
    },
  };
  await expect(
    createSlipService(changing, () => f.session, clock).create(draft()),
  ).rejects.toMatchObject({ code: "aborted" });
  expect(await f.store.list("purchaseSlips")).toHaveLength(30);
});
