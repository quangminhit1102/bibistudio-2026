import type { AdminModels, AdminStore, EntityKey } from "../services/contracts";
export type SeedBatch = { [K in EntityKey]?: AdminModels[K][] };
type Group =
  "accounts" | "taxonomy" | "products" | "bookstore" | "content" | "sales" | "analytics" | "system";
const factories = {
  accounts: () => import("../accounts/seed"),
  taxonomy: () => import("../products/taxonomy-seed"),
  products: () => import("../products/seed"),
  bookstore: () => import("../bookstore/seed"),
  content: () => import("../content/seed"),
  sales: () => import("../sales/seed"),
  analytics: () => import("../analytics/seed"),
  system: () => import("../settings/seed"),
};
const dependencies: Record<Group, Group[]> = {
  accounts: [],
  taxonomy: [],
  products: ["taxonomy"],
  bookstore: ["taxonomy"],
  content: ["taxonomy", "accounts"],
  sales: ["products", "bookstore"],
  analytics: [],
  system: [],
};
export const groupForEntity: Record<EntityKey, Group> = {
  roles: "accounts",
  users: "accounts",
  categories: "taxonomy",
  tags: "taxonomy",
  products: "products",
  books: "bookstore",
  authors: "bookstore",
  publishers: "bookstore",
  posts: "content",
  media: "content",
  orders: "sales",
  payments: "sales",
  stock: "sales",
  visitors: "analytics",
  sessions: "analytics",
  audit: "system",
  notifications: "system",
  settings: "system",
};
const pending = new WeakMap<AdminStore, Map<Group, Promise<void>>>();
export function clearSeedCache(store: AdminStore) {
  pending.delete(store);
}
export async function drainSeedJobs(store: AdminStore) {
  await Promise.allSettled([...(pending.get(store)?.values() ?? [])]);
}
export async function ensureDataset(store: AdminStore, entity: EntityKey) {
  const group = groupForEntity[entity];
  let jobs = pending.get(store);
  if (!jobs) {
    jobs = new Map();
    pending.set(store, jobs);
  }
  if (jobs.has(group)) return jobs.get(group);
  const job = (async () => {
    if (await store.getMeta(`seed:${group}`)) return;
    for (const dep of dependencies[group]) await ensureGroup(dep);
    const { seed } = await factories[group]();
    const batch = seed();
    const keys = Object.keys(batch) as EntityKey[];
    await store.transaction(keys, async (tx) => {
      for (const key of keys)
        for (const row of batch[key] ?? [])
          if (!(await tx.get(key, row.id))) await tx.put(key, row);
    });
    await store.setMeta(`seed:${group}`, true);
  })();
  jobs.set(group, job);
  try {
    await job;
  } finally {
    jobs.delete(group);
  }
  async function ensureGroup(g: Group) {
    const key = Object.entries(groupForEntity).find(([, value]) => value === g)?.[0] as EntityKey;
    await ensureDataset(store, key);
  }
}
