import type { AdminStore } from "../../../src/features/admin/services/contracts";
import { createLocalAuthService } from "../../../src/features/admin/accounts/auth/local-service";
import { ensureDataset } from "../../../src/features/admin/demo/registry";

/** Explicit adapter for legacy local business/editor tests. Production defaults to HTTP. */
export function fixtureAuthFactory(store: AdminStore) {
  return createLocalAuthService(store, () => ensureDataset(store, "users"));
}
