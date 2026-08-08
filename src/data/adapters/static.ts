// src/data/adapters/static.ts
// Static data adapter — wraps the TypeScript data files into the ProductRepository interface.
// When a real API is available, create src/data/adapters/api.ts with the same interface
// and swap the import in src/data/repository/index.ts.

import type { ProductRepository, Section, Category, Product, ProductDetail } from "../types";
import { sections } from "../products";
import { categories, productDetails } from "../catalog";

export const staticAdapter: ProductRepository = {
  getAllSections(): Section[] {
    return sections;
  },

  getSectionBySlug(slug: string): Section | undefined {
    return sections.find((s) => s.slug === slug);
  },

  getAllCategories(): Category[] {
    return categories;
  },

  getCategoryBySlug(slug: string): Category | undefined {
    return categories.find((c) => c.slug === slug);
  },

  getProductDetail(handle: string): ProductDetail | undefined {
    return productDetails.find((p) => p.handle === handle);
  },

  findProduct(handle: string): Product | undefined {
    const seen = new Set<string>();
    return categories
      .flatMap((c) => c.products)
      .find((p) => p.handle === handle && !seen.has(p.handle) && seen.add(p.handle));
  },

  relatedProducts(handle: string, count = 6): Product[] {
    const seen = new Set<string>();
    return categories
      .flatMap((c) => c.products)
      .filter((p) => p.handle !== handle && !seen.has(p.handle) && seen.add(p.handle))
      .slice(0, count);
  },
};
