import { afterEach, beforeEach, expect, it } from "vitest";
import { businessFixture } from "./business-fixtures";
import { createSlipService } from "../../src/features/admin/sales/slip-service";
import {
  loadSlipReport,
  summarizeSlips,
  yearRange,
  slipReportCsv,
  businessRange,
} from "../../src/features/admin/sales/slip-aggregate";
let f: Awaited<ReturnType<typeof businessFixture>>;
beforeEach(async () => {
  f = await businessFixture("slip-report-test");
});
afterEach(async () => {
  await f.store.destroy();
});
async function make(at = "2026-12-31T17:00:00Z") {
  return createSlipService(
    f.store,
    () => f.session,
    () => new Date(at),
  ).create({
    customerId: f.customerId,
    vatApplied: false,
    notes: "",
    items: [
      { lineId: "a", productId: "product-1", quantity: 2, unitPrice: 10000 },
      { lineId: "b", productId: "product-2", quantity: 3, unitPrice: 5000 },
    ],
  });
}
it("uses half-open Vietnam year boundaries and excludes void without adding VAT", async () => {
  expect(yearRange(2027)).toEqual({
    start: "2026-12-31T17:00:00.000Z",
    end: "2027-12-31T17:00:00.000Z",
  });
  const first = await make(),
    before = await make("2026-12-31T16:59:59Z"),
    voided = await make();
  const cancelled = await createSlipService(f.store, () => f.session).void(
    voided.id,
    "Sai",
    voided.revision,
  );
  const report = summarizeSlips(
    [first, before, cancelled],
    yearRange(2027),
    await f.store.list("customers"),
    await f.store.list("products"),
  );
  expect(report.count).toBe(1);
  expect(report.voidCount).toBe(1);
  expect(report.total).toBe(35000);
  expect(report.byCustomer.reduce((n, r) => n + r.value, 0)).toBe(report.total);
  expect(report.byProduct.reduce((n, r) => n + r.value, 0)).toBe(report.total);
  await expect(loadSlipReport(f.store, f.session, { year: NaN })).rejects.toMatchObject({
    code: "validation",
  });
});
it("groups IDs rather than same names and adds multiple historical prices", async () => {
  const first = await make();
  const second = {
    ...first,
    id: "later",
    number: "PMH-2027-9999",
    vatApplied: true,
    items: [{ ...first.items[0], quantity: 5, unitPrice: 20000 }],
    total: 100000,
  };
  const products = (await f.store.list("products")).map((p) => ({ ...p, name: "Trùng tên" }));
  const report = summarizeSlips([first, second], yearRange(2027), [], products);
  expect(report.byProduct).toHaveLength(2);
  expect(report.byProduct.find((p) => p.id === "product-1")).toMatchObject({
    quantity: 7,
    value: 120000,
  });
  expect(report.total).toBe(135000);
  expect(report.byCustomer[0].name).toBe(first.customerSnapshot.name);
});
it("loads all rows beyond pagination and filters inactive customers by ID", async () => {
  const first = await make();
  await f.store.transaction(["purchaseSlips", "customers"], async (tx) => {
    for (let i = 0; i < 205; i++)
      await tx.put("purchaseSlips", { ...first, id: `extra-${i}`, number: `PMH-2027-X${i}` });
    const c = (await tx.get("customers", f.customerId))!;
    await tx.put("customers", { ...c, active: false });
  });
  const report = await loadSlipReport(f.store, f.session, { year: 2027, customerId: f.customerId });
  expect(report.count).toBe(206);
  expect(report.total).toBe(206 * 35000);
  const empty = await loadSlipReport(f.store, f.session, { year: 2027, customerId: "missing" });
  expect(empty.total).toBe(0);
  expect(slipReportCsv(report)).toContain(String(report.total));
  await expect(
    loadSlipReport(f.store, { userId: "user-3", roleId: "editor" }, { year: 2027 }),
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("exports rows outside the top ten and anchors dashboard days to current Vietnam date", async () => {
  const report = await loadSlipReport(f.store, f.session, { year: 2026 });
  expect(report.byCustomer.length).toBeGreaterThan(10);
  expect(slipReportCsv(report)).toContain(report.byCustomer[10].id);
  expect(businessRange("today", new Date("2026-12-31T17:00:00Z"))).toEqual({
    start: "2026-12-31T17:00:00.000Z",
    end: "2027-01-01T17:00:00.000Z",
  });
});
