import { JSDOM } from "jsdom";
import type { PublishedPost } from "../contracts";
import {
  RICH_TAGS,
  RICH_ATTRIBUTES,
  safeContentLink,
  escapeContentHtml as escape,
} from "../rich-policy";
import {
  card,
  breadcrumbs,
  visibleDate,
  type Presentation,
  type PagePresentation,
} from "./presentation";
import { postPath } from "./routes";
function body(post: PublishedPost, p: Presentation): { html: string; text: string; toc: string } {
  const dom = new JSDOM("<!doctype html><html><body>" + post.html + "</body></html>");
  try {
    const doc = dom.window.document,
      root = doc.body;
    for (const element of root.querySelectorAll("*")) {
      if (!RICH_TAGS.includes(element.tagName.toLowerCase()) || element.tagName === "H1")
        throw Error("Invalid public HTML tag");
      for (const attribute of element.attributes)
        if (
          (!RICH_ATTRIBUTES.includes(attribute.name) &&
            !(element.tagName === "IMG" && attribute.name === "src")) ||
          /^on/i.test(attribute.name)
        )
          throw Error("Invalid public HTML attribute");
      const style = element.getAttribute("style") ?? "";
      if (
        /url\s*\(|expression\s*\(|@import|position\s*:|z-index\s*:|behavior\s*:|-moz-binding/i.test(
          style,
        )
      )
        throw Error("Invalid public HTML style");
      const href = element.getAttribute("href");
      if (href !== null && !safeContentLink(href)) throw Error("Invalid public HTML link");
    }
    const text = (root.textContent ?? "").replace(/\s+/g, " ").trim(),
      headings = [...root.querySelectorAll("h2,h3,h4")];
    headings.forEach((element, index) => (element.id = "bibi-heading-" + (index + 1)));
    for (const image of root.querySelectorAll("img")) {
      const id = image.getAttribute("data-media-id") ?? "";
      if (!post.mediaIds.includes(id) || image.getAttribute("src") !== "bibi-media:" + id)
        throw Error("Invalid public HTML image reference");
      const holder = doc.createElement("div");
      holder.innerHTML = p.image(
        id,
        image.getAttribute("alt") ?? "",
        "article",
        false,
        Number(image.getAttribute("width")) || undefined,
      );
      image.replaceWith(holder.firstElementChild!);
    }
    for (const table of root.querySelectorAll("table")) {
      const holder = doc.createElement("div");
      holder.setAttribute("data-table-scroll", "");
      holder.className = "max-w-full overflow-x-auto";
      holder.setAttribute("role", "region");
      holder.setAttribute("aria-label", "Bảng trong bài viết");
      holder.tabIndex = 0;
      table.replaceWith(holder);
      holder.append(table);
    }
    const toc =
      headings.length > 1
        ? `<nav aria-label="Mục lục" class="mb-8 border border-border bg-secondary p-5"><p class="mb-3 text-sm font-semibold">Trong bài viết này</p><ol class="space-y-2 text-sm">${headings.map((element) => `<li><a href="#${element.id}" class="hover:text-accent">${escape(element.textContent ?? "")}</a></li>`).join("")}</ol></nav>`
        : "";
    return { html: root.innerHTML, text, toc };
  } finally {
    dom.window.close();
  }
}
export function renderPost(post: PublishedPost, p: Presentation): PagePresentation {
  const content = body(post, p),
    crumbs = [...p.crumbs(post.categoryId), { path: postPath(post.slug), label: post.title }],
    related = p.sorted
      .filter((item) => item.id !== post.id && item.categoryId === post.categoryId)
      .slice(0, 3),
    description = post.seoDescription || post.excerpt || [...content.text].slice(0, 160).join("");
  const minutes = Math.max(1, Math.ceil(content.text.split(/\s+/).length / 200));
  return {
    title: post.seoTitle || post.title,
    description,
    crumbs,
    post,
    image: p.imageMeta(post),
    body: `<main id="noi-dung" class="min-h-screen"><article class="mx-auto max-w-[960px] px-4 pb-16 pt-8 md:pt-12">${breadcrumbs(crumbs)}<header class="mb-8 mt-7"><h1 class="font-display text-3xl font-medium leading-tight tracking-tight text-foreground md:text-5xl">${escape(post.title)}</h1>${post.excerpt ? `<p class="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">${escape(post.excerpt)}</p>` : ""}<div class="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><span>${escape(post.author.name)}</span><time datetime="${escape(post.publishedAt)}">${visibleDate(post.publishedAt)}</time><span>${minutes} phút đọc</span></div></header><div data-cover class="mb-10 overflow-hidden">${p.image(post.coverMediaId, post.coverAlt, "article", true)}</div>${content.toc}<div data-article-body class="content-prose min-w-0">${content.html}</div>${post.tags.length ? `<ul aria-label="Thẻ bài viết" class="mt-10 flex flex-wrap gap-2">${post.tags.map((tag) => `<li class="border border-border px-3 py-1 text-xs">${escape(tag)}</li>`).join("")}</ul>` : ""}</article>${related.length ? `<section class="mx-auto max-w-[1280px] border-t border-border px-4 py-14 lg:px-12"><h2 class="mb-7 font-display text-2xl">Bài viết liên quan</h2><div class="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">${related.map((item) => card(item, p, true)).join("")}</div></section>` : ""}</main>`,
  };
}
