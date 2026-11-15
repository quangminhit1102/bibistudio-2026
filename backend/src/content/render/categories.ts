import { escapeContentHtml as escape } from "../rich-policy";
import { CONTENT_LIMITS as L } from "../limits";
import {
  card,
  breadcrumbs,
  categoryMenu,
  type Presentation,
  type PagePresentation,
} from "./presentation";
import { categoryPath, categoryPosts, sortedPosts } from "./routes";
function pagination(base: string, page: number, total: number): string {
  if (total <= 1) return "";
  const href = (value: number) => (value === 1 ? base : base + "/page/" + value),
    numbers = [
      ...new Set([
        1,
        total,
        ...Array.from({ length: 5 }, (_, i) => page - 2 + i).filter(
          (value) => value > 0 && value <= total,
        ),
      ]),
    ].sort((a, b) => a - b);
  let previous = 0;
  return `<nav aria-label="Phân trang" class="mt-12 flex flex-wrap items-center justify-center gap-3">${page > 1 ? `<a href="${href(page - 1)}" rel="prev" class="border border-border px-3 py-2">Trang trước</a>` : ""}${numbers
    .map((value) => {
      const gap = value - previous > 1 ? '<span aria-hidden="true">…</span>' : "";
      previous = value;
      return (
        gap +
        (value === page
          ? `<span aria-current="page" class="border border-foreground bg-foreground px-3 py-2 text-background">${value}</span>`
          : `<a href="${href(value)}" aria-label="Trang ${value}" class="border border-border px-3 py-2">${value}</a>`)
      );
    })
    .join(
      "",
    )}${page < total ? `<a href="${href(page + 1)}" rel="next" class="border border-border px-3 py-2">Trang sau</a>` : ""}</nav>`;
}
export function renderListing(
  categoryId: string | null,
  number: number,
  p: Presentation,
): PagePresentation {
  const category = categoryId ? p.categories.get(categoryId) : undefined;
  if (categoryId && !category) throw Error("Public category missing");
  const base = category ? categoryPath(category.slug) : "/blog",
    posts = categoryId ? sortedPosts(categoryPosts(p.snapshot, categoryId)) : p.sorted,
    pages = Math.max(1, Math.ceil(posts.length / L.pageSize)),
    items = posts.slice((number - 1) * L.pageSize, number * L.pageSize),
    crumbs = p.crumbs(categoryId ?? undefined),
    heading = category?.name ?? "Nhật ký BiBi Studio",
    description =
      category?.seoDescription ||
      category?.description ||
      "Cảm hứng, mẹo viết tay và những câu chuyện nhỏ xoay quanh sổ tay, scrapbook và phụ kiện journaling.";
  if (number < 1 || number > pages) throw Error("Public listing page missing");
  return {
    title:
      (category?.seoTitle || category?.name || "Nhật ký") +
      (number > 1 ? " — Trang " + number : ""),
    description,
    crumbs,
    body: `<main id="noi-dung" class="min-h-screen"><section class="border-b border-border bg-secondary"><div class="mx-auto max-w-[1280px] px-4 py-10 lg:px-12">${breadcrumbs(crumbs)}<h1 class="mt-5 font-display text-3xl font-medium tracking-tight md:text-4xl">${escape(heading)}</h1><p class="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">${escape(category?.description || description)}</p></div></section><section class="mx-auto grid max-w-[1280px] min-w-0 gap-10 px-4 py-12 lg:grid-cols-[12rem_minmax(0,1fr)] lg:px-12">${categoryMenu(p)}<div class="min-w-0">${items.length ? `<div class="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">${items.map((post) => card(post, p)).join("")}</div>` : '<p class="border border-border bg-card p-8 text-sm text-muted-foreground">Chưa có bài viết trong danh mục này. <a href="/blog" class="underline">Xem tất cả bài viết</a>.</p>'}${pagination(base, number, pages)}</div></section></main>`,
  };
}
