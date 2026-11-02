import { useEffect, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "../accounts/profile-service";
import { Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Menu, PanelLeftClose, PanelLeftOpen, Sun, Moon, Search } from "lucide-react";
import { useAdmin, useRole } from "../services/context";
import { can } from "../accounts/permissions";
import { Login } from "../accounts/pages/login";
import { AccountMenu } from "./account-menu";
import { AdminThemeContext } from "../shared/ui/admin-theme";
import { navigation } from "./navigation";
import { HeaderNotifications } from "../notifications/header-menu";
import { ErrorState } from "../shared/ui/primitives";
import { Button, Modal, NoticeProvider, Skeleton } from "../shared/ui/primitives";
const GlobalSearch = lazy(() => import("./global-search"));
export function AdminLayout() {
  const runtime = useAdmin();
  const { session, logout } = runtime;
  const role = useRole();
  const account = useQuery({
    queryKey: ["bibi-admin", "session", runtime.session?.userId],
    enabled: !!runtime.session,
    queryFn: async () => {
      await runtime.ensure("users");
      return getProfile(runtime.store, runtime.session);
    },
  });
  useEffect(() => {
    if (session && (account.error || (account.data && account.data.roleId !== session.roleId)))
      void logout();
  }, [account.error, account.data, session, logout]);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const dark = runtime.theme === "dark" || (runtime.theme === "system" && systemDark);
  const allowed = navigation
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => can(runtime.session, i.resource, i.action ?? "view", role.data)),
    }))
    .filter((g) => g.items.length);
  const active = allowed
    .flatMap((g) =>
      g.items.flatMap((i) => [{ label: i.label, path: i.path }, ...(i.children ?? [])]),
    )
    .find((i) => pathname.endsWith(i.path));
  const routeGroup = navigation
    .flatMap((g) => g.items)
    .find((i) => {
      const module = i.path.split("/")[2];
      return pathname.includes("/admin/" + module);
    });
  const ownPreferences =
    pathname.endsWith("/settings/profile") || pathname.endsWith("/settings/appearance");
  const forbidden =
    !ownPreferences && routeGroup && !can(runtime.session, routeGroup.resource, "view", role.data);
  const nav = (
    <>
      <Link to="/admin/dashboard" className="a-wordmark">
        <b>B</b>
        <span>
          BiBi Admin<small>KHÔNG GIAN QUẢN TRỊ</small>
        </span>
      </Link>
      <nav aria-label="Điều hướng quản trị">
        {allowed.map((g) => (
          <div className="a-nav-group" key={g.label}>
            <p>{g.label}</p>
            {g.items.map((item) => (
              <div key={item.path}>
                <Link
                  to={item.path as "/admin"}
                  title={item.label}
                  className={`a-nav-link ${pathname.endsWith(item.path) || (item.path === "/admin/products/list" && /\/admin\/products\/(?!create|categories|inventory|list)[^/]+/.test(pathname)) ? "active" : ""}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
                {item.children && (!collapsed || drawer) && (
                  <div className="a-nav-children">
                    {item.children
                      .filter(
                        (c) =>
                          !c.path.endsWith("/create") ||
                          can(runtime.session, item.resource, "create", role.data),
                      )
                      .map((c) => (
                        <Link
                          key={c.path}
                          to={c.path as "/admin"}
                          className={pathname.endsWith(c.path) ? "active" : ""}
                        >
                          {c.label}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>
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
            <div className={`a-app ${collapsed ? "a-collapsed" : ""}`}>
              <aside className="a-sidebar">{nav}</aside>
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
                    <Button
                      variant="ghost"
                      className="a-search-trigger"
                      onClick={() => setSearch(true)}
                    >
                      <Search size={16} />
                      <span>Tìm kiếm</span>
                      <kbd>⌘ K</kbd>
                    </Button>
                    {can(runtime.session, "notifications", "view", role.data) && (
                      <HeaderNotifications />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Đổi giao diện sáng tối"
                      onClick={() => runtime.setTheme(dark ? "light" : "dark")}
                    >
                      {dark ? <Sun size={18} /> : <Moon size={18} />}
                    </Button>
                    <div className="a-header-account">
                      {account.data && <AccountMenu user={account.data} compact />}
                    </div>
                  </div>
                </header>
                <main className="a-main">
                  {role.isPending || account.isPending ? (
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
              {search && (
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
