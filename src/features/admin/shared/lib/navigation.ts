/** Split trusted app links so TanStack Router preserves their query parameters. */
export function internalTarget(href: string) {
  const url = new URL(href, "https://admin.local");
  return { to: url.pathname as "/admin", search: Object.fromEntries(url.searchParams) as never };
}
