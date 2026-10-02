// src/data/pagination.ts
// Shared pagination + product-sorting primitives used by the collection & blog loaders.


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

