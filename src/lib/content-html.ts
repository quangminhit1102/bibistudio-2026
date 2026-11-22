import { readRichContent } from "@/features/admin/content/rich-content";

// Client-side rendering of a blog post's `html-v1` envelope. `readRichContent` unwraps the
// envelope and sanitizes via DOMPurify (the same sanitize path the admin editor uses). The
// sanitized HTML is then anchored: `<h2>`/`<h3>` get stable ids so the table of contents
// can deep-link. Broken `bibi-media:` images (media ids that aren't publicly resolvable)
// are dropped so the article doesn't show broken image icons.

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface RenderedArticle {
  html: string;
  toc: TocItem[];
}

export function slugifyHeading(text: string, index: number): string {
  const base = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "muc"}-${index}`;
}

export function renderArticle(raw: string): RenderedArticle {
  if (typeof document === "undefined") return { html: "", toc: [] };
  const host = document.createElement("div");
  host.innerHTML = readRichContent(raw);
  for (const img of host.querySelectorAll("img")) {
    if ((img.getAttribute("src") ?? "").startsWith("bibi-media:")) img.remove();
  }
  const toc: TocItem[] = [];
  host.querySelectorAll("h2, h3").forEach((heading, index) => {
    const level = heading.tagName === "H3" ? 3 : 2;
    const text = (heading.textContent ?? "").trim();
    const id = slugifyHeading(text, index);
    heading.id = id;
    toc.push({ id, text, level });
  });
  return { html: host.innerHTML, toc };
}
