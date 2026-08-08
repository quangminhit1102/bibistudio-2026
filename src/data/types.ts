// src/data/types.ts
// Single source of truth for all data types used across the app.
// This enables a clean swap between static data and API adapters in the future.

export type Product = {
  handle: string;
  name: string;
  img: string;
  price: string;
  old: string | null;
  badge: string | null;
};

export type Section = {
  title: string;
  slug: string;
  blurb?: string;
  products: Product[];
};

export type Category = {
  slug: string;
  title: string;
  blurb?: string;
  tiles: { title: string; slug: string; img: string }[];
  products: Product[];
};

export type ProductDetail = {
  handle: string;
  name: string;
  price: string;
  old: string | null;
  discount: string | null;
  stock: string;
  sku: string;
  vendor: string;
  images: string[];
  options: { label: string; values: string[] }[];
  description: string[];
  highlights: string[];
};

// Adapter interface — implement with static data or a real API adapter later.
// To switch to an API: create src/data/adapters/api.ts implementing this interface
// and swap the import in src/data/repository/index.ts.
export interface ProductRepository {
  getAllSections(): Section[];
  getSectionBySlug(slug: string): Section | undefined;
  getAllCategories(): Category[];
  getCategoryBySlug(slug: string): Category | undefined;
  getProductDetail(handle: string): ProductDetail | undefined;
  findProduct(handle: string): Product | undefined;
  relatedProducts(handle: string, count?: number): Product[];
}
