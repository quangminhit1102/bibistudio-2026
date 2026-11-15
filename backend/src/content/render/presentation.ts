import { escapeContentHtml as escape } from "../rich-policy";
import type { PublicSnapshot, PublishedPost, MediaVariant } from "../contracts";
import { CONTENT_BRAND, CONTENT_LOGO } from "../brand";
import { ancestorIds, categoryPath, postPath, sortedPosts } from "./routes";
import type { Crumb } from "./seo";
export interface PagePresentation {
  title: string;
  description: string;
  body: string;
  crumbs: Crumb[];
  post?: PublishedPost;
  image?: { url: string; width: number; height: number; alt: string };
}
export function createPresentation(snapshot: PublicSnapshot, origin: string) {
  const categories = new Map(snapshot.categories.map((category) => [category.id, category])),
    media = new Map<string, MediaVariant[]>();
  for (const value of Object.values(snapshot.media)) {
    const id = value.file.split("/")[0],
      items = media.get(id) ?? [];
    items.push(value);
    media.set(id, items);
  }
  for (const [id, items] of media)
    media.set(id, [
      ...new Map(
        items
          .sort((a, b) => a.width - b.width || a.hash.localeCompare(b.hash))
          .map((item) => [item.width, item]),
      ).values(),
    ]);
  function variants(id: string) {
    const items = media.get(id);
    if (!items?.length) throw Error("Public image variant missing");
    return items;
  }
  const mediaUrl = (image: MediaVariant) =>
    `/media/content/${image.hash}.${image.mime === "image/jpeg" ? "jpg" : image.mime.split("/")[1]}`;
  function image(
    id: string,
    alt: string,
    frame: "card" | "article",
    priority = false,
    width?: number,
  ) {
    const items = variants(id),
      master = items.at(-1)!,
      source = items.find((item) => item.width >= (frame === "card" ? 960 : 1600)) ?? master,
      srcset = items.map((item) => `${mediaUrl(item)} ${item.width}w`).join(", "),
      bounded =
        width && Number.isFinite(width) && width >= 16 && width <= 4096
          ? `width:${Math.round(width)}px;max-width:100%;`
          : "width:100%;";
    return `<span data-media-frame="${frame}" class="relative block overflow-hidden bg-secondary" style="display:${width ? "inline-block" : "block"};${bounded}aspect-ratio:${frame === "card" ? "1/1" : "3/2"}"><img src="${mediaUrl(source)}" srcset="${srcset}" sizes="${frame === "card" ? "(min-width:1024px) 30vw,(min-width:640px) 45vw,100vw" : "(min-width:1024px) 960px,100vw"}" width="${master.width}" height="${master.height}" alt="${escape(alt)}" loading="${priority ? "eager" : "lazy"}" decoding="async"${priority ? ' fetchpriority="high"' : ""} class="h-full w-full object-cover"></span>`;
  }
  function imageMeta(post: PublishedPost) {
    const master = variants(post.coverMediaId).at(-1)!;
    return {
      url: origin + mediaUrl(master),
      width: master.width,
      height: master.height,
      alt: post.coverAlt,
    };
  }
  function crumbs(categoryId?: string): Crumb[] {
    const items: Crumb[] = [
      { path: "/", label: "Trang chủ" },
      { path: "/blog", label: "Nhật ký" },
    ];
    if (categoryId)
      for (const id of [...ancestorIds(snapshot, categoryId)].reverse()) {
        const category = categories.get(id)!;
        items.push({ path: categoryPath(category.slug), label: category.name });
      }
    return items;
  }
  return {
    snapshot,
    origin,
    categories,
    image,
    imageMeta,
    crumbs,
    sorted: sortedPosts(snapshot.posts),
  };
}
export type Presentation = ReturnType<typeof createPresentation>;
export function breadcrumbs(items: Crumb[]): string {
  return `<nav aria-label="Đường dẫn" class="text-xs text-muted-foreground"><ol class="flex flex-wrap items-center gap-2">${items.map((item, index) => `<li>${index ? '<span aria-hidden="true" class="mr-2">/</span>' : ""}${index === items.length - 1 ? `<span aria-current="page">${escape(item.label)}</span>` : `<a href="${escape(item.path)}" class="hover:text-foreground">${escape(item.label)}</a>`}</li>`).join("")}</ol></nav>`;
}
export function visibleDate(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}
export function card(post: PublishedPost, p: Presentation, related = false): string {
  const category = p.categories.get(post.categoryId)!,
    level = related ? 3 : 2;
  return `<article data-post-card${related ? " data-related-post" : ""} class="group flex min-w-0 flex-col overflow-hidden border border-border bg-card"><a href="${postPath(post.slug)}" aria-label="${escape(post.title)}">${p.image(post.coverMediaId, post.coverAlt, "card")}</a><div class="flex flex-1 flex-col p-5"><a href="${categoryPath(category.slug)}" class="text-xs font-semibold uppercase tracking-wider text-accent">${escape(category.name)}</a><h${level} class="mt-2 text-lg font-semibold leading-snug"><a href="${postPath(post.slug)}" class="hover:text-accent">${escape(post.title)}</a></h${level}><p class="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">${escape(post.excerpt)}</p><time datetime="${escape(post.publishedAt)}" class="mt-4 text-xs text-muted-foreground">${visibleDate(post.publishedAt)}</time></div></article>`;
}
export function categoryMenu(p: Presentation): string {
  const visible = p.snapshot.categories.filter((category) =>
    ancestorIds(p.snapshot, category.id).every((id) => p.categories.get(id)?.active),
  );
  function children(parentId: string | null): string {
    return visible
      .filter((category) => category.parentId === parentId)
      .sort((a, b) => a.position - b.position || a.slug.localeCompare(b.slug))
      .map(
        (category) =>
          `<li class="mt-3"><a href="${categoryPath(category.slug)}" class="hover:text-accent">${escape(category.name)}</a>${visible.some((child) => child.parentId === category.id) ? `<ul class="ml-4 border-l border-border pl-4">${children(category.id)}</ul>` : ""}</li>`,
      )
      .join("");
  }
  return `<aside class="min-w-0"><h2 class="eyebrow text-foreground">Danh mục</h2><ul data-category-tree class="mt-4 text-sm leading-relaxed"><li><a href="/blog">Tất cả bài viết</a></li>${children(null)}</ul></aside>`;
}
export function header(): string {
  const nav = [
      ["/", "Trang chủ"],
      ["/products", "Sản phẩm"],
      ["/collections", "Bộ sưu tập"],
      ["/blog", "Nhật ký"],
      ["/about", "Về BiBi"],
      ["/contact", "Liên hệ"],
    ],
    links = nav
      .map(
        ([path, label]) =>
          `<a href="${path}"${path === "/blog" ? ' aria-current="page"' : ""} class="whitespace-nowrap py-3 text-xs font-medium uppercase tracking-wider hover:text-accent">${label}</a>`,
      )
      .join("");
  return `<a href="#noi-dung" class="sr-only focus:not-sr-only">Đến nội dung</a><header class="border-b border-border bg-background"><div class="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 lg:px-12"><a href="/" aria-label="${CONTENT_BRAND} — Trang chủ"><img src="${CONTENT_LOGO}" width="168" height="40" alt="${CONTENT_BRAND}" class="h-10 w-auto"></a><nav aria-label="Điều hướng chính" class="hidden items-center gap-6 lg:flex">${links}</nav><details class="relative lg:hidden"><summary class="cursor-pointer p-3 text-sm">Menu</summary><nav aria-label="Menu di động" class="absolute right-0 z-50 flex min-w-56 flex-col border border-border bg-background p-5 shadow-paper">${links}</nav></details></div></header>`;
}
export function footer(): string {
  return `<footer class="border-t border-border bg-background"><div class="mx-auto grid max-w-[1280px] gap-8 px-4 py-14 sm:grid-cols-2 lg:px-12"><div><a href="/"><img src="${CONTENT_LOGO}" width="168" height="40" alt="${CONTENT_BRAND}" class="h-10 w-auto"></a><p class="mt-5 max-w-xs font-display text-2xl italic">Little things, made to touch your heart.</p><p class="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">Một studio nhỏ làm đồ giấy lấy cảm hứng từ Việt Nam — mỗi sản phẩm bắt đầu từ một câu chuyện.</p></div><nav aria-label="Liên kết cuối trang" class="flex flex-wrap items-start gap-5 text-sm"><a href="/products">Sản phẩm</a><a href="/collections">Bộ sưu tập</a><a href="/blog">Nhật ký</a><a href="/about">Về BiBi</a><a href="/contact">Liên hệ</a><button type="button" data-privacy-settings hidden>Quyền riêng tư</button></nav></div><p class="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">© ${CONTENT_BRAND}</p></footer>`;
}
