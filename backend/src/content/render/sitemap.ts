import { escapeContentHtml as escape } from "../rich-policy";
import { publicOrigin } from "../public-schema";
export function sitemapXml(
  entries: Array<{ path: string; lastmod?: string }>,
  origin: string,
): string {
  origin = publicOrigin(origin);
  if (entries.length > 50000) throw Error("Sitemap URL limit exceeded");
  const seen = new Set<string>();
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries
    .filter((entry) => {
      if (seen.has(entry.path)) return false;
      seen.add(entry.path);
      return true;
    })
    .map((entry) => {
      if (!/^\/[A-Za-z0-9/_-]*$/.test(entry.path)) throw Error("Invalid canonical sitemap path");
      if (
        entry.lastmod &&
        (!/^\d{4}-\d\d-\d\d(?:T[^\s]+)?$/.test(entry.lastmod) ||
          !Number.isFinite(Date.parse(entry.lastmod)))
      )
        throw Error("Invalid sitemap date");
      return `<url><loc>${escape(origin + entry.path)}</loc>${entry.lastmod ? `<lastmod>${escape(entry.lastmod)}</lastmod>` : ""}</url>`;
    })
    .join("")}</urlset>`;
}
export function buildSiteSitemap(
  routes: Array<{ path: string; lastmod?: string }>,
  origin: string,
): string {
  return sitemapXml(
    routes.filter(
      (route) => !/^\/(?:admin|api|preview|blog|auth|node-test|media)(?:\/|$)/.test(route.path),
    ),
    origin,
  );
}
