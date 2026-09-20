# Pagination for Collections & Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL-driven numbered pagination (`?page=N`) to the collection product grid (`/collections/:slug`) and the blog index (`/blog`), moving the collection's sort state into the URL, so page 2+ is reachable, shareable, back-button friendly, and survives the future API swap.

**Architecture:** A generic `paginate()` helper in `src/data/pagination.ts` returns a `Paged<T>` shape `{ items, total, page, pageSize, totalPages }`. Both route loaders read a zod-validated `?page` (and, for collections, `?sort`) search param via `loaderDeps`, request a single page slice from the data layer, and `throw redirect` when `?page` exceeds `totalPages`. Components only ever see one page of items and render a shared `Pagination` component (numbered window + prev/next, Radix-free `<Link>`s). Sorting is centralized in the data layer and applied before slicing so page boundaries are stable.

**Tech Stack:** TanStack Router v1 (file routes, `validateSearch`, `loaderDeps`), TanStack Start, React 19, zod, lucide-react. No new dependencies.

**Spec:** Design decisions confirmed by interview (2026-09-06):
- Surfaces: `/collections/:slug` product grid + `/blog` index only.
- Pattern: numbered pages, `?page=N` search param, 12 products/page, 9 posts/page (fixed constants).
- URL state: collections sort moves from `useState` into the URL (`?sort=`), same 5 keys as today (`default|az|za|asc|desc`); blog is date-desc (newest first), no sort UI. Changing sort resets to page 1.
- Bad params: `page` coerced to int ≥ 1, garbage → 1; `page > totalPages` → redirect to last page.
- Data flow: slicing happens in the route loaders via data-layer functions (never client-side after loading); components see only the current page.
- SEO: canonical = base URL for page 1, self with `?page=N` for N > 1; no `rel=prev/next`, no `noindex`. `sort` is deliberately excluded from canonical (prevents sort-variant duplication).
- Count line on collections shows the true total across pages; no count line on blog.
- Scroll-to-top (smooth) to the listing top on page change, first render excluded.
- Seeding: NO catalog seeding needed — `back-to-school` already has 21 products (2 pages at 12/page). Blog needs +4 posts (7 → 11, 2 pages at 9/page).

## Global Constraints

- Vietnamese copy throughout (`sản phẩm`, `Trang`, `«`/`›` chevrons, existing select labels).
- Follow existing shadcn-ish utility-class styling (`border border-border bg-background`, `text-[13px]`, `text-muted-foreground`, `text-accent`); no new CSS files; design tokens come from `styles.css`.
- No unit-test framework is configured in this repo (no test runner in `package.json`). Verification gate per task = `npx tsc --noEmit`; full gates before finishing = `npm run build` + `npm run lint` + manual dev-server checks. Do NOT add a test framework.
- Do not add new dependencies. No comments unless they explain a non-obvious seam (mirror the existing `// src/...` header comments style).
- Keep `getAllBlogPosts()`, `getBlogPost()`, `getCategory()`, `findProduct()`, `relatedProducts()` working — other modules depend on them (`blog-highlights.tsx`, `products.$handle.tsx`, home sections).
- `Product`/`Category` types come from `src/data/types.ts`. Prices are display strings like `"61.200₫"` — numeric compare parses digits.
- Blog route full path is `/blog` (file route `blog.index.tsx` normalizes); collections route is `/collections/$slug`.

---
---

### Task 1: Pagination + product-sort core module

**Files:**
- Create: `src/data/pagination.ts`
- Modify: `src/components/ui/sort-select.tsx` (whole file, ~35 lines)

