export function safeAdminReturnTo(value: unknown, basepath: string): string {
  const base = basepath === "/" ? "" : basepath.replace(/\/$/, "");
  const root = base + "/admin";
  const fallback = root + "/dashboard";
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://admin.local");
    const decoded = decodeURIComponent(url.pathname);
    if (
      decoded !== url.pathname ||
      !url.pathname.startsWith(root + "/") ||
      url.origin !== "https://admin.local" ||
      url.pathname === root + "/login"
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
