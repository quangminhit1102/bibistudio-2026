import type { AdminStore, DemoSession } from "../services/contracts";
import { authorizeOperation, can, resourceForEntity } from "../accounts/permissions";
import { ensureDataset } from "../demo/registry";
import type { AdminHttpClient } from "../../../lib/admin-http";
import { createAccountApi } from "../accounts/http-api";
const paths = {
  products: "/admin/products/",
  customers: "/admin/customers/",
  purchaseSlips: "/admin/sales/slips/",
  posts: "/admin/content/posts/",
  users: "/admin/accounts/users/",
};
const labels = {
  products: "Sản phẩm",
  customers: "Khách mua hàng",
  purchaseSlips: "Phiếu mua hàng",
  posts: "Bài viết",
  users: "Người dùng",
};
export async function searchAdmin(
  store: AdminStore,
  session: DemoSession | null,
  term: string,
  signal?: AbortSignal,
  http?: AdminHttpClient,
) {
  if (session?.kind !== "http") await ensureDataset(store, "users");
  const role =
    session && session.kind !== "http" ? await store.get("roles", session.roleId) : undefined;
  const { createEntityService } = await import("../services/entity-service");
  const matches = [];
  if (session?.kind === "http" && http && can(session, "accounts", "view")) {
    const accounts = await createAccountApi(http).list(
      { page: 1, pageSize: 5, search: term },
      signal,
    );
    for (const account of accounts.items)
      matches.push({
        id: account.id,
        label: `${account.displayName} (${account.username})`,
        entity: "users" as const,
        kind: "Tài khoản",
        path: paths.users + encodeURIComponent(account.id),
      });
  }
  for (const entity of Object.keys(paths) as (keyof typeof paths)[]) {
    if (session?.kind === "http" && entity === "users") continue;
    const resource = resourceForEntity(entity);
    if (!can(session, resource, "view", role)) continue;
    const active = await authorizeOperation(store, session, resource, "view");
    await ensureDataset(store, entity);
    const result = await createEntityService(store, entity, () => session).list({
      page: 1,
      pageSize: 5,
      search: term,
      signal,
    });
    active();
    for (const row of result.items)
      matches.push({
        id: row.id,
        label:
          "number" in row
            ? String(row.number)
            : "name" in row
              ? String(row.name)
              : "title" in row
                ? String(row.title)
                : "",
        entity,
        kind: labels[entity],
        path: paths[entity] + (entity === "purchaseSlips" && "number" in row ? row.number : row.id),
      });
  }
  return matches;
}
