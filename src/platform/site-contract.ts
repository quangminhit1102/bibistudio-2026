// The contract between the reusable core and one brand's `site/` directory.

export type NavItem = { to: string; label: string };
export type SocialLink = {
  id: string;
  label: string;
  href: string;
  /** Text shown beside the label in contact lists; defaults to the label. */
  display?: string;
};
export type SiteLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Free-text place query used to build map links. */
  query: string;
};

export type SiteConfig = {
  name: string;
  shortName: string;
  /** Public origin, `https://` only, no path. */
  url: string;
  locales: string[];
  defaultLocale: string;
  contact: {
    phone: string;
    phoneDisplay: string;
    email: string;
    social: SocialLink[];
    location?: SiteLocation;
  };
  /** Legal entity printed on business documents. */
  company?: { legalName: string; address: string };
  seo: { titleSuffix: string; description: string; ogImage?: string };
  fonts: { href: string }[];
  preconnect?: { href: string; crossOrigin?: boolean }[];
  admin: { title: string; modules: string[] };
};

function fail(field: string, reason: string): never {
  throw new Error(`Invalid site config: ${field} ${reason}`);
}

function origin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail("url", "must be an absolute https:// URL");
  }
  if (parsed.protocol !== "https:") fail("url", "must use https://");
  if (parsed.pathname !== "/" || parsed.search || parsed.hash)
    fail("url", "must be an origin without path, query or hash");
  return parsed.origin;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function defineSite(config: SiteConfig): SiteConfig {
  if (!config.name.trim()) fail("name", "must not be empty");
  if (!config.shortName.trim()) fail("shortName", "must not be empty");
  if (config.locales.length === 0) fail("locales", "must list at least one locale");
  if (!config.locales.includes(config.defaultLocale))
    fail("defaultLocale", "must be one of locales");
  return deepFreeze(structuredClone({ ...config, url: origin(config.url) }));
}

export function siteUrl(site: Pick<SiteConfig, "url">, path = ""): string {
  return path ? `${site.url}/${path.replace(/^\/+/, "")}` : site.url;
}
