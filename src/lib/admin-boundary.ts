/** Pure boundary check; deliberately imports no admin implementation. */
export function isAdminPath(pathname: string, basepath = "/"): boolean {
  const base = basepath.replace(/\/$/, "");
  const path = base && pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
  return path === "/admin" || path.startsWith("/admin/");
}
