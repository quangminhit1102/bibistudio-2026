import type { PublicPostSummary, PublicProductShape } from "./content-api";
import { getBlogPost, type ContentBlock } from "@/data/blog";
import { getProduct } from "@/data/catalogue";
import type { Product } from "@/data/catalogue";
import { selectOptions } from "./catalogue-attributes";
import { site } from "@/platform/site";

// Map the public API content shapes to the shapes the existing public components
// already render. Product type and collection pass through as stored: a value outside
// the known lists is labelled with its own slug, never relabelled as another type.

function asOccasion(value: string | null): string | undefined {
  return value && selectOptions("occasion").some((o) => o.value === value) ? value : undefined;
}

function localized(value: { vi: string; en: string }, fallbackVi = ""): { vi: string; en: string } {
  const vi = value.vi || fallbackVi || value.en;
  const en = value.en || value.vi || vi;
  return { vi, en };
}

export function toPublicProduct(api: PublicProductShape): Product {
  const legacy = getProduct(api.slug);
  return {
    id: api.slug,
    slug: api.slug,
    name: localized(api.name),
    productType: api.product_type,
    collection: api.collection,
    occasion: asOccasion(api.occasion),
    description: localized(api.description, api.short_description ?? undefined),
    dimensions: api.dimensions ?? undefined,
    material: api.material.vi || api.material.en ? localized(api.material) : undefined,
    pages: api.pages ?? undefined,
    format: api.format.vi || api.format.en ? localized(api.format) : undefined,
    images: legacy ? legacy.images : api.images,
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

// The list endpoint sends summaries without the article body; only the detail has `content`.
export function toPublicPost(api: PublicPostSummary & { content?: string }): PostView {
  const legacy = getBlogPost(api.slug);
  return {
    slug: api.slug,
    title: api.title,
    excerpt: api.excerpt ?? "",
    category: api.category_name ?? "Nhật ký",
    author: api.author_name ?? site.name,
    date: api.publish_at ?? "",
    readTime: api.read_time ?? "",
    coverImage: legacy ? legacy.coverImage : (api.cover_url ?? ""),
    seoTitle: api.seo_title,
    seoDescription: api.seo_description,
    content: { kind: "html", html: api.content ?? "" },
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
