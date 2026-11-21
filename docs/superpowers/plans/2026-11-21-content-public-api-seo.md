# Content Public API + SEO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site public đọc posts/products/categories qua API backend; SEO client-side đúng giá trị (seoTitle||title, seoDescription||excerpt/shortDescription) và sửa lỗi `<meta name="description">` không cập nhật theo trang.

**Architecture:** Backend thêm endpoint public read-only (không cần đăng nhập) trả dữ liệu đúng shape public đang dùng. Frontend thêm client fetch + đổi loader các route public từ `import "@/data/…"` sang fetch. SEO tính trong `head` (client-side — Google render JS, đã test chứng minh).

**Tech Stack:** Express 5, TanStack Router (loader/head), fetch qua `AdminHttpClient` pattern không cần (public dùng `fetch` thường), `node --test` backend + `vitest` frontend.

**Spec:** `docs/superpowers/specs/2026-11-21-content-admin-backend-design.md` (§5). Plan A tạo các bảng + CRUD admin.

## Global Constraints

- Endpoint public KHÔNG cần đăng nhập, chỉ GET, chỉ trả bản ghi `status = published` (sản phẩm) / `published` (bài viết).
- `title = seo_title || title`; `description = seo_description || (post.excerpt / product.short_description)`.
- Không đổi kiến trúc phục vụ (vẫn Apache tĩnh + `/api/*` Node); meta là client-side.
- Không viết lại git history (Lovable).

---

### Task 1: Endpoint public read-only

**Files:**
- Create: `backend/src/content/public-service.ts`
- Create: `backend/src/content/public-routes.ts`
- Modify: `backend/src/app.ts` (mount `publicRoutes` — không cần auth)
- Test: `backend/test/content-public-http.test.mjs`

**Interfaces:**
- Consumes: bảng `posts`/`products`/`product_categories`/`content_categories` từ Plan A.
- Produces: `contentPublicRoutes(pool, clock): Router` mount tại `/api/public`.

- [ ] **Step 1: Viết test HTTP (fail)**

`backend/test/content-public-http.test.mjs` — seed 1 post `published`, 1 post `draft`, gọi `GET /api/public/posts` → chỉ thấy post `published`; `GET /api/public/posts/:slug` → đúng slug.

- [ ] **Step 2: Chạy → fail** (route chưa có → 404)

- [ ] **Step 3: Viết service + routes**

`backend/src/content/public-service.ts` (truy vấn đơn giản, không `withRbacWrite`):

```ts
import type { Pool, RowDataPacket } from "mysql2/promise";

export function createContentPublicService(pool: Pool) {
  return {
    async listPosts() {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id,slug,title,excerpt,seo_title,seo_description,category_id,author_id,publish_at,content FROM posts WHERE status='published' ORDER BY publish_at DESC",
      );
      return rows;
    },
    async getPost(slug: string) {
      const [[row]] = await pool.query<RowDataPacket[]>(
        "SELECT id,slug,title,excerpt,seo_title,seo_description,category_id,author_id,publish_at,content FROM posts WHERE slug=? AND status='published'",
        [slug],
      );
      return row ?? null;
    },
    // listProducts/getProduct/listCategories(scope) tương tự (products lọc status='published')
  };
}
```

`backend/src/content/public-routes.ts`:

```ts
import { Router } from "express";
import type { Pool } from "mysql2/promise";
import type { Clock } from "../config";
import { createContentPublicService } from "./public-service";

export function contentPublicRoutes(pool: Pool, _clock: Clock): Router {
  const r = Router();
  const svc = createContentPublicService(pool);
  r.get("/posts", async (_req, res) => res.json(await svc.listPosts()));
  r.get("/posts/:slug", async (req, res) => {
    const post = await svc.getPost(String(req.params.slug));
    if (!post) return res.status(404).json({ error: "Not found" });
    res.json(post);
  });
  r.get("/products", async (_req, res) => res.json(await svc.listProducts()));
  r.get("/products/:slug", async (req, res) => {
    const product = await svc.getProduct(String(req.params.slug));
    if (!product) return res.status(404).json({ error: "Not found" });
    res.json(product);
  });
  r.get("/categories", async (req, res) =>
    res.json(await svc.listCategories(String(req.query.scope ?? "product"))),
  );
  return r;
}
```

`backend/src/app.ts` — mount KHÔNG cần auth (sau block health, trước các route auth):

```ts
if (options.db)
  app.use("/api/public", contentPublicRoutes(options.db, options.clock ?? systemClock));
```

- [ ] **Step 4: Chạy test → pass**

Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' --test backend/test/content-public-http.test.mjs`

- [ ] **Step 5: Commit** `git commit -m "feat(content): add public read endpoints"`

---

### Task 2: SEO helper (fallback) + sửa lỗi description

**Files:**
- Create: `src/lib/content-seo.ts`
- Modify: `src/routes/__root.tsx:80-104`
- Test: `src/lib/content-seo.test.ts`

**Interfaces:**
- Consumes: object `{ seoTitle?, seoDescription?, title, excerpt? , shortDescription? }`.
- Produces: `resolveSeo(input): { title: string; description: string }`.

- [ ] **Step 1: Viết test (fail)**

