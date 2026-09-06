// src/data/pagination.ts
// Shared pagination + product-sorting primitives used by the collection & blog loaders.

import type { Product } from "./types";

export const PRODUCTS_PER_PAGE = 12;
export const POSTS_PER_PAGE = 9;

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function paginate<T>(list: T[], page: number, pageSize: number): Paged<T> {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export const PRODUCT_SORT_KEYS = ["default", "az", "za", "asc", "desc"] as const;

export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const PRODUCT_SORT_OPTIONS: { value: ProductSortKey; label: string }[] = [
  { value: "default", label: "Mặc định" },
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
  { value: "asc", label: "Giá tăng dần" },
  { value: "desc", label: "Giá giảm dần" },
];

function priceToNumber(price: string): number {
  return Number(price.replace(/[^\d]/g, ""));
}

export function sortProducts(products: Product[], sort: ProductSortKey): Product[] {
  const list = [...products];
  if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  else if (sort === "za") list.sort((a, b) => b.name.localeCompare(a.name, "vi"));
  else if (sort === "asc") list.sort((a, b) => priceToNumber(a.price) - priceToNumber(b.price));
  else if (sort === "desc") list.sort((a, b) => priceToNumber(b.price) - priceToNumber(a.price));
  return list;
}
