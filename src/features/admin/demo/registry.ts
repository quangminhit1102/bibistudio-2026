import type { AdminModels, AdminStore, EntityKey, AdminProduct } from "../services/contracts";
export type SeedBatch = { [K in EntityKey]?: AdminModels[K][] };
type Group =
  | "accounts"
  | "taxonomy"
  | "products"
  | "bookstore"
  | "content"
  | "sales"
  | "analytics"
  | "system"
  | "business"
  | "stock";
const factories = {
  accounts: () => import("../accounts/seed"),
  taxonomy: () => import("../products/taxonomy-seed"),
  products: () => import("../products/seed"),
  bookstore: () => import("../bookstore/seed"),
  content: () => import("../content/seed"),
  sales: () => import("../sales/seed"),
  analytics: () => import("../analytics/seed"),
  system: () => import("../settings/seed"),
  business: () => import("../sales/business-seed"),
  stock: () => import("../products/stock-seed"),
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
  business: ["products"],
  stock: ["products"],
};
export const groupForEntity: Record<EntityKey, Group> = {
  customers: "business",
  purchaseSlips: "business",
  notificationReads: "system",
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
  stock: "stock",
  visitors: "analytics",
  sessions: "analytics",
  audit: "system",
  notifications: "system",
  settings: "system",
};
const pending = new WeakMap<AdminStore, Map<Group, Promise<void>>>();
const active = new WeakMap<AdminStore, Set<Promise<void>>>();
export function clearSeedCache(store: AdminStore) {
  pending.delete(store);
}
export async function drainSeedJobs(store: AdminStore) {
  while (active.get(store)?.size) await Promise.allSettled([...active.get(store)!]);
}
export function ensureDataset(store: AdminStore, entity: EntityKey): Promise<void> {
  let jobs = active.get(store);
  if (!jobs) {
    jobs = new Set();
    active.set(store, jobs);
  }
  const job = ensureEntityDataset(store, entity);
  jobs.add(job);
  void job.then(
    () => jobs.delete(job),
    () => jobs.delete(job),
  );
  return job;
}
async function ensureEntityDataset(store: AdminStore, entity: EntityKey) {
  const group = groupForEntity[entity];
  let jobs = pending.get(store);
  if (!jobs) {
    jobs = new Map();
    pending.set(store, jobs);
  }
  let job = jobs.get(group);
  if (!job) {
    job = (async () => {
      const marker = ["business", "stock"].includes(group) ? `seed:${group}:v2` : `seed:${group}`;
      if (await store.getMeta(marker)) {
        return;
      }
      for (const dep of dependencies[group]) await ensureGroup(dep);
      const { seed }: { seed: (context?: { products?: AdminProduct[] }) => SeedBatch } =
        await factories[group]();
      const batch = seed(
        group === "business" || group === "sales"
          ? { products: await store.list("products") }
          : undefined,
      );
      const keys = Object.keys(batch) as EntityKey[];
      await store.transaction(keys, async (tx) => {
        for (const key of keys)
          for (const row of batch[key] ?? [])
            if (!(await tx.get(key, row.id))) await tx.put(key, row);
      });
      await store.setMeta(marker, true);
    })();
    jobs.set(group, job);
  }
  try {
    await job;
    const { upgradePresentation } = await import("./presentation-upgrade");
    await upgradePresentation(store, entity);
    if (entity === "posts" || entity === "media") {
      const { ensureContentMedia } = await import("../content/seed-upgrade");
      await ensureContentMedia(store);
    }
  } finally {
    if (jobs.get(group) === job) jobs.delete(group);
  }
  async function ensureGroup(g: Group) {
    const key = Object.entries(groupForEntity).find(([, value]) => value === g)?.[0] as EntityKey;
    await ensureDataset(store, key);
  }
}
