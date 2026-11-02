import type {
  AdminStore,
  DemoSession,
  PurchaseSlip,
  Customer,
  AdminProduct,
} from "../services/contracts";
import { authorizeOperation } from "../accounts/permissions";
import { ensureDataset } from "../demo/registry";
import { ServiceError } from "../services/errors";
import { day, within, type DateRange } from "../analytics/aggregate";
import { makeCsv } from "../shared/lib/text";
import { calculateSlipTotal } from "./slip-schema";
export interface SlipReportFilter {
  year: number;
  customerId?: string;
}
export interface SlipSummary {
  count: number;
  voidCount: number;
  total: number;
  byCustomer: { id: string; name: string; count: number; value: number }[];
  byProduct: { id: string; sku: string; name: string; quantity: number; value: number }[];
  trend: { name: string; value: number }[];
  countTrend: { name: string; value: number }[];
}
export function vietnamYear(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(now),
  );
}
export function yearRange(year: number): DateRange {
  if (!Number.isInteger(year) || year < 1900 || year > 2100)
    throw new ServiceError("validation", "Năm báo cáo không hợp lệ (1900–2100).");
  return {
    start: new Date(Date.UTC(year, 0, 1) - 7 * 3600000).toISOString(),
    end: new Date(Date.UTC(year + 1, 0, 1) - 7 * 3600000).toISOString(),
  };
}
export function businessRange(preset: string, now = new Date()): DateRange {
  const today = Date.parse(day(now.toISOString()) + "T00:00:00+07:00"),
    oneDay = 86400000;
  const end = today + (preset === "yesterday" ? 0 : oneDay),
    days = preset === "7" ? 7 : preset === "30" ? 30 : 1;
  return { start: new Date(end - days * oneDay).toISOString(), end: new Date(end).toISOString() };
}
const add = (a: number, b: number) => {
  const n = a + b;
  if (!Number.isSafeInteger(n))
    throw new ServiceError("validation", "Tổng báo cáo vượt giới hạn số an toàn.");
  return n;
};
export function summarizeSlips(
  slips: PurchaseSlip[],
  range: DateRange,
  customers: Customer[],
  products: AdminProduct[],
  customerId?: string,
): SlipSummary {
  const customerMap = new Map(customers.map((c) => [c.id, c])),
    productMap = new Map(products.map((p) => [p.id, p]));
  const byCustomer = new Map<string, SlipSummary["byCustomer"][number]>(),
    byProduct = new Map<string, SlipSummary["byProduct"][number]>();
  const trend = new Map<string, number>(),
    counts = new Map<string, number>();
  let total = 0,
    count = 0,
    voidCount = 0;
  for (const s of slips) {
    if (!within(s.createdAt, range) || (customerId && s.customerId !== customerId)) continue;
    if (s.status === "void") {
      voidCount++;
      continue;
    }
    const value = calculateSlipTotal(s.items);
    if (value !== s.total)
      throw new ServiceError("validation", `Tổng tiền không khớp trên phiếu ${s.number}.`);
    total = add(total, value);
    count++;
    const c = byCustomer.get(s.customerId) ?? {
      id: s.customerId,
      name: customerMap.get(s.customerId)?.name ?? s.customerSnapshot.name,
      count: 0,
      value: 0,
    };
    c.count++;
    c.value = add(c.value, value);
    byCustomer.set(c.id, c);
    const date = day(s.createdAt);
    trend.set(date, add(trend.get(date) ?? 0, value));
    counts.set(date, (counts.get(date) ?? 0) + 1);
    for (const item of s.items) {
      const product = productMap.get(item.productId),
        p = byProduct.get(item.productId) ?? {
          id: item.productId,
          sku: product?.sku ?? item.sku,
          name: product?.name ?? item.name,
          quantity: 0,
          value: 0,
        };
      p.quantity = add(p.quantity, item.quantity);
      p.value = add(p.value, item.quantity * item.unitPrice);
      byProduct.set(p.id, p);
    }
  }
  const points = (map: Map<string, number>) =>
    [...map].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
  return {
    total,
    count,
    voidCount,
    byCustomer: [...byCustomer.values()].sort(
      (a, b) => b.value - a.value || a.id.localeCompare(b.id),
    ),
    byProduct: [...byProduct.values()].sort(
      (a, b) => b.value - a.value || a.id.localeCompare(b.id),
    ),
    trend: points(trend),
    countTrend: points(counts),
  };
}
export async function loadSlipReport(
  store: AdminStore,
  session: DemoSession | null,
  filter: SlipReportFilter,
): Promise<SlipSummary> {
  const range = yearRange(filter.year),
    active = await authorizeOperation(store, session, "sales", "view");
  await ensureDataset(store, "purchaseSlips");
  const [slips, customers, products] = await Promise.all([
    store.list("purchaseSlips"),
    store.list("customers"),
    store.list("products"),
  ]);
  const result = summarizeSlips(slips, range, customers, products, filter.customerId);
  active();
  return result;
}
export async function loadSlipReportChoices(store: AdminStore, session: DemoSession | null) {
  const active = await authorizeOperation(store, session, "sales", "view");
  await ensureDataset(store, "purchaseSlips");
  const [slips, customers] = await Promise.all([
    store.list("purchaseSlips"),
    store.list("customers"),
  ]);
  active();
  return {
    years: [
      ...new Set([vietnamYear(), ...slips.map((s) => vietnamYear(new Date(s.createdAt)))]),
    ].sort((a, b) => b - a),
    customers: customers.map(({ id, name, active }) => ({ id, name, active })),
  };
}
export function slipReportCsv(report: SlipSummary): string {
  return makeCsv([
    ["Doanh thu ghi nhận (VND)", report.total],
    ["Phiếu đã lưu", report.count],
    ["Phiếu hủy không tính", report.voidCount],
    [],
    ["Mã khách", "Khách mua hàng", "Số phiếu", "Giá trị (VND)"],
    ...report.byCustomer.map((c) => [c.id, c.name, c.count, c.value]),
    [],
    ["Mã sản phẩm", "SKU", "Sản phẩm", "Số lượng", "Giá trị (VND)"],
    ...report.byProduct.map((p) => [p.id, p.sku, p.name, p.quantity, p.value]),
  ]);
}
