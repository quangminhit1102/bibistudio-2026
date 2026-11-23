import type { LucideIcon } from "lucide-react";
import type { AdminModuleId } from "@/platform/site-contract";
import { site } from "@/platform/site";
import type { Resource } from "./services/contracts";
import { accountsModule } from "./accounts/module";
import { analyticsModule } from "./analytics/module";
import { auditModule } from "./audit/module";
import { componentsModule } from "./components/module";
import { contentModule } from "./content/module";
import { customersModule } from "./customers/module";
import { dashboardModule } from "./dashboard/module";
import { notificationsModule } from "./notifications/module";
import { inventoryModule, productsModule } from "./products/module";
import { salesModule } from "./sales/module";
import { preferencesModule, settingsModule } from "./settings/module";

export type NavigationGroupId = "overview" | "products" | "business" | "content" | "management";
export type NavigationItem = {
  label: string;
  path: string;
  resource: Resource;
  action?: "view" | "create";
  icon: LucideIcon;
  permissionCodes?: string[];
};
/** What one admin feature declares. `core` is always on; the others are listed by the site. */
export type AdminModule = {
  id: AdminModuleId | "core";
  /** The permission resource that is refused while the module is off. */
  resource?: Resource;
  /** Address prefixes the module owns. */
  paths: string[];
  /** Modules this one works on; it is on only while they are. */
  requires?: AdminModuleId[];
  /** Its data is kept only in the browser. */
  browserOnly?: boolean;
  items: (NavigationItem & { group: NavigationGroupId })[];
};

/** In menu order: inside a group, items appear in the order of this list. */
export const adminModules: AdminModule[] = [
  dashboardModule,
  analyticsModule,
  productsModule,
  inventoryModule,
  customersModule,
  salesModule,
  contentModule,
  accountsModule,
  auditModule,
  settingsModule,
  preferencesModule,
  notificationsModule,
  componentsModule,
];

export const enabledModules: ReadonlySet<string> = new Set(site.admin.modules);
const isOn = (module: AdminModule, enabled: ReadonlySet<string>) =>
  module.id === "core" ||
  (enabled.has(module.id) && (module.requires ?? []).every((id) => enabled.has(id)));

export function moduleEnabled(
  id: AdminModuleId,
  enabled: ReadonlySet<string> = enabledModules,
): boolean {
  return adminModules.some((module) => module.id === id && isOn(module, enabled));
}

export function modulesOn(enabled: ReadonlySet<string> = enabledModules): AdminModule[] {
  return adminModules.filter((module) => isOn(module, enabled));
}

export function resourceEnabled(
  resource: Resource,
  enabled: ReadonlySet<string> = enabledModules,
): boolean {
  const owners = adminModules.filter((module) => module.resource === resource);
  return owners.length === 0 || owners.some((module) => isOn(module, enabled));
}

/** The module that owns an admin address (longest prefix), or null for an always-on page. */
export function moduleForAdminPath(pathname: string): AdminModuleId | null {
  const match = pathname.match(/\/admin(?:\/|$)/);
  if (!match) return null;
  const path = pathname.slice(match.index).replace(/\/+$/, "");
  let owner: { id: AdminModule["id"]; length: number } | undefined;
  for (const module of adminModules)
    for (const prefix of module.paths)
      if (
        (path === prefix || path.startsWith(prefix + "/")) &&
        prefix.length > (owner?.length ?? 0)
      )
        owner = { id: module.id, length: prefix.length };
  return !owner || owner.id === "core" ? null : owner.id;
}

export function disabledAdminPath(
  pathname: string,
  enabled: ReadonlySet<string> = enabledModules,
): boolean {
  const owner = moduleForAdminPath(pathname);
  return owner !== null && !moduleEnabled(owner, enabled);
}
