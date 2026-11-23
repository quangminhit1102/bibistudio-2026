// The contract between the reusable core and one brand's `site/` directory.
import type { Product } from "@/data/catalogue";

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
  tagline?: string;
  /** Public origin, `https://` only, no path. */
  url: string;
  locales: string[];
  defaultLocale: string;
  contact: {
    phone: string;
    phoneDisplay: string;
    /** E.164 form for structured data, e.g. `+84392969000`. */
    phoneInternational?: string;
    email: string;
    social: SocialLink[];
    location?: SiteLocation;
  };
  /** Legal entity printed on business documents. */
  company?: { legalName: string; address: string };
  seo: {
    titleSuffix: string;
    description: string;
    /** Public paths, resolved against `url`. */
    logo?: string;
    ogImage?: string;
  };
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

/** Text per locale code, e.g. `{ vi: "Sổ tay", en: "Notebook" }`. */
export type Localized = Record<string, string>;
export type AttributeOption = { value: string; label: Localized; note?: Localized };
export type ProductAttribute =
  | { key: string; label: Localized; type: "text" | "localized-text" }
  | { key: string; label: Localized; type: "select"; options: AttributeOption[] };
export type SelectAttribute = Extract<ProductAttribute, { type: "select" }>;

export type CatalogueConfig = {
  /** Product attributes in display order. */
  attributes: ProductAttribute[];
  /** Collection slug -> key of the `select` attribute its products are grouped by. */
  groupBy: Record<string, string>;
};

function failCatalogue(field: string, reason: string): never {
  throw new Error(`Invalid catalogue config: ${field} ${reason}`);
}

export function defineCatalogue(config: CatalogueConfig): CatalogueConfig {
  const keys = new Set<string>();
  for (const attribute of config.attributes) {
    const field = `attributes.${attribute.key}`;
    if (!/^[a-z][a-zA-Z0-9]*$/.test(attribute.key))
      failCatalogue(field, "key must start with a lowercase letter and use letters and digits");
    if (keys.has(attribute.key)) failCatalogue(field, "is declared twice");
    keys.add(attribute.key);
    if (attribute.type !== "select") continue;
    if (attribute.options.length === 0) failCatalogue(field, "must list at least one option");
    const values = attribute.options.map((option) => option.value);
    if (new Set(values).size !== values.length)
      failCatalogue(field, "has a duplicate option value");
  }
  for (const [collection, key] of Object.entries(config.groupBy)) {
    const attribute = config.attributes.find((a) => a.key === key);
    if (attribute?.type !== "select")
      failCatalogue(`groupBy.${collection}`, `must name a declared select attribute, got "${key}"`);
  }
  return deepFreeze(structuredClone(config));
}

/** Every text the public interface asks its site for. `{name}` marks a value filled in by the caller. */
export type MessageKey =
  | "nav.home"
  | "nav.products"
  | "nav.collections"
  | "nav.journal"
  | "nav.about"
  | "nav.contact"
  | "header.productTypes"
  | "header.viewAll"
  | "header.openMenu"
  | "header.closeMenu"
  | "header.home"
  | "header.mainNav"
  | "header.mobileNav"
  | "header.call"
  | "footer.sloganStart"
  | "footer.sloganAccent"
  | "footer.sloganEnd"
  | "footer.about"
  | "footer.story"
  | "footer.map"
  | "footer.apiTest"
  | "search.open"
  | "search.placeholder"
  | "search.keyword"
  | "search.close"
  | "search.results"
  | "search.empty"
  | "card.featured"
  | "card.empty"
  | "contact.phone"
  | "contact.email"
  | "contactBand.title"
  | "contactBand.accent"
  | "contactBand.text"
  | "contactBand.action"
  | "productBar.message"
  | "productBar.copied"
  | "productBar.about"
  | "productBar.call"
  | "productBar.chat"
  | "floating.label"
  | "floating.call"
  | "floating.phone"
  | "floating.zalo"
  | "floating.facebook"
  | "floating.messenger"
  | "backToTop"
  | "language.heading"
  | "language.soon"
  | "home.title"
  | "home.description"
  | "about.title"
  | "about.description"
  | "contact.title"
  | "contact.description";
export type Messages = Record<MessageKey, string>;

/** What the home route hands to the site's home page. */
export type HomePageProps = { products: Product[] };
