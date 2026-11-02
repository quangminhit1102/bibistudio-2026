import type { Visitor, VisitorSession, Order, AdminStore } from "../services/contracts";
import { DEMO_NOW } from "../demo/clock";
export function conversionRate(
  orders: Pick<Order, "visitorId" | "status">[],
  visitorIds: string[],
) {
  const visitors = new Set(visitorIds);
  if (!visitors.size) return 0;
  return (
    (new Set(
      orders
        .filter(
          (o) =>
            !["Cancelled", "Refunded"].includes(o.status) &&
            o.visitorId &&
            visitors.has(o.visitorId),
        )
        .map((o) => o.visitorId),
    ).size /
      visitors.size) *
    100
  );
}
export interface DateRange {
  start: string;
  end: string;
}
export const within = (date: string, range: DateRange) =>
  Date.parse(date) >= Date.parse(range.start) && Date.parse(date) < Date.parse(range.end);
export const day = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export function presetRange(preset: string): DateRange {
  const now = Date.parse(day(new Date().toISOString()) + "T00:00:00+07:00");
  const days = preset === "today" ? 1 : preset === "yesterday" ? 1 : preset === "7" ? 7 : 30;
  const end = preset === "yesterday" ? now : now + 86400000;
  return {
    start: new Date(end - days * 86400000).toISOString(),
    end: new Date(end).toISOString(),
  };
}
export const previousRange = (range: DateRange) => ({
  start: new Date(
    Date.parse(range.start) - (Date.parse(range.end) - Date.parse(range.start)),
  ).toISOString(),
  end: range.start,
});
export function distribution(values: string[]) {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return [...result].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
export function aggregateAnalytics(
  visitors: Visitor[],
  sessions: VisitorSession[],
  range: DateRange,
) {
  const selected = sessions.filter((s) => within(s.startedAt, range));
  const ids = new Set(selected.map((s) => s.visitorId));
  const unique = visitors.filter((v) => ids.has(v.id));
  const pageViews = selected.reduce((n, s) => n + s.pages.length, 0);
  const durations = selected.map(
    (s) => Math.max(0, Date.parse(s.endedAt ?? DEMO_NOW) - Date.parse(s.startedAt)) / 1000,
  );
  const newVisitors = unique.filter((v) => within(v.firstSeenAt, range)).length;
  const activeSessions = selected.filter(
    (s) =>
      !s.endedAt && Date.parse(s.pages.at(-1)?.at ?? s.startedAt) >= Date.parse(DEMO_NOW) - 300000,
  ).length;
  return {
    visits: selected.length,
    uniqueVisitors: ids.size,
    pageViews,
    activeSessions,
    newVisitors,
    returningVisitors: Math.max(0, ids.size - newVisitors),
    averageDuration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    bounceRate: selected.length
      ? (selected.filter((s) => s.pages.length === 1).length / selected.length) * 100
      : 0,
    countries: distribution(
      selected.map((s) => visitors.find((v) => v.id === s.visitorId)?.country ?? "Không rõ"),
    ),
    devices: distribution(
      selected.map((s) => visitors.find((v) => v.id === s.visitorId)?.deviceType ?? "Không rõ"),
    ),
    browsers: distribution(
      selected.map((s) => visitors.find((v) => v.id === s.visitorId)?.browser ?? "Không rõ"),
    ),
    sources: distribution(selected.map((s) => s.referrer || "Trực tiếp")),
    pages: distribution(selected.flatMap((s) => s.pages.map((p) => p.path))),
    trend: distribution(selected.map((s) => day(s.startedAt))).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}
export function aggregateOrders(orders: Order[], range: DateRange) {
  const selected = orders.filter((o) => within(o.createdAt, range));
  const valid = selected.filter((o) => !["Cancelled", "Refunded"].includes(o.status));
  const paid = valid.filter((o) => o.paymentStatus === "Paid");
  const revenue = paid.reduce((n, o) => n + o.total, 0);
  const totals = new Map<string, number>();
  for (const o of paid) totals.set(day(o.createdAt), (totals.get(day(o.createdAt)) ?? 0) + o.total);
  const products = new Map<string, number>();
  for (const o of valid)
    for (const item of o.items)
      products.set(item.name, (products.get(item.name) ?? 0) + item.quantity);
  return {
    revenue,
    orders: selected.length,
    validOrders: valid.length,
    averageValue: valid.length ? valid.reduce((n, o) => n + o.total, 0) / valid.length : 0,
    pending: selected.filter((o) => ["Pending", "Confirmed", "Processing"].includes(o.status))
      .length,
    completed: selected.filter((o) => o.status === "Delivered").length,
    cancelled: selected.filter((o) => o.status === "Cancelled").length,
    revenueTrend: [...totals]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    orderTrend: distribution(selected.map((o) => day(o.createdAt))).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    topProducts: [...products]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    selected,
  };
}
