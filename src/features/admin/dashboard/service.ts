import type { AdminStore, DemoSession, AdminUser } from "../services/contracts";
import { can, authorizeOperation } from "../accounts/permissions";
import { ensureDataset } from "../demo/registry";
import { aggregateAnalytics, previousRange, within, type DateRange } from "../analytics/aggregate";
import { summarizeSlips } from "../sales/slip-aggregate";
export async function loadDashboard(
  store: AdminStore,
  session: DemoSession | null,
  range: DateRange,
) {
  const active = await authorizeOperation(store, session, "dashboard", "view");
  await Promise.all([
    ensureDataset(store, "sessions"),
    ensureDataset(store, "purchaseSlips"),
    ensureDataset(store, "users"),
    ensureDataset(store, "notifications"),
  ]);
  const role =
    session && session.kind !== "http" ? await store.get("roles", session.roleId) : undefined;
  const permitted = (resource: Parameters<typeof can>[1]) => can(session, resource, "view", role);
  const [visitors, sessions, slips, customers, products, users, activity, notifications] =
    await Promise.all([
      store.list("visitors"),
      store.list("sessions"),
      store.list("purchaseSlips"),
      store.list("customers"),
      store.list("products"),
      store.list("users"),
      store.list("audit"),
      store.list("notifications"),
    ]);
  const prior = previousRange(range),
    current = aggregateAnalytics(visitors, sessions, range),
    previous = aggregateAnalytics(visitors, sessions, prior);
  const business = summarizeSlips(slips, range, customers, products),
    previousBusiness = summarizeSlips(slips, prior, customers, products);
  const categories = new Map<string, number>();
  for (const row of business.byProduct) {
    const name = products.find((p) => p.id === row.id)?.productType ?? "Sản phẩm";
    categories.set(name, (categories.get(name) ?? 0) + row.value);
  }
  active();
  return {
    current,
    previous,
    business: {
      ...business,
      byCustomer: permitted("sales") ? business.byCustomer : [],
      selected: permitted("sales") ? slips.filter((s) => within(s.createdAt, range)) : [],
    },
    previousBusiness: {
      ...previousBusiness,
      byCustomer: permitted("sales") ? previousBusiness.byCustomer : [],
      selected: permitted("sales") ? slips.filter((s) => within(s.createdAt, prior)) : [],
    },
    visitors: permitted("analytics") ? visitors : [],
    sessions: permitted("analytics") ? sessions : [],
    products: permitted("products") ? products : [],
    users: [] as AdminUser[],
    activity: permitted("audit") ? activity : [],
    notifications: permitted("notifications") ? notifications : [],
    rates: { current: null, previous: null },
    categorySales: [...categories].map(([name, value]) => ({ name, value })),
    productCount: products.length,
    activeUsers: users.filter((u) => u.active && u.lastLogin && within(u.lastLogin, range)).length,
  };
}
