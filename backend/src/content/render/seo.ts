import { escapeContentHtml as escape } from "../rich-policy";
import { CONTENT_BRAND, CONTENT_LOGO, CONTENT_FONTS } from "../brand";
import type { PublishedPost } from "../contracts";
export interface Crumb {
  path: string;
  label: string;
}
export const jsonScript = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
export function seoHead({
  title,
  description,
  path,
  origin,
  indexable,
  crumbs,
  post,
  image,
}: {
  title: string;
  description: string;
  path: string;
  origin: string;
  indexable: boolean;
  crumbs: Crumb[];
  post?: PublishedPost;
  image?: { url: string; width: number; height: number; alt: string };
}): string {
  const url = origin + path,
    graph: Record<string, unknown>[] = [
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.label,
          item: origin + crumb.path,
        })),
      },
    ];
  if (post)
    graph.unshift({
      "@type": "BlogPosting",
      headline: post.title,
      description,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url,
      image: image?.url,
      author: {
        "@type": post.author.kind === "brand" ? "Organization" : "Person",
        name: post.author.name,
        ...(post.author.kind === "brand" ? { url: origin + "/about" } : {}),
      },
      publisher: {
        "@type": "Organization",
        name: CONTENT_BRAND,
        url: origin,
        logo: { "@type": "ImageObject", url: origin + CONTENT_LOGO },
      },
      datePublished: post.publishedAt,
      dateModified: post.modifiedAt,
      inLanguage: "vi",
    });
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} — ${CONTENT_BRAND}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${indexable ? "index,follow" : "noindex,follow"}"><link rel="canonical" href="${escape(url)}"><meta property="og:type" content="${post ? "article" : "website"}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:site_name" content="${CONTENT_BRAND}"><meta name="twitter:card" content="summary_large_image">${image ? `<meta property="og:image" content="${escape(image.url)}"><meta property="og:image:width" content="${image.width}"><meta property="og:image:height" content="${image.height}"><meta property="og:image:alt" content="${escape(image.alt)}"><meta name="twitter:image" content="${escape(image.url)}">` : ""}${post ? `<meta property="article:published_time" content="${escape(post.publishedAt)}"><meta property="article:modified_time" content="${escape(post.modifiedAt)}"><meta name="author" content="${escape(post.author.name)}">` : ""}<link rel="icon" href="${CONTENT_LOGO}" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${escape(CONTENT_FONTS)}"><script type="application/ld+json">${jsonScript({ "@context": "https://schema.org", "@graph": graph })}</script>`;
}
