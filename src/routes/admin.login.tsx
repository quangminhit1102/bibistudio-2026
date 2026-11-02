import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";
import { safeAdminReturnTo } from "../features/admin/accounts/auth/return-to";
function LoginDestination() {
  const search = useRouterState({ select: (s) => s.location.search as { returnTo?: unknown } });
  const base = (import.meta.env.VITE_ROUTER_BASEPATH || "/").replace(/\/$/, "");
  const url = new URL(safeAdminReturnTo(search.returnTo, base || "/"), "https://admin.local");
  return (
    <Navigate
      to={url.pathname.slice(base.length) as "/admin/dashboard"}
      search={Object.fromEntries(url.searchParams) as never}
      hash={url.hash.slice(1)}
      replace
    />
  );
}
export const Route = createFileRoute("/admin/login")({
  component: LoginDestination,
});