`src/lib/content-seo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveSeo } from "./content-seo";

describe("resolveSeo", () => {
  it("falls back to title/excerpt when seo empty", () => {
    expect(resolveSeo({ seoTitle: "", seoDescription: "", title: "A", excerpt: "B" }))
      .toEqual({ title: "A", description: "B" });
  });
  it("uses seo overrides when provided", () => {
    expect(resolveSeo({ seoTitle: "SEO A", seoDescription: "SEO B", title: "A", excerpt: "B" }))
      .toEqual({ title: "SEO A", description: "SEO B" });
  });
});
```

- [ ] **Step 2: Chạy → fail** (`Cannot find module`)

- [ ] **Step 3: Viết `resolveSeo`**

`src/lib/content-seo.ts`:

```ts
export function resolveSeo(input: {
  seoTitle?: string;
  seoDescription?: string;
  title: string;
  excerpt?: string;
  shortDescription?: string;
}): { title: string; description: string } {
  const fallbackDescription = input.excerpt?.trim() || input.shortDescription?.trim() || "";
  return {
    title: (input.seoTitle?.trim() || input.title).trim(),
    description: (input.seoDescription?.trim() || fallbackDescription).trim(),
  };
}
```

- [ ] **Step 4: Sửa lỗi description ở `__root.tsx`**

Trong `head` root, **bỏ** dòng `{ name: "description", content: "BiBi Studio — sổ tay…" }` (đây là thẻ gây lỗi ghi đè). Chuyển mô tả mặc định của trang chủ vào `index.tsx` head. Sau đó bài viết/sản phẩm tự set `name="description"` bằng `resolveSeo(...).description`.

- [ ] **Step 5: Chạy test + typecheck, commit**

Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' node_modules/vitest/vitest.mjs run src/lib/content-seo.test.ts`; `tsc --noEmit`
Commit: `git commit -m "feat(seo): resolve SEO title/description fallback and fix per-page description"`

---

### Task 3: Loader public đổi sang fetch API + áp SEO

**Files:**
- Create: `src/lib/content-api.ts`
- Modify: `src/routes/blog.index.tsx`, `blog.$slug.tsx`, `products.index.tsx`, `products.$slug.tsx`, `collections.index.tsx`, `collections.$slug.tsx`, `index.tsx`
- Test: `scripts/content-public-preview.test.mjs` (smoke bằng Playwright, như test đã làm: đọc `document.title` + meta)

**Interfaces:**
- Consumes: `resolveSeo` (Task 2), `/api/public/*` (Task 1).
- Produces: `getPublicPosts()`, `getPublicPost(slug)`, `getPublicProducts()`, `getPublicProduct(slug)` trong `src/lib/content-api.ts`.

- [ ] **Step 1: Viết client**

`src/lib/content-api.ts`:

```ts
async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error("Không thể tải dữ liệu");
  return r.json() as Promise<T>;
}
export const getPublicPosts = () => getJson<unknown[]>("/api/public/posts");
export const getPublicPost = (slug: string) => getJson<unknown>(`/api/public/posts/${slug}`);
export const getPublicProducts = () => getJson<unknown[]>("/api/public/products");
export const getPublicProduct = (slug: string) => getJson<unknown>(`/api/public/products/${slug}`);
```

- [ ] **Step 2: Đổi loader từng route**

`blog.$slug.tsx` loader → `const post = await getPublicPost(params.slug); if (!post) throw notFound(); return { post };` và head dùng `resolveSeo({ ...post, title: post.title })`. `blog.index.tsx` → `getPublicPosts()`. `products.*` tương tự. `collections.*`/`index` → `getPublicProducts()` rồi lọc theo `product_type`/`collection` (giữ nguyên logic nhóm hiện có, chỉ đổi nguồn dữ liệu).

> Lưu ý executor: các component dùng chung (`site-header`, `site-footer`, `catalogue-card`, `quick-search`, `blog-highlights`) đang import `@/data/catalogue` cho từ vựng `collections`/`productTypes`. Giữ nguyên các từ vựng tĩnh này (chúng là tập đóng, không đổi); chỉ đổi **dữ liệu động** (posts, products) sang API. Nếu component cần danh sách sản phẩm, truyền dữ liệu từ loader thay vì import trực tiếp.

- [ ] **Step 3: Smoke test SEO (bằng chứng)**

`scripts/content-public-preview.test.mjs` — Playwright mở `/blog/<slug>` trên server preview, đọc `document.title` và `meta[name=description]`, assert khớp `resolveSeo` (title chứa tiêu đề bài; description KHÔNG còn là mô tả chung).

- [ ] **Step 4: Chạy + commit**

Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' --test scripts/content-public-preview.test.mjs`
Commit: `git commit -m "feat(public): serve posts/products from API with SEO fallback"`

---

## Self-Review

- **Spec coverage:** §5 API public (Task 1), SEO fallback + crawler (Task 2–3, client-side thay cho server-side — đã được người dùng duyệt sau test chứng minh).
- **Placeholder scan:** không TBD; shape API cụ thể; helper `resolveSeo` có code.
- **Type consistency:** `resolveSeo` nhất quán giữa helper, head route, test.
