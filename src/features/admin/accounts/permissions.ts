import type { Action, DemoSession, Resource, Role, EntityKey } from "../services/contracts";
import { ServiceError } from "../services/errors";
import type { AdminStore } from "../services/contracts";
export async function authorizeOperation(
  store: AdminStore,
  session: DemoSession | null,
  resource: Resource,
  action: Action,
) {
  const generation = store.generation;
  const assertActive = () => {
    if (generation !== store.generation)
      throw new ServiceError("aborted", "Phiên đã thay đổi. Thao tác cũ đã bị hủy.");
  };
  const role = session ? await store.get("roles", session.roleId) : undefined;
  const user = session ? await store.get("users", session.userId) : undefined;
  assertActive();
  if (user && (!user.active || user.roleId !== session?.roleId))
    throw new ServiceError("forbidden", "Tài khoản đã thay đổi, hãy đăng nhập lại.");
  requirePermission(session, resource, action, role);
  return assertActive;
}
export const resources: Resource[] = [
  "dashboard",
  "analytics",
  "products",
  "bookstore",
  "sales",
  "content",
  "accounts",
  "audit",
  "notifications",
  "settings",
  "components",
];
export const actions: Action[] = ["view", "create", "update", "delete", "export", "settings"];
export const roleNames: Record<string, string> = {
  "super-admin": "Super Admin",
  administrator: "Administrator",
  manager: "Manager",
  editor: "Editor",
  viewer: "Viewer",
};
export function defaultPermissions(id: string): Role["permissions"] {
  if (id === "super-admin" || id === "administrator")
    return Object.fromEntries(resources.map((r) => [r, [...actions]]));
  if (id === "manager")
    return {
      dashboard: ["view"],
      analytics: ["view", "export"],
      products: [...actions],
      bookstore: [...actions],
      sales: [...actions],
      notifications: ["view", "update"],
      components: ["view"],
    };
  if (id === "editor")
    return {
      dashboard: ["view"],
      products: ["view"],
      content: [...actions],
      notifications: ["view", "update"],
      components: ["view"],
    };
  if (id === "viewer")
    return Object.fromEntries(
      [
        "dashboard",
        "analytics",
        "products",
        "bookstore",
        "sales",
        "content",
        "notifications",
        "components",
      ].map((r) => [r, ["view"]]),
    );
  return {};
}
export function can(session: DemoSession | null, resource: Resource, action: Action, role?: Role) {
  return (
    !!session &&
    (role?.permissions ?? defaultPermissions(session.roleId))[resource]?.includes(action) === true
  );
}
export function requirePermission(
  session: DemoSession | null,
  resource: Resource,
  action: Action,
  role?: Role,
) {
  if (!can(session, resource, action, role))
    throw new ServiceError(
      "forbidden",
      "Vai trò demo hiện tại không có quyền thực hiện thao tác này.",
    );
}
export const resourceForEntity = (entity: EntityKey): Resource =>
  (
    ({
      products: "products",
      books: "bookstore",
      authors: "bookstore",
      publishers: "bookstore",
      categories: "products",
      roles: "accounts",
      users: "accounts",
      posts: "content",
      tags: "content",
      media: "content",
      orders: "sales",
      payments: "sales",
      stock: "products",
      visitors: "analytics",
      sessions: "analytics",
      audit: "audit",
      notifications: "notifications",
      settings: "settings",
    }) as const
  )[entity];
