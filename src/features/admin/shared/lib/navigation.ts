/** Split trusted app links so TanStack Router preserves their query parameters. */
export function internalTarget(href: string) {
  const url = new URL(href, "https://admin.local");
  return { to: url.pathname as "/admin", search: Object.fromEntries(url.searchParams) as never };
}
export function safeListReturn(input: unknown, listPath: string): string {
  if (typeof input !== "string" || !input.startsWith(listPath)) return listPath;
  try {
    const url = new URL(input, "https://admin.local");
    return url.origin === "https://admin.local" && url.pathname === listPath
      ? url.pathname + url.search
      : listPath;
  } catch {
    return listPath;
  }
}
