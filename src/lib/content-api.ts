export interface PublicPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  seo_title: string;
  seo_description: string;
  category_id: string | null;
  author_id: string;
  publish_at: string | null;
  content: string;
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string;
  product_type: string;
  collection: string;
  price: number;
  compare_at: number;
  image_ids: string[];
  seo_title: string;
  seo_description: string;
}

// SEO overlay reads are best-effort and client-side only. When `fetch` is
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

export const getPublicPost = (slug: string): Promise<PublicPost | null> =>
  getJson<PublicPost>(`/api/public/posts/${encodeURIComponent(slug)}`);

export const getPublicProduct = (slug: string): Promise<PublicProduct | null> =>
  getJson<PublicProduct>(`/api/public/products/${encodeURIComponent(slug)}`);
