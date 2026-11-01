import type { AdminStore, DemoSession, AdminUser } from "../services/contracts";
import { can, authorizeOperation } from "../accounts/permissions";
import { ensureDataset } from "../demo/registry";
import {
  aggregateAnalytics,
  aggregateOrders,
  previousRange,
  conversionRate,
  within,
  type DateRange,
} from "../analytics/aggregate";
export async function loadDashboard(
  store: AdminStore,
  session: DemoSession | null,
  range: DateRange,
) {
  const assertActive = await authorizeOperation(store, session, "dashboard", "view");
  await Promise.all([
    ensureDataset(store, "sessions"),
    ensureDataset(store, "orders"),
    ensureDataset(store, "users"),
    ensureDataset(store, "notifications"),
  ]);
  const role = session ? await store.get("roles", session.roleId) : undefined;
  const [visitors, sessions, orders, products, users, activity, notifications] = await Promise.all([
    store.list("visitors"),
    store.list("sessions"),
    store.list("orders"),
    store.list("products"),
    store.list("users"),
    store.list("audit"),
    store.list("notifications"),
  ]);
  const current = aggregateAnalytics(visitors, sessions, range),
    prior = previousRange(range),
    previous = aggregateAnalytics(visitors, sessions, prior);
  const business = aggregateOrders(orders, range),
    previousBusiness = aggregateOrders(orders, prior);
  const categories = new Map<string, number>();
  for (const order of business.selected.filter(
    (o) => o.paymentStatus === "Paid" && !["Cancelled", "Refunded"].includes(o.status),
  ))
    for (const item of order.items) {
      const category = products.find((p) => p.id === item.id)?.productType ?? "book";
      categories.set(category, (categories.get(category) ?? 0) + item.unitPrice * item.quantity);
    }
  const permitted = (resource: Parameters<typeof can>[1]) => can(session, resource, "view", role);
  assertActive();
  return {
    current,
    previous,
    business: { ...business, selected: permitted("sales") ? business.selected : [] },
    previousBusiness: {
      ...previousBusiness,
      selected: permitted("sales") ? previousBusiness.selected : [],
    },
    visitors: permitted("analytics") ? visitors : [],
    sessions: permitted("analytics") ? sessions : [],
    products: permitted("products") ? products : [],
    users: [] as AdminUser[],
    activity: permitted("audit") ? activity : [],
    notifications: permitted("notifications") ? notifications : [],
    rates: {
      current: conversionRate(
        business.selected,
        sessions.filter((s) => within(s.startedAt, range)).map((s) => s.visitorId),
      ),
      previous: conversionRate(
        previousBusiness.selected,
        sessions.filter((s) => within(s.startedAt, prior)).map((s) => s.visitorId),
      ),
    },
    categorySales: [...categories].map(([name, value]) => ({ name, value })),
    productCount: products.length,
    activeUsers: users.filter((u) => u.active && u.lastLogin && within(u.lastLogin, range)).length,
  };
}
