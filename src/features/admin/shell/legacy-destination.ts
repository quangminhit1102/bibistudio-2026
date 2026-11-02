export function legacyDestination(
  pathname: string,
): { to: string; search?: Record<string, string> } | null {
  const path = pathname.replace(/\/+$/, "");
  if (/^\/admin\/bookstore(?:\/|$)/.test(path)) return { to: "/admin/customers" };
  if (/^\/admin\/sales(?:\/(?:orders(?:\/.*)?|order-history|transactions))?$/.test(path))
    return { to: "/admin/sales/slips" };
  if (path === "/admin/notifications") return { to: "/admin/dashboard" };
  const visitor = path.match(/^\/admin\/analytics\/visitors\/([^/]+)$/);
  if (visitor) return { to: "/admin/analytics/visitors", search: { visitor: visitor[1] } };
  if (/^\/admin\/analytics(?:\/(?:overview|sessions|pages|traffic-sources))?$/.test(path))
    return { to: "/admin/analytics/visitors" };
  return null;
}
