import { describe, expect, it, vi } from "vitest";
import { site } from "@/platform/site";
import {
  adminModules,
  disabledAdminPath,
  moduleEnabled,
  moduleForAdminPath,
} from "../../src/features/admin/modules";
import { buildNavigation } from "../../src/features/admin/shell/navigation";
import blankSite from "../fixtures/site-blank/site.config";

const paths = (enabled: string[]) =>
  buildNavigation(new Set(enabled)).map((group) => [
    group.id,
    ...group.items.map((item) => item.path.replace("/admin/", "")),
  ]);
const every = adminModules.flatMap((module) => (module.id === "core" ? [] : [module.id]));

describe("admin modules", () => {
  it("builds today's menu, in order, when every module is on", () => {
    expect(paths(every)).toEqual([
      ["overview", "dashboard", "analytics/visitors"],
      [
        "products",
        "products/list",
        "products/create",
        "products/types",
        "products/categories",
        "products/inventory",
      ],
      ["business", "customers", "sales/slips", "sales/reports"],
      ["content", "content/posts", "content/posts/create", "content/categories", "content/media"],
      [
        "management",
        "accounts/users",
        "accounts/roles",
        "accounts/permissions",
        "audit-logs",
        "settings/general",
        "settings/appearance",
        "settings/profile",
        "components/overview",
        "components/actions",
        "components/forms",
        "components/data-display",
        "components/navigation",
        "components/overlays",
        "components/feedback",
        "components/charts",
      ],
    ]);
  });

  it("builds only the listed modules, and always the dashboard and own preferences", () => {
    expect(paths(["content", "accounts"])).toEqual([
      ["overview", "dashboard"],
      ["content", "content/posts", "content/posts/create", "content/categories", "content/media"],
      [
        "management",
        "accounts/users",
        "accounts/roles",
        "accounts/permissions",
        "settings/appearance",
        "settings/profile",
      ],
    ]);
  });

  it("finds the module that owns an address by its longest prefix", () => {
    expect(moduleForAdminPath("/admin/products/inventory")).toBe("inventory");
    expect(moduleForAdminPath("/admin/products/abc/edit")).toBe("products");
    expect(moduleForAdminPath("/admin/bookstore/books")).toBe("customers");
    expect(moduleForAdminPath("/admin/sales/orders/1")).toBe("sales");
    expect(moduleForAdminPath("/admin/audit-logs")).toBe("audit");
    expect(moduleForAdminPath("/admin/settings/general")).toBe("settings");
    expect(moduleForAdminPath("/base/admin/notifications")).toBe("notifications");
    for (const own of ["/admin", "/admin/dashboard", "/admin/settings/profile", "/admin/login"])
      expect(moduleForAdminPath(own)).toBeNull();
  });

  it("names an address of a module that is off, and no other", () => {
    const on = new Set(["content"]);
    expect(disabledAdminPath("/admin/sales/slips", on)).toBe(true);
    expect(disabledAdminPath("/admin/content/posts", on)).toBe(false);
    expect(disabledAdminPath("/admin/dashboard", on)).toBe(false);
    expect(disabledAdminPath("/admin/settings/profile", on)).toBe(false);
  });

  it("a module is on only while the modules it works on are", () => {
    const on = new Set(["inventory", "content"]);
    expect(moduleEnabled("inventory", on)).toBe(false);
    expect(disabledAdminPath("/admin/products/inventory", on)).toBe(true);
    expect(paths(["inventory", "content"]).map(([group]) => group)).toEqual([
      "overview",
      "content",
      "management",
    ]);
    expect(moduleEnabled("inventory", new Set(["inventory", "products"]))).toBe(true);
  });

  it("the site lists only modules that exist, each once, with the modules they work on", () => {
    for (const module of adminModules)
      if (module.id !== "core" && site.admin.modules.includes(module.id))
        expect(site.admin.modules).toEqual(expect.arrayContaining(module.requires ?? []));
    expect(site.admin.modules.filter((id) => !every.includes(id))).toEqual([]);
    expect(new Set(site.admin.modules).size).toBe(site.admin.modules.length);
  });

  it("the blank site switches every module on, so the whole admin suite runs against it", () => {
    expect([...blankSite.admin.modules].sort()).toEqual([...every].sort());
  });
});

describe("a module that is off", () => {
  it("is refused by can() and by canAccessAdminPath, whatever the role allows", async () => {
    vi.resetModules();
    vi.doMock("@/platform/site", async (original) => {
      const real = await original<typeof import("@/platform/site")>();
      return {
        ...real,
        site: { ...real.site, admin: { ...real.site.admin, modules: ["content"] } },
      };
    });
    const { can } = await import("../../src/features/admin/accounts/permissions");
    const { canAccessAdminPath, navigation } =
      await import("../../src/features/admin/shell/navigation");
    const session = { userId: "u", roleId: "super-admin" };
    expect(can(session, "content", "view")).toBe(true);
    expect(can(session, "dashboard", "view")).toBe(true);
    expect(can(session, "settings", "view")).toBe(true);
    for (const resource of ["sales", "products", "bookstore", "notifications"] as const)
      expect(can(session, resource, "view")).toBe(false);
    expect(canAccessAdminPath(session, "/admin/content/posts")).toBe(true);
    expect(canAccessAdminPath(session, "/admin/products/inventory")).toBe(false);
    expect(canAccessAdminPath(session, "/admin/settings/general")).toBe(false);
    expect(navigation.map((group) => group.id)).toEqual(["overview", "content", "management"]);
    vi.doUnmock("@/platform/site");
    vi.resetModules();
  });
});