**Interfaces:**
- Consumes: `Product` type from `./types`.
- Produces:
  - `export const PRODUCTS_PER_PAGE = 12`
  - `export const POSTS_PER_PAGE = 9`
  - `export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number }`
  - `export function paginate<T>(list: T[], page: number, pageSize: number): Paged<T>` (clamps `page` into `[1, totalPages]`; `totalPages` is at least 1)
  - `export const PRODUCT_SORT_KEYS = ["default", "az", "za", "asc", "desc"] as const`
  - `export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number]`
  - `export const PRODUCT_SORT_OPTIONS: { value: ProductSortKey; label: string }[]` (Vietnamese labels — must match today's select)
  - `export function sortProducts(products: Product[], sort: ProductSortKey): Product[]`
  - Updated `SortSelect` still renders `<select>` with `value`/`onChange`, typed with `ProductSortKey`, options from `PRODUCT_SORT_OPTIONS`. The old exported `SortValue` type is **removed**; callers migrate to `ProductSortKey`.

- [ ] **Step 1: Create `src/data/pagination.ts`**

```ts
// src/data/pagination.ts
// Shared pagination + product-sorting primitives used by the collection & blog loaders.

import type { Product } from "./types";

export const PRODUCTS_PER_PAGE = 12;
export const POSTS_PER_PAGE = 9;

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function paginate<T>(list: T[], page: number, pageSize: number): Paged<T> {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export const PRODUCT_SORT_KEYS = ["default", "az", "za", "asc", "desc"] as const;

export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const PRODUCT_SORT_OPTIONS: { value: ProductSortKey; label: string }[] = [
  { value: "default", label: "Mặc định" },
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
  { value: "asc", label: "Giá tăng dần" },
  { value: "desc", label: "Giá giảm dần" },
];

function priceToNumber(price: string): number {
  return Number(price.replace(/[^\d]/g, ""));
}

export function sortProducts(products: Product[], sort: ProductSortKey): Product[] {
  const list = [...products];
  if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  else if (sort === "za") list.sort((a, b) => b.name.localeCompare(a.name, "vi"));
  else if (sort === "asc") list.sort((a, b) => priceToNumber(a.price) - priceToNumber(b.price));
  else if (sort === "desc") list.sort((a, b) => priceToNumber(b.price) - priceToNumber(a.price));
  return list;
}
```

- [ ] **Step 2: Replace `src/components/ui/sort-select.tsx`**

```tsx
// src/components/ui/sort-select.tsx
import { PRODUCT_SORT_OPTIONS, type ProductSortKey } from "@/data/pagination";

export function SortSelect({
  value,
  onChange,
}: {
  value: ProductSortKey;
  onChange: (v: ProductSortKey) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
      Sắp xếp theo:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ProductSortKey)}
        className="border border-border bg-background px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-accent"
      >
        {PRODUCT_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). Note: `collections.$slug.tsx` will still reference `SortValue` and will error at this point — that is expected and is resolved in Task 4. If tsc fails **only** on `collections.$slug.tsx` for `SortValue`, proceed; otherwise fix and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/data/pagination.ts src/components/ui/sort-select.tsx
git commit -m "feat: add shared pagination and product sort primitives"
```

---
---

### Task 2: Blog data layer — paged query + seed posts

**Files:**
- Modify: `src/data/blog.ts`

**Interfaces:**
- Consumes: `paginate`, `POSTS_PER_PAGE`, `Paged` from `./pagination`; `BlogPost` defined locally.
- Produces: `export function getBlogPostsPage(page: number, pageSize?: number): Paged<BlogPost>` — returns posts sorted by `date` descending (newest first), then paginated.

- [ ] **Step 1: Add imports at the top of `src/data/blog.ts`** (after the existing `import type { Product } from "./products";` on line 2)

```ts
import { paginate, POSTS_PER_PAGE } from "./pagination";
import type { Paged } from "./pagination";
```

- [ ] **Step 2: Add the paged query function** directly after `getAllBlogPosts()` (after line 31)

```ts
export function getBlogPostsPage(page: number, pageSize = POSTS_PER_PAGE): Paged<BlogPost> {
  const sorted = [...blogPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return paginate(sorted, page, pageSize);
}
```

- [ ] **Step 3: Seed 4 posts** — insert these 4 objects immediately BEFORE the closing `];` at line 578 (after the `thiet-lap-goc-hoc-tap-truyen-cam-hung` post's closing `},`). Choose cover images already referenced elsewhere in the repo so URLs are not invented. Date values must be later than existing posts so they surface on page 1 when date-desc is applied.

```ts
  {
    slug: "chon-so-tay-theo-muc-dich-su-dung",
    title: "Chọn sổ tay theo mục đích sử dụng: học tập, làm việc hay journaling",
    excerpt:
      "Sổ ruled cho ghi chép công việc, sổ chấm bi cho bullet journal, sổ ô vuông cho vẽ kỹ thuật — cách chọn đúng ruột sổ cho từng nhu cầu.",
    category: "Cẩm nang",
    author: "BiBi Studio",
    date: "2026-09-02",
    readTime: "4 phút đọc",
    coverImage:
      "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/tap-b5-200tr-01-1783566246708.jpg",
    content: [
      {
        type: "paragraph",
        text: "Trước khi mua một cuốn sổ mới, hãy tự hỏi cuốn sổ ấy sẽ làm gì trong đời bạn. Cùng một kích cỡ B5 nhưng ruột kẻ dòng, ô vuông hay chấm bi lại phục vụ những thói quen rất khác nhau.",
      },
      { type: "heading", text: "Sổ kẻ dòng (ruled)", level: 2 },
      {
        type: "paragraph",
        text: "Phù hợp cho ghi chú cuộc họp, ghi bài giảng và viết thư. Khoảng cách dòng 8mm là chuẩn thoải mái nhất với chữ viết tay Việt Nam.",
      },
      { type: "heading", text: "Sổ chấm bi (dot grid)", level: 2 },
      {
        type: "paragraph",
        text: "Lựa chọn của người làm bullet journal: dòng chấm mờ hướng dẫn bố cục mà không cạnh tranh với chữ viết hay hình vẽ.",
      },
      {
        type: "paragraph",
        text: "Mẹo nhỏ: nếu bạn chưa chắc mình thuộc nhóm nào, hãy bắt đầu bằng một cuốn B5 kẻ dòng 80gsm — an toàn, bền và dễ dùng cho mọi nhu cầu.",
      },
    ],
    relatedHandles: ["tap-may-chi-b5-giay-kem-80gsm-200-trang", "tap-b5-lo-xo-nhua-80-trang"],
  },
  {
    slug: "cach-bao-quan-va-luu-tru-but-muc-lau-dai",
    title: "Cách bảo quản bút mực để dùng được lâu dài",
    excerpt:
      "Bút gel để ngang hay ngửa? Bút máy bao lâu phải rửa một lần? Những mẹo nhỏ giúp cây bút yêu thích của bạn luôn ra mực đều.",
    category: "Cẩm nang",
    author: "BiBi Studio",
    date: "2026-09-03",
    readTime: "3 phút đọc",
    coverImage:
      "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1753543441797.jpg",
    content: [
      {
        type: "paragraph",
        text: "Một cây bút tốt có thể theo bạn nhiều năm nếu được bảo quản đúng cách. Nguyên tắc đầu tiên: luôn đậy nắp khi không dùng và cất bút nằm ngang.",
      },
      { type: "heading", text: "Bút gel và bút bi", level: 2 },
      {
        type: "paragraph",
        text: "Tránh để bút ở nơi quá nóng như cốp xe hay cạnh cửa sổ nắng gắt — nhiệt độ cao làm khô mực và khiến hạt bi bị kẹt. Cất ngang để mực luôn ở đầu bi.",
      },
      { type: "heading", text: "Bút máy", level: 2 },
      {
        type: "paragraph",
        text: "Nếu dùng hằng ngày, chỉ cần rửa ngòi bằng nước sạch mỗi 2–3 tuần khi thay màu mực. Nếu cất lâu, hãy rửa sạch, để khô rồi mới cất để tránh mực đóng cặn.",
      },
      {
        type: "paragraph",
        text: "Và một lưu ý cuối: đừng dùng chung một cây bút máy cho mực pigment và mực dye — cặn pigment rất khó làm sạch ngòi.",
      },
    ],
    relatedHandles: ["but-gel-zebra-sarasa-clip-ngoi-0-5mm", "but-muji-chinh-hang"],
  },
  {
    slug: "y-tuong-trang-tri-bullet-journal-thang-9",
    title: "5 ý tưởng trang trí bullet journal cho tháng 9",
    excerpt:
      "Từ bảng theo dõi thói quen hình ô dù đến trang mục tiêu màu đất — gợi ý bố cục nhẹ nhàng cho mùa thu với washi tape và bút highlight.",
    category: "Cảm hứng",
    author: "BiBi Studio",
    date: "2026-09-04",
    readTime: "5 phút đọc",
    coverImage:
      "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/mildliner-11-1784262931578.jpg",
    content: [
      {
        type: "paragraph",
        text: "Tháng 9 gợi nhắc về những buổi sáng se lạnh, chiếc áo khoác mỏng và mùa tựu trường. Hãy để cảm hứng đó đi vào từng trang bullet journal của bạn.",
      },
      { type: "heading", text: "1. Trang tổng quan với tông màu đất", level: 2 },
      {
        type: "paragraph",
        text: "Chọn một bảng màu 3 tông như nâu, be và xanh rêu. Dùng bút highlight pastel để tô các ô ngày, washi tape họa tiết lá làm đường viền trang.",
      },
      { type: "heading", text: "2. Bảng theo dõi thói quen hình ô dù", level: 2 },
      {
        type: "paragraph",
        text: "Vẽ 30 chiếc ô dù nhỏ, mỗi ô dù là một ngày trong tháng. Mỗi lần hoàn thành thói quen, tô màu một ô — đến cuối tháng bạn sẽ có một khu vườn ô dù đầy màu.",
      },
      {
        type: "paragraph",
        text: "Đừng quên dành một góc trang cho danh sách nhạc và sách đang nghe, đang đọc trong tháng — tháng nào ghi lại được, cuối năm xem lại rất vui.",
      },
    ],
    relatedHandles: ["zebra-midliner-2-dau", "sthm-stationery-set-32-nhan-vo-basic-7-2x3-6cm"],
  },
  {
    slug: "goi-qua-handmade-y-nghia-ngay-khai-giang",
    title: "Gợi ý gói quà handmade ý nghĩa cho ngày khai giảng",
    excerpt:
      "Một bộ vở xinh, chiếc bút máy đầu tiên và tấm thiệp tự viết — cách gói quà tự làm khiến món quà tựu trường trở nên đặc biệt hơn.",
    category: "Cảm hứng",
    author: "BiBi Studio",
    date: "2026-09-05",
    readTime: "6 phút đọc",
    coverImage:
      "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/box-rose0-1784028538291.jpg",
    content: [
      {
        type: "paragraph",
        text: "Ngày khai giảng không cần món quà đắt tiền. Một gói quà được chọn và tự tay gói lại sẽ đi cùng kỷ niệm lâu hơn nhiều so với giá trị của nó.",
      },
      { type: "heading", text: "Chuẩn bị bên trong", level: 2 },
      {
        type: "paragraph",
        text: "Chọn 2–3 cuốn vở giấy kem, một cây bút máy ngòi F phù hợp với người mới tập viết, và một bộ sticker nhãn vở để các em tự trang trí sách vở.",
      },
      { type: "heading", text: "Gói và viết thiệp", level: 2 },
      {
        type: "paragraph",
        text: "Dùng giấy gói màu trơn, điểm thêm một đoạn washi tape và một tấm thiệp nhỏ viết tay vài lời chúc năm học mới. Nét chữ của người tặng chính là phần quý nhất của món quà.",
      },
      {
        type: "paragraph",
        text: "Mẹo: ghim một cuốn sổ A5 nhỏ vào gói quà như một lời mời gọi viết — món quà sẽ còn tiếp tục lớn lên cùng năm học.",
      },
    ],
    relatedHandles: ["tap-vo-a5", "but-chi-bam-marvy-uchida-fl200"],
  },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (the `SortValue` error in `collections.$slug.tsx` may remain until Task 4 — acceptable).

- [ ] **Step 5: Commit**

```bash
git add src/data/blog.ts
git commit -m "feat: add paged blog query and seed posts past page size"
```

---
---

### Task 3: Reusable Pagination component + scroll hook

**Files:**
- Create: `src/components/ui/pagination.tsx`
- Create: `src/hooks/use-scroll-to-on-page.ts`

**Interfaces:**
- Produces:
  - `export function Pagination(props: { to: string; page: number; totalPages: number; search: (targetPage: number) => Record<string, unknown> }): JSX.Element | null` — renders nothing when `totalPages <= 1`. Emits numbered links with `«` / `›` prev/next, ellipsis `…` windows, active & disabled states.
  - `export function useScrollToOnPage(page: number, anchorId: string): void`

- [ ] **Step 1: Create `src/hooks/use-scroll-to-on-page.ts`**

```ts
// src/hooks/use-scroll-to-on-page.ts
import { useEffect, useRef } from "react";

export function useScrollToOnPage(page: number, anchorId: string) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const target = document.getElementById(anchorId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [page, anchorId]);
}
```

- [ ] **Step 2: Create `src/components/ui/pagination.tsx`**

```tsx
// src/components/ui/pagination.tsx
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type PaginationProps = {
  to: string;
  page: number;
  totalPages: number;
  search: (targetPage: number) => Record<string, unknown>;
};

function pageItems(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const wanted = new Set([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const sorted = [...wanted]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const items: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push("...");
    items.push(p);
    prev = p;
  }
  return items;
}

const itemClass =
  "inline-flex h-9 min-w-9 items-center justify-center border border-border px-3 text-[13px]";
const idleClass = "text-foreground transition hover:border-accent hover:text-accent";
const activeClass = "border-accent bg-accent text-white";
const disabledClass = "cursor-not-allowed text-muted-foreground/40";

export function Pagination({ to, page, totalPages, search }: PaginationProps) {
  if (totalPages <= 1) return null;

  const link = (n: number, children: ReactNode, extraClass = "") => (
    <Link
      key={n}
      to={to}
      search={search(n)}
      aria-label={`Trang ${n}`}
      className={`${itemClass} ${n === page ? activeClass : idleClass} ${extraClass}`}
      aria-current={n === page ? "page" : undefined}
    >
      {children}
    </Link>
  );

  return (
    <nav aria-label="Phân trang" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        link(page - 1, <ChevronLeft className="h-4 w-4" aria-hidden />)
      ) : (
        <span
          aria-disabled="true"
          className={`${itemClass} ${disabledClass}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </span>
      )}

      {pageItems(page, totalPages).map((item, i) =>
        item === "..." ? (
          <span key={`gap-${i}`} className={`${itemClass} border-transparent`}>
            …
          </span>
        ) : (
          link(item, item)
        ),
      )}

      {page < totalPages ? (
        link(page + 1, <ChevronRight className="h-4 w-4" aria-hidden />)
      ) : (
        <span aria-disabled="true" className={`${itemClass} ${disabledClass}`}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
```

Note: `extraClass` exists so prev/next can share the same classes; it is empty for all current usages.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (route-level `SortValue` error may persist until Task 4 — acceptable).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/pagination.tsx src/hooks/use-scroll-to-on-page.ts
git commit -m "feat: add shared pagination component and page scroll hook"
```

---
---

### Task 4: Wire pagination + URL sort into the collection route

**Files:**
- Modify: `src/routes/collections.$slug.tsx` (replace the file)

**Interfaces:**
- Consumes: `paginate`-backed `getCategoryProductsPage` (add to `catalog.ts` first — see Step 1), `Pagination`, `useScrollToOnPage`, `appendPageParam` (add to `lib/seo.ts`), `PRODUCT_SORT_KEYS`, `PRODUCTS_PER_PAGE`, `ProductSortKey`, updated `SortSelect`.
- Produces: loaderData shape `{ categoryMeta: { slug: string; title: string; blurb?: string; tiles: Category["tiles"] }, productPage: Paged<Product> }`; search schema keys `page: number` and `sort: ProductSortKey`.

- [ ] **Step 1: Add two helpers to existing modules**

In `src/data/catalog.ts`: add imports and a paged category-products function. At the top, after the existing imports on lines 3–5:

```ts
import { paginate, sortProducts, PRODUCTS_PER_PAGE } from "./pagination";
import type { Paged, ProductSortKey } from "./pagination";
```

After `getCategory()` (after line 211), add:

```ts
export function getCategoryProductsPage(
  category: Category,
  page: number,
  pageSize = PRODUCTS_PER_PAGE,
  sort: ProductSortKey = "default",
): Paged<Product> {
  return paginate(sortProducts(category.products, sort), page, pageSize);
}
```

In `src/lib/seo.ts`: after the `DEFAULT_OG_IMAGE` constant (after line 7), add:

```ts
export function appendPageParam(url: string, page: number): string {
  return page > 1 ? `${url}?page=${page}` : url;
}
```

- [ ] **Step 2: Typecheck the two helper modules**

Run: `npx tsc --noEmit`
Expected: PASS for `src/data/catalog.ts` and `src/lib/seo.ts` (route error persists until Step 4).

- [ ] **Step 3: Commit helpers**

```bash
git add src/data/catalog.ts src/lib/seo.ts
git commit -m "feat: add paged category query and canonical page-param helper"
```

- [ ] **Step 4: Replace `src/routes/collections.$slug.tsx`** with:

```tsx
import { createFileRoute, Link, redirect, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { getCategory, getCategoryProductsPage } from "@/data/catalog";
import { PRODUCT_SORT_KEYS, PRODUCTS_PER_PAGE, type ProductSortKey } from "@/data/pagination";
import { SimpleBreadcrumb } from "@/components/ui/simple-breadcrumb";
import { SortSelect } from "@/components/ui/sort-select";
import { Pagination } from "@/components/ui/pagination";
import { useScrollToOnPage } from "@/hooks/use-scroll-to-on-page";
import { SITE_URL, appendPageParam, buildBreadcrumbSchema } from "@/lib/seo";

const categorySearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  sort: z.enum(PRODUCT_SORT_KEYS).catch("default"),
});

export const Route = createFileRoute("/collections/$slug")({
  validateSearch: categorySearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    sort: search.sort,
  }),
  loader: ({ params, deps }) => {
    const category = getCategory(params.slug);
    if (!category) throw notFound();

    const productPage = getCategoryProductsPage(
      category,
      deps.page,
      PRODUCTS_PER_PAGE,
      deps.sort,
    );

    if (deps.page > productPage.totalPages) {
      throw redirect({
        to: "/collections/$slug",
        params: { slug: params.slug },
        search: { page: productPage.totalPages, sort: deps.sort },
      });
    }

    const { slug, title, blurb, tiles } = category;
    return { categoryMeta: { slug, title, blurb, tiles }, productPage };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Không tìm thấy danh mục — BiBi Studio" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.categoryMeta.title} — BiBi Studio`;
    const description =
      loaderData.categoryMeta.blurb ??
      `Khám phá ${loaderData.categoryMeta.title.toLowerCase()} tại BiBi Studio: sổ tay, scrapbook, bút và phụ kiện journaling.`;
    const url = appendPageParam(
      `${SITE_URL}/collections/${params.slug}`,
      loaderData.productPage.page,
    );
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        {
          property: "og:image",
          content: loaderData.productPage.items[0]?.img ?? "",
        },
        { name: "twitter:image", content: loaderData.productPage.items[0]?.img ?? "" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            buildBreadcrumbSchema([
              { name: "Trang chủ", url: SITE_URL },
              { name: loaderData.categoryMeta.title, url },
            ]),
          ),
        },
      ],
    };
  },
  notFoundComponent: CategoryNotFound,
  component: CategoryPage,
});

function CategoryNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-24 text-center lg:px-12">
        <h1 className="text-2xl font-bold">Không tìm thấy danh mục</h1>
        <Link to="/" className="mt-4 inline-block text-accent underline">
          Về trang chủ
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function CategoryPage() {
  const { categoryMeta, productPage } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  useScrollToOnPage(search.page, "category-listing");

  const handleSort = (sort: ProductSortKey) => {
    if (sort === search.sort) return;
    navigate({ search: { page: 1, sort } });
  };

  const pageSearch = (targetPage: number) => ({
    page: targetPage,
    sort: search.sort,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <div className="border-b border-border bg-secondary/60">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-8 lg:px-12">
            <SimpleBreadcrumb
              crumbs={[{ label: "Trang chủ", to: "/" }, { label: categoryMeta.title }]}
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
              {categoryMeta.title}
            </h1>
            {categoryMeta.blurb && (
              <p className="max-w-2xl text-[13px] text-muted-foreground">
                {categoryMeta.blurb}
              </p>
            )}
          </div>
        </div>

        {categoryMeta.tiles.length > 0 && (
          <section className="mx-auto max-w-[1280px] px-4 pt-10 lg:px-12">
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {categoryMeta.tiles.map((t) => (
                <Link
                  key={`${t.slug}-${t.title}`}
                  to="/collections/$slug"
                  params={{ slug: t.slug }}
                  className="group block"
                >
                  <div className="overflow-hidden bg-secondary">
                    <img
                      src={t.img}
                      alt={t.title}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <h2 className="mt-3 text-[14px] font-semibold text-foreground">{t.title}</h2>
                  <span className="text-[12px] text-accent underline-offset-4 group-hover:underline">
                    Xem tất cả
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section
          id="category-listing"
          className="mx-auto max-w-[1280px] scroll-mt-24 px-4 py-10 lg:px-12"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <p className="text-[13px] text-muted-foreground">
              {productPage.total} sản phẩm
            </p>
            <SortSelect value={search.sort} onChange={handleSort} />
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {productPage.items.map((p) => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>

          <Pagination
            to="/collections/$slug"
            page={productPage.page}
            totalPages={productPage.totalPages}
            search={pageSearch}
          />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: PASS (0 problems).

- [ ] **Step 7: Manual dev-server verification**

Run: `npm run dev` then check in a browser:
1. `/collections/back-to-school` shows "21 sản phẩm", grid of 12, and a pagination bar with pages `1 2`.
2. Click page 2 → URL becomes `?page=2`, 9 products shown, page 2 highlighted; scroll jumps to the listing top.
3. Pick `Giá tăng dần` on page 1 → URL becomes `?sort=asc` (page resets to 1); click page 2 → URL keeps both `?page=2&sort=asc`.
4. `?page=99` on any collection → redirected to the real last page. `?page=abc` → behaves as page 1.
5. Back/forward buttons move between pages correctly.

- [ ] **Step 8: Commit**

```bash
git add src/routes/collections.$slug.tsx
git commit -m "feat: paginate collection product grid with URL-driven page and sort"
```

---
---

### Task 5: Wire pagination into the blog index route

**Files:**
- Modify: `src/routes/blog.index.tsx` (replace the file)

**Interfaces:**
- Consumes: `getBlogPostsPage`, `POSTS_PER_PAGE` (from `data/blog` / `data/pagination`), `Pagination`, `useScrollToOnPage`, `appendPageParam`.
- Produces: search schema key `page: number`; loaderData `{ postPage: Paged<BlogPost> }`.

- [ ] **Step 1: Replace `src/routes/blog.index.tsx`** with:

```tsx
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SimpleBreadcrumb } from "@/components/ui/simple-breadcrumb";
import { LazyImage } from "@/components/ui/lazy-image";
import { Pagination } from "@/components/ui/pagination";
import { useScrollToOnPage } from "@/hooks/use-scroll-to-on-page";
import { getBlogPostsPage } from "@/data/blog";
import { POSTS_PER_PAGE } from "@/data/pagination";
import { SITE_URL, appendPageParam } from "@/lib/seo";

const title = "Nhật ký — BiBi Studio";
const description =
  "Khám phá cảm hứng, hướng dẫn và câu chuyện xoay quanh sổ tay, scrapbook, bút và phụ kiện journaling tại BiBi Studio.";

const blogSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/blog/")({
  validateSearch: blogSearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
  }),
  loader: ({ deps }) => {
    const postPage = getBlogPostsPage(deps.page, POSTS_PER_PAGE);
    if (deps.page > postPage.totalPages) {
      throw redirect({
        to: "/blog",
        search: { page: postPage.totalPages },
      });
    }
    return { postPage };
  },
  head: ({ loaderData }) => {
    const url = appendPageParam(`${SITE_URL}/blog`, loaderData?.postPage.page ?? 1);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: BlogIndexPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function BlogIndexPage() {
  const { postPage } = Route.useLoaderData();
  const search = Route.useSearch();

  useScrollToOnPage(search.page, "blog-listing");

  const pageSearch = (targetPage: number) => ({ page: targetPage });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <div className="border-b border-border bg-secondary/60">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-10 lg:px-12">
            <SimpleBreadcrumb
              crumbs={[{ label: "Trang chủ", to: "/" }, { label: "Nhật ký" }]}
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[32px]">
              Nhật ký BiBi Studio
            </h1>
            <p className="max-w-2xl text-[14px] text-muted-foreground">
              Cảm hứng, mẹo viết tay và những câu chuyện nhỏ xoay quanh sổ tay,
              scrapbook & phụ kiện journaling.
            </p>
          </div>
        </div>

        <section
          id="blog-listing"
          className="mx-auto max-w-[1280px] scroll-mt-24 px-4 py-12 lg:px-12"
        >
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {postPage.items.map((post) => (
              <article
                key={post.slug}
                className="group flex flex-col overflow-hidden border border-border bg-card transition hover:shadow-md"
              >
                <Link to="/blog/$slug" params={{ slug: post.slug }}>
                  <LazyImage
                    src={post.coverImage}
                    alt={post.title}
                    className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {post.category}
                  </span>
                  <h2 className="mt-2 text-[17px] font-semibold leading-snug text-foreground">
                    <Link
                      to="/blog/$slug"
                      params={{ slug: post.slug }}
                      className="hover:text-accent"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-[12px] text-muted-foreground">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span>{post.readTime}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            to="/blog"
            page={postPage.page}
            totalPages={postPage.totalPages}
            search={pageSearch}
          />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (0 problems).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Manual dev-server verification**

Run: `npm run dev` then check in a browser:
1. `/blog` shows 9 posts (newest first — the seeded September posts first) and pagination `1 2`.
2. Click page 2 → URL `?page=2`, 2 posts, page 2 active; scroll-to-top fires.
3. `?page=99` → redirected to page 2. `?page=abc` → page 1.
4. Blog detail pages (`/blog/:slug`) still open for both a page-1 and a page-2 post; homepage blog highlights still render 3 posts.

- [ ] **Step 6: Commit**

```bash
git add src/routes/blog.index.tsx
git commit -m "feat: paginate blog index with URL-driven page"
```

---
---

### Task 6: Full verification pass

**Files:** none (read-only checks + manual QA)

- [ ] **Step 1: Full typecheck + lint + build**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm run build`
Expected: All three pass with zero errors.

- [ ] **Step 2: Search for dead references**

Run: `grep -rn "SortValue" src/` (or equivalent) — expected: no matches.
Run: confirm `getAllBlogPosts` is still imported only by `src/components/blog-highlights.tsx` and that no route imports it.

- [ ] **Step 3: Manual cross-page QA**

Run: `npm run dev` and verify:
1. Collection page 2 + sort deep-link (`/collections/back-to-school?page=2&sort=desc`) loads correctly and its `<link rel="canonical">` is `/collections/back-to-school?page=2` (sort excluded).
2. Collection page 1 canonical has no `?page`.
3. `/blog?page=2` canonical is `/blog?page=2`; `/blog` canonical is `/blog`.
4. Pagination disappears (renders nothing) when a collection has ≤ 12 items — e.g. the smallest section-backed collection — and when a future state has 1 page.

- [ ] **Step 4: Commit any fixes produced by Steps 1–3** (if none, no commit needed)

```bash
git add -A
git commit -m "fix: pagination verification fixes"
```

---
---

## Self-Review Notes

- **Spec coverage:** all 11 confirmed design decisions map to code: URL `?page` (Tasks 4–5), URL `?sort` + reset to page 1 (Task 4 `handleSort`), `paginate` in data layer sliced in loaders only (Tasks 1, 2, 4, 5), page sizes 12/9 as constants (Task 1), bad-param handling via zod `.catch` + loader redirect (Tasks 4–5), self-canonical via `appendPageParam` excluding `sort` (Task 4–5 + helper in Task 4 Step 1), count line shows `total` (Task 4), scroll-to-top excludes first render (Task 3 + usage), shared `Pagination` UI (Task 3), blog date-desc order (Task 2), no catalog seeding needed (documented in header; blog seeded +4).
- **Placeholder scan:** every Step carries full code or an explicit expected result; no TBDs.
- **Type consistency:** `Paged<T>`, `paginate`, `PRODUCTS_PER_PAGE`, `POSTS_PER_PAGE`, `ProductSortKey`, `PRODUCT_SORT_KEYS`, `getCategoryProductsPage`, `getBlogPostsPage`, `Pagination`, `useScrollToOnPage`, `appendPageParam` are defined once and referenced with identical signatures throughout.
