// src/lib/seo.ts
// Centralized SEO configuration & Structured Data (JSON-LD) generators.

export const SITE_URL = "https://bibistudio-2026.lovable.app";
export const SITE_NAME = "BiBi Studio";
export const DEFAULT_OG_IMAGE =
  "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/slider_3.jpg";

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
    logo: DEFAULT_OG_IMAGE,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+84-967-495-867",
      contactType: "customer service",
      areaServed: "VN",
      availableLanguage: "Vietnamese",
    },
  };
}
