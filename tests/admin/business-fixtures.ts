import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import type { AdminStore, DemoSession } from "../../src/features/admin/services/contracts";
export async function businessFixture(
  name: string,
): Promise<{ store: AdminStore; session: DemoSession; customerId: string; productId: string }> {
  const store = createAdminStore(name);
  await ensureDataset(store, "users");
  await ensureDataset(store, "customers");
  return {
    store,
    session: { userId: "user-1", roleId: "super-admin" },
    customerId: "customer-1",
    productId: "product-1",
  };
}
