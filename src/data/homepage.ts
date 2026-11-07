import { getAllProducts } from "./catalogue";

// Homepage curation only. Classifications describe the supplied image, not how
// the product is manufactured. Never infer photography from an image's index.
export const homeSelection = [
  { slug: "da-nang-map-notebook", kind: "mockup" },
  { slug: "life-is-better-laughing-notebook", kind: "photograph" },
  { slug: "bun-bo-hue-notebook", kind: "product-image" },
  { slug: "ao-dai-saigon-card", kind: "product-image" },
  { slug: "womens-day-moon-bouquet-card", kind: "product-image" },
  { slug: "cau-rong-magnet", kind: "product-image" },
] as const;

export function homepageProducts() {
  const products = getAllProducts();
  return homeSelection.flatMap((selection) => {
    const product = products.find((p) => p.slug === selection.slug);
    return product?.images[0] ? [{ product, kind: selection.kind }] : [];
  });
}
