/** A document-navigation boundary only. Tracking still uses an exact published allowlist. */
export function isBlogDocumentPath(path: string): boolean {
  return /^\/blog(?:[/?#]|$)/.test(path);
}
export interface PublishedCatalogue {
  routes: Array<{ path: string; label: string }>;
  products: Array<{ slug: string; name: string }>;
}
export function withPublishedBlog(
  base: PublishedCatalogue,
  active: Pick<PublishedCatalogue, "routes">,
): PublishedCatalogue {
  return {
    routes: [
      ...base.routes.filter((route) => !isBlogDocumentPath(route.path)),
      ...active.routes.filter((route) => /^\/blog(?:\/[a-z0-9-]+)*$/.test(route.path)),
    ],
    products: base.products,
  };
}
