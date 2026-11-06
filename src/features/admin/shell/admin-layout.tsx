import { useEffect, useState, lazy, Suspense, type CSSProperties } from "react";
import { useSidebarResize } from "./sidebar-resize";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "../accounts/profile-service";
import { Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Menu, PanelLeftClose, PanelLeftOpen, Sun, Moon, Search } from "lucide-react";
import { useAdmin, useRole } from "../services/context";
import { can } from "../accounts/permissions";
import { Login } from "../accounts/pages/login";
import { AccountMenu } from "./account-menu";
import { AdminThemeContext } from "../shared/ui/admin-theme";
import { filterNavigation, activeNavigationItem, canAccessAdminPath } from "./navigation";
import { useNavigationGroups } from "./navigation-groups";
import { SidebarNavigation } from "./sidebar-navigation";
import { HeaderNotifications } from "../notifications/header-menu";
import { ErrorState } from "../shared/ui/primitives";
import { Button, Modal, NoticeProvider, Skeleton } from "../shared/ui/primitives";
const GlobalSearch = lazy(() => import("./global-search"));
export function AdminLayout() {
  const runtime = useAdmin();
  const { session, logout } = runtime;
  const navigate = useNavigate();
  const role = useRole();
  const account = useQuery({
    queryKey: [
      "bibi-admin",
      "session",
      runtime.session?.userId,
      runtime.session?.kind === "http" ? runtime.session.principal.revision : undefined,
    ],
    enabled: !!runtime.session,
    queryFn: async () => {
      if (runtime.session?.kind === "http") return runtime.session.principal;
      await runtime.ensure("users");
      return getProfile(runtime.store, runtime.session);
    },
  });
  useEffect(() => {
    if (
      session &&
      (account.error ||
        (session.kind !== "http" &&
          account.data &&
          "roleId" in account.data &&
          account.data.roleId !== session.roleId))
    )
      void logout();
  }, [account.error, account.data, session, logout]);
  const [collapsed, setCollapsed] = useState(false);
  const [responsiveRail, setResponsiveRail] = useState(false);
  useEffect(() => {
    // Keep the tooltip state in sync with the icon-only rail breakpoint in admin.css.
    const query = matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const update = () => setResponsiveRail(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const sidebar = useSidebarResize(!collapsed);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const allowed = filterNavigation(runtime.session, role.data);
  const canSearch = (["products", "bookstore", "sales", "content", "accounts"] as const).some(
    (resource) => can(session, resource, "view", role.data),
  );
  const home = allowed[0]?.items[0]?.path ?? "/admin/analytics/visitors";
  useEffect(() => {
    if (session && ["/admin", "/admin/"].includes(pathname)) {
      void navigate({ to: home as "/admin" });
      return;
    }
    if (
      session?.kind === "http" &&
      !can(session, "dashboard", "view") &&
      ["/admin", "/admin/", "/admin/dashboard"].includes(pathname)
    )
      void navigate({ to: home as "/admin" });
  }, [session, pathname, navigate, home]);
  const navGroups = useNavigationGroups(pathname);
  useEffect(() => {
    const q = matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(q.matches);
    const change = () => setSystemDark(q.matches);
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (canSearch && (e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [canSearch]);
  const dark = runtime.theme === "dark" || (runtime.theme === "system" && systemDark);
  const active = activeNavigationItem(allowed, pathname);
  const ownPreferences =
    (pathname.endsWith("/settings/profile") || pathname.endsWith("/settings/appearance")) &&
    (session?.kind !== "http" ||
      can(session, "accounts", "view", role.data) ||
      can(session, "settings", "view", role.data));
  const forbidden = !ownPreferences && !canAccessAdminPath(runtime.session, pathname, role.data);
  const nav = (
    <>
      <Link to={home as "/admin"} className="a-wordmark">
        <b>B</b>
        <span>
          BiBi Admin<small>KHÔNG GIAN QUẢN TRỊ</small>
        </span>
      </Link>
      <SidebarNavigation
        groups={allowed}
        pathname={pathname}
        {...navGroups}
        collapsed={(collapsed || responsiveRail) && !drawer}
      />
      <div className="a-sidebar-footer">
        {account.data && <AccountMenu user={account.data} compact={collapsed && !drawer} />}
      </div>
    </>
  );
  return (
    <AdminThemeContext.Provider value={dark}>
      <div className={`admin-root ${dark ? "dark" : ""}`}>
        <NoticeProvider>
          {runtime.sessionLoading ? (
            <Skeleton />
          ) : !runtime.session ? (
            <Login />
          ) : (
            <div
              className={`a-app ${collapsed ? "a-collapsed" : ""} ${sidebar.dragging ? "a-resizing" : ""}`}
              style={{ "--a-sidebar-width": `${sidebar.width}px` } as CSSProperties}
            >
              <div className="a-sidebar-frame">
                <aside id="admin-sidebar" className="a-sidebar">
                  {nav}
                </aside>
                {sidebar.separator}
              </div>
              <div className="a-workspace">
                <header className="a-topbar">
                  <Button
                    className="a-mobile-menu"
                    size="icon"
                    variant="ghost"
                    aria-label="Mở menu quản trị"
                    onClick={() => setDrawer(true)}
                  >
                    <Menu size={19} />
                  </Button>
                  <Button
                    className="a-desktop-collapse"
                    size="icon"
                    variant="ghost"
                    aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
                    onClick={() => setCollapsed((v) => !v)}
                  >
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                  </Button>
                  <div className="a-breadcrumb">
                    <span>Quản trị</span>
                    <span>/</span>
                    <strong>{active?.label ?? "BiBi Admin"}</strong>
                  </div>
                  <div className="a-top-actions">
                    {canSearch && (
                      <Button
                        variant="ghost"
                        className="a-search-trigger"
                        onClick={() => setSearch(true)}
                      >
                        <Search size={16} />
                        <span>Tìm kiếm</span>
                        <kbd>⌘ K</kbd>
                      </Button>
                    )}
                    {can(runtime.session, "notifications", "view", role.data) && (
                      <HeaderNotifications />
                    )}
                    {can(session, "settings", "view", role.data) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Đổi giao diện sáng tối"
                        onClick={() => runtime.setTheme(dark ? "light" : "dark")}
                      >
                        {dark ? <Sun size={18} /> : <Moon size={18} />}
                      </Button>
                    )}
                    <div className="a-header-account">
                      {account.data && <AccountMenu user={account.data} compact />}
                    </div>
                  </div>
                </header>
                <main className="a-main">
                  {["/admin", "/admin/"].includes(pathname) ||
                  (session?.kind !== "http" && role.isPending) ||
                  account.isPending ? (
                    <Skeleton />
                  ) : forbidden ? (
                    <ErrorState
                      error={new Error("Vai trò hiện tại không có quyền truy cập module này.")}
                    />
                  ) : (
                    <Outlet />
                  )}
                </main>
                <footer className="a-app-footer">
                  BiBi Studio <span>Quản trị nội dung</span>
                </footer>
              </div>
              <Modal
                open={drawer}
                onOpenChange={setDrawer}
                title="Điều hướng"
                description="Chọn module quản trị"
              >
                <div className="a-drawer-nav">{nav}</div>
              </Modal>
              {search && canSearch && (
                <Suspense fallback={<Skeleton />}>
                  <GlobalSearch onClose={() => setSearch(false)} />
                </Suspense>
              )}
            </div>
          )}
        </NoticeProvider>
      </div>
    </AdminThemeContext.Provider>
  );
}
