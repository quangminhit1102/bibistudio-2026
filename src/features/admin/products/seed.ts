import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
import { getAllProducts } from "@/data/catalogue";
export const legacyProductIds: Record<string, string> = Object.fromEntries(
  [
    "da-nang",
    "ha-giang",
    "sai-gon",
    "ca-mau",
    "da-lat",
    "ha-noi",
    "hoi-an",
    "hue",
    "nha-trang",
  ].map((slug, i) => [slug + "-map-notebook", "product-" + (i + 1)]),
);
export const seedProductIds = new Set([
  ...Array.from({ length: 50 }, (_, i) => "product-" + (i + 1)),
  ...getAllProducts().map((p) => "catalogue-" + p.slug),
]);
export function seed(): SeedBatch {
  const products = getAllProducts().map((p, i) => ({
    ...seedBase(legacyProductIds[p.slug] ?? "catalogue-" + p.slug, i % 28),
    name: p.name.vi,
    sku: `BIBI-${String(i + 1).padStart(4, "0")}`,
    slug: p.slug,
    description: p.description.vi,
    shortDescription: p.description.vi,
    productType: p.productType,
    collection: p.collection,
    categoryId: p.productType === "notebook" ? "cat-notebook" : "cat-card",
    price: 45000 + (i % 7) * 10000,
    compareAt: 0,
    stock: 30 + (i % 20),
    reserved: 0,
    status: p.status,
    imageIds: p.images.map((_, k) => `catalogue-image-${p.slug}-${k}`),
    tags: ["Việt Nam"],
    seoTitle: "",
    seoDescription: "",
  }));
  const media = getAllProducts().flatMap((p) =>
    p.images.map((url, k) => ({
      ...seedBase(`catalogue-image-${p.slug}-${k}`),
      name: p.name.vi,
      mime: "image/webp",
      size: 0,
      width: 0,
      height: 0,
      blobKey: "",
      url,
    })),
  );
  return { products, media };
}
