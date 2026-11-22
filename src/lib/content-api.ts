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

// Public content reads are best-effort and client-side only. When `fetch` is
// unavailable (SSR build/runtime) or the request fails, we return `null` so the
// route `head` falls back to the static title/excerpt — identical to current
// behavior. The fetch must never throw and break the route.
async function getJson<T>(path: string): Promise<T | null> {
  const fetchImpl = typeof globalThis.fetch === "function" ? globalThis.fetch : undefined;
  if (!fetchImpl) return null;
  try {
    const response = await fetchImpl(path, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const getPublicPost = (slug: string): Promise<PublicPostShape | null> =>
  getJson<PublicPostShape>(`/api/public/posts/${encodeURIComponent(slug)}`);

export const getPublicProduct = (slug: string): Promise<PublicProductShape | null> =>
  getJson<PublicProductShape>(`/api/public/products/${encodeURIComponent(slug)}`);

export const getPublicPosts = (): Promise<PublicPostShape[] | null> =>
  getJson<PublicPostShape[]>("/api/public/posts");

export const getPublicProducts = (): Promise<PublicProductShape[] | null> =>
  getJson<PublicProductShape[]>("/api/public/products");

export const getPublicCategories = (
  scope: "product" | "content" = "product",
): Promise<PublicCategoryShape[] | null> =>
  getJson<PublicCategoryShape[]>(`/api/public/categories?scope=${encodeURIComponent(scope)}`);

export const getPublicCollections = (): Promise<PublicCollectionShape[] | null> =>
  getJson<PublicCollectionShape[]>("/api/public/collections");
