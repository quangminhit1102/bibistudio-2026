export function resolveCatalogueImageUrl(url: string, base: string): string {
  return url.startsWith("/catalogue/") ? `${base.replace(/\/$/, "")}${url}` : url;
}
