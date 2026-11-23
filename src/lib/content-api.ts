export type LocalizedText = { vi: string; en: string };

export interface PublicPostShape {
  slug: string;
  title: string;
  excerpt: string | null;
  category_name: string | null;
  author_name: string | null;
  publish_at: string | null;
  read_time: string | null;
  cover_url: string | null;
  content: string;
  seo_title: string;
  seo_description: string;
}

export interface PublicProductShape {
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  short_description: string | null;
  product_type: string;
  collection: string;
  price: number;
  compare_at: number;
  images: string[];
  image_alt: LocalizedText;
  dimensions: string | null;
  pages: string | null;
  material: LocalizedText;
  format: LocalizedText;
  occasion: string | null;
  featured: boolean;
  sort_order: number;
  seo_title: string;
  seo_description: string;
}

export interface PublicCategoryShape {
  name: string;
  slug: string;
  parent_id: string | null;
  position: number;
}

export interface PublicCollectionShape {
  slug: string;
  name: string;
  tagline: string;
}

export type PublicPostSummary = Omit<PublicPostShape, "content">;

export type PublicLookup<T> =
  { status: "found"; value: T } | { status: "missing" } | { status: "unavailable" };

const UNAVAILABLE = { status: "unavailable" } as const;

// Public content reads are client-side only and never throw. `missing` means the API itself
// answered 404 (the content was removed or unpublished); every other failure, including
// `fetch` being absent during an SSR build, is `unavailable`, so callers may fall back to the
// bundled copy. A 404 without a JSON body is the host's error page for a stopped backend.
async function lookup<T>(path: string): Promise<PublicLookup<T>> {
  const fetchImpl = typeof globalThis.fetch === "function" ? globalThis.fetch : undefined;
  if (!fetchImpl) return UNAVAILABLE;
  try {
    const response = await fetchImpl(path);
    if (response.ok) return { status: "found", value: (await response.json()) as T };
    const fromApi =
      response.status === 404 &&
      (response.headers.get("content-type") ?? "").includes("application/json");
    return fromApi ? { status: "missing" } : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}

// Where a detail page takes its content from; `null` means "not found". Content the API
// reports as missing stays missing: the bundled copy only covers an unavailable API.
export function pickSource<T, B>(
  api: PublicLookup<T>,
  bundled: () => B | undefined,
): { from: "api"; value: T } | { from: "bundle"; value: B } | null {
  if (api.status === "found") return { from: "api", value: api.value };
  if (api.status === "missing") return null;
  const value = bundled();
  return value === undefined ? null : { from: "bundle", value };
}

async function getJson<T>(path: string): Promise<T | null> {
  const result = await lookup<T>(path);
  return result.status === "found" ? result.value : null;
}

export const findPublicPost = (slug: string): Promise<PublicLookup<PublicPostShape>> =>
  lookup<PublicPostShape>(`/api/public/posts/${encodeURIComponent(slug)}`);

export const findPublicProduct = (slug: string): Promise<PublicLookup<PublicProductShape>> =>
  lookup<PublicProductShape>(`/api/public/products/${encodeURIComponent(slug)}`);

export const getPublicPosts = (): Promise<PublicPostSummary[] | null> =>
  getJson<PublicPostSummary[]>("/api/public/posts");

export const getPublicProducts = (): Promise<PublicProductShape[] | null> =>
  getJson<PublicProductShape[]>("/api/public/products");

export const getPublicCategories = (
  scope: "product" | "content" = "product",
): Promise<PublicCategoryShape[] | null> =>
  getJson<PublicCategoryShape[]>(`/api/public/categories?scope=${encodeURIComponent(scope)}`);

export const getPublicCollections = (): Promise<PublicCollectionShape[] | null> =>
  getJson<PublicCollectionShape[]>("/api/public/collections");
