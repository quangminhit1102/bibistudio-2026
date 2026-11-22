// src/lib/seo.ts
// Centralized SEO configuration & Structured Data (JSON-LD) generators.

import { site } from "@/platform/site";
import { siteUrl } from "@/platform/site-contract";

export const SITE_URL = site.url;
export const SITE_NAME = site.name;

export function appendPageParam(url: string, page: number): string {
  return page > 1 ? `${url}?page=${page}` : url;
}

export function buildProductSchema(p: {
  name: string;
  images: string[];
  sku: string;
  price: string;
  handle: string;
  description: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description[0] ?? "",
    image: p.images,
    brand: { "@type": "Brand", name: SITE_NAME },
    sku: p.sku,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/products/${p.handle}`,
      priceCurrency: "VND",
      price: Number(p.price.replace(/[^\d]/g, "")),
      availability: "https://schema.org/InStock",
    },
  };
}

export function buildBreadcrumbSchema(crumbs: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: site.seo.logo ? siteUrl(site, site.seo.logo) : undefined,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: site.contact.phoneInternational ?? site.contact.phone,
      contactType: "customer service",
      areaServed: "VN",
      availableLanguage: "Vietnamese",
    },
  };
}
