import { afterEach, expect, it, vi } from "vitest";
import { openDB } from "idb";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { clearSeedCache, ensureDataset } from "../../src/features/admin/demo/registry";
import { entityKeys, type AdminStore } from "../../src/features/admin/services/contracts";
import { resetDemoData } from "../../src/features/admin/settings/service";

const stores: AdminStore[] = [];
const fresh = (name: string, options?: { onBlocked?: () => void }) => {
  const store = createAdminStore(name, options);
  stores.push(store);
  return store;
};
afterEach(async () => {
  for (const s of stores.splice(0)) await s.destroy();
});

async function legacy(name: string) {
  return openDB(name, 1, {
    upgrade(db) {
      for (const key of entityKeys.filter(
        (k) => !["customers", "purchaseSlips", "notificationReads"].includes(k),
      ))
        db.createObjectStore(key, { keyPath: "id" });
      db.createObjectStore("meta");
      db.createObjectStore("blobs");
    },
  });
}

it("upgrades v1 without losing custom product post blob profile roles or legacy orders", async () => {
  const name = "business-upgrade-preserve";
  const db = await legacy(name);
  const records = [
    ["products", { id: "custom-1", name: "Sổ người dùng", revision: 7 }],
    ["posts", { id: "custom-post", title: "Bài viết riêng", content: "keep" }],
    ["settings", { id: "profile", key: "profile", values: { name: "Tên riêng" } }],
    ["roles", { id: "custom-role", permissions: { sales: ["view"] } }],
    ["orders", { id: "legacy-order", total: 1234, notes: "keep" }],
  ] as const;
  for (const [key, record] of records) await db.put(key, record);
  await db.put("blobs", new Blob(["private-image-bytes"]), "custom-blob");
  await db.put("meta", true, "seed:sales");
  db.close();
  const store = fresh(name);
  expect(await store.list("customers")).toEqual([]);
  for (const [key, record] of records) expect(await store.get(key, record.id)).toEqual(record);
  expect(await (await store.getBlob("custom-blob"))?.text()).toBe("private-image-bytes");
  expect(await store.getMeta("seed:sales")).toBe(true);
  await ensureDataset(store, "purchaseSlips");
  expect(await store.get("roles", "custom-role")).toEqual(records[3][1]);
  expect(await store.list("orders")).toEqual([records[4][1]]);
});

it("blocked upgrade is visible and resumes after old connection closes", async () => {
  const db = await legacy("business-upgrade-blocked");
  const blocked = vi.fn();
  const store = fresh("business-upgrade-blocked", { onBlocked: blocked });
  const reading = store.list("customers");
  void reading.catch(() => {});
  try {
    await vi.waitFor(() => expect(blocked).toHaveBeenCalled(), { timeout: 700 });
  } finally {
    db.close();
    await reading.catch(() => {});
  }
  expect(await reading).toEqual([]);
});

it("seed retry keeps twelve customers thirty slips and does not overwrite edits", async () => {
  const s = fresh("business-upgrade-seed");
  await ensureDataset(s, "customers");
  expect(await s.list("customers")).toHaveLength(12);
  expect(await s.list("purchaseSlips")).toHaveLength(30);
  const customer = (await s.list("customers"))[0];
  await s.transaction(["customers"], (tx) =>
    tx.put("customers", { ...customer, name: "Tên đã sửa" }),
  );
  await s.setMeta("seed:business:v2", false);
  clearSeedCache(s);
  await ensureDataset(s, "purchaseSlips");
  expect(await s.list("purchaseSlips")).toHaveLength(30);
  expect((await s.get("customers", customer.id))?.name).toBe("Tên đã sửa");
  for (const slip of await s.list("purchaseSlips"))
    expect(slip.total).toBe(slip.items.reduce((n, i) => n + i.quantity * i.unitPrice, 0));
  expect(await s.list("books")).toEqual([]);
  expect(await s.list("orders")).toEqual([]);
});

it("stock access never initializes legacy books or orders", async () => {
  const s = fresh("business-upgrade-stock");
  await ensureDataset(s, "stock");
  expect(await s.list("books")).toEqual([]);
  expect(await s.list("orders")).toEqual([]);
  expect(await s.list("stock")).toEqual([]);
});

it("quota abort leaves no business success marker and retry does not duplicate", async () => {
  const s = fresh("business-upgrade-quota");
  await ensureDataset(s, "products");
  const failed: AdminStore = {
    ...s,
    transaction: async (keys, work) => {
      if (keys.includes("purchaseSlips")) throw new DOMException("Quota", "QuotaExceededError");
      return s.transaction(keys, work);
    },
  };
  await expect(ensureDataset(failed, "customers")).rejects.toThrow();
  expect(await s.getMeta("seed:business:v2")).toBeUndefined();
  expect(await s.list("customers")).toEqual([]);
  await ensureDataset(s, "customers");
  expect(await s.list("purchaseSlips")).toHaveLength(30);
});

it("explicit workspace reset clears new and legacy stores and can reseed", async () => {
  const s = fresh("business-upgrade-reset");
  await ensureDataset(s, "users");
  await ensureDataset(s, "customers");
  await resetDemoData(s, { userId: "user-1", roleId: "super-admin" });
  expect(await s.list("customers")).toEqual([]);
  expect(await s.list("purchaseSlips")).toEqual([]);
  expect(await s.list("roles")).toEqual([]);
  await ensureDataset(s, "customers");
  expect(await s.list("customers")).toHaveLength(12);
});
