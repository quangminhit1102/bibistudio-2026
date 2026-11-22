import type { PublicPostShape, PublicProductShape } from "./content-api";
import type { ContentBlock } from "@/data/blog";
import { collections, occasions, productTypes } from "@/data/catalogue";
import type { CollectionId, OccasionId, Product, ProductTypeId } from "@/data/catalogue";

// Map the public API content shapes to the shapes the existing public components
// already render. The static `collections` / `productTypes` / `occasions` vocab is a
// fixed closed set used for nav/labels/occasion groups; only the dynamic products/posts
// come from the API. Unknown vocab ids fall back to a safe default rather than crashing
// `getProductType`/`getCollection` (which assume a match).

const typeIds = new Set<string>(productTypes.map((t) => t.id));
const collectionIds = new Set<string>(collections.map((c) => c.id));
const occasionIds = new Set<string>(occasions.map((o) => o.id));

function asType(value: string): ProductTypeId {
  return typeIds.has(value) ? (value as ProductTypeId) : "notebook";
}

function asCollection(value: string): CollectionId {
  return collectionIds.has(value) ? (value as CollectionId) : "explore-vietnam";
}

function asOccasion(value: string | null): OccasionId | undefined {
  return value && occasionIds.has(value) ? (value as OccasionId) : undefined;
}

function localized(value: { vi: string; en: string }, fallbackVi = ""): { vi: string; en: string } {
  const vi = value.vi || fallbackVi || value.en;
  const en = value.en || value.vi || vi;
  return { vi, en };
}

export function toPublicProduct(api: PublicProductShape): Product {
  return {
    id: api.slug,
    slug: api.slug,
    name: localized(api.name),
    productType: asType(api.product_type),
    collection: asCollection(api.collection),
    occasion: asOccasion(api.occasion),
    description: localized(api.description, api.short_description ?? undefined),
    dimensions: api.dimensions ?? undefined,
    material: api.material.vi || api.material.en ? localized(api.material) : undefined,
    pages: api.pages ?? undefined,
    format: api.format.vi || api.format.en ? localized(api.format) : undefined,
    images: api.images,
    imageAlt: localized(api.image_alt, api.name.vi),
    featured: api.featured,
    sortOrder: api.sort_order,
    status: "published",
  };
}

// Unified article shape the blog routes render. Static posts carry legacy ContentBlock[]
// (with Vite-bundled images); API posts carry the raw `html-v1` envelope string that the
// article body sanitizes at render time.
export type PostView = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
  content: { kind: "blocks"; blocks: ContentBlock[] } | { kind: "html"; html: string };
};

export function toPublicPost(api: PublicPostShape): PostView {
  return {
    slug: api.slug,
    title: api.title,
    excerpt: api.excerpt ?? "",
    category: api.category_name ?? "Nhật ký",
    author: api.author_name ?? "BiBi Studio",
    date: api.publish_at ?? "",
    readTime: api.read_time ?? "",
    coverImage: api.cover_url ?? "",
    seoTitle: api.seo_title,
    seoDescription: api.seo_description,
    content: { kind: "html", html: api.content },
  };
}

export function staticPostToView(post: {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  coverImage: string;
  content: ContentBlock[];
}): PostView {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    author: post.author,
    date: post.date,
    readTime: post.readTime,
    coverImage: post.coverImage,
    seoTitle: "",
    seoDescription: "",
    content: { kind: "blocks", blocks: post.content },
  };
}
