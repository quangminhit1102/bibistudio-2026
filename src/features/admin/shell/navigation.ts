import type { DemoSession, Role } from "../services/contracts";
import { can, canCode } from "../accounts/permissions";
import {
  disabledAdminPath,
  enabledModules,
  modulesOn,
  type NavigationGroupId,
  type NavigationItem,
} from "../modules";
export type { NavigationItem };
export type NavigationGroup = { id: string; label: string; items: NavigationItem[] };
const groups: { id: NavigationGroupId; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "products", label: "Quản lý sản phẩm" },
  { id: "business", label: "Kinh doanh" },
  { id: "content", label: "Nội dung" },
  { id: "management", label: "Quản trị" },
];
/** The menu of the modules that are on; a group without items is left out. */
export function buildNavigation(enabled: ReadonlySet<string>): NavigationGroup[] {
  const items = modulesOn(enabled).flatMap((module) => module.items);
  return groups
    .map(({ id, label }) => ({
      id,
      label,
      items: items.filter((item) => item.group === id).map(({ group: _group, ...item }) => item),
    }))
    .filter((group) => group.items.length > 0);
}
export const navigation: NavigationGroup[] = buildNavigation(enabledModules);
export function filterNavigation(session: DemoSession | null, role?: Role): NavigationGroup[] {
  return navigation
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => navigationItemAllowed(session, i, role)),
    }))
    .filter((g) => g.items.length > 0);
}
function navigationItemAllowed(
  session: DemoSession | null,
  item: NavigationItem,
  role?: Role,
): boolean {
  if (session?.kind === "http" && item.permissionCodes)
    return item.permissionCodes.every((code) => canCode(session, code));
  return (
    can(session, item.resource, "view", role) &&
    can(session, item.resource, item.action ?? "view", role)
  );
}
export function canAccessAdminPath(
  session: DemoSession | null,
  pathname: string,
  role?: Role,
): boolean {
  if (["/admin", "/admin/"].includes(pathname)) return !!session;
  if (disabledAdminPath(pathname)) return false;
  const items = navigation.flatMap((group) => group.items);
  const direct = items
    .filter((item) => pathname === item.path || pathname.startsWith(item.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (direct) return navigationItemAllowed(session, direct, role);
  const module = pathname.split("/")[2];
  const fallback = items.find((item) => item.path.split("/")[2] === module);
  return !!fallback && can(session, fallback.resource, "view", role);
}
export function activeNavigationItem(
  groups: NavigationGroup[],
  pathname: string,
): NavigationItem | undefined {
  const match = pathname.match(/\/admin(?:\/|$)/);
  if (!match) return;
  const path = pathname.slice(match.index).replace(/\/$/, "");
  const items = groups.flatMap((g) => g.items);
  const exact = items.find((i) => i.path === path);
  if (exact) return exact;
  return items
    .map((item) => ({
      item,
      prefix: item.path === "/admin/products/list" ? "/admin/products" : item.path,
    }))
    .filter(({ prefix }) => path.startsWith(prefix + "/"))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.item;
}
