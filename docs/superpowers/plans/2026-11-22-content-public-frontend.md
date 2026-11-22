# Content Public Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Site public đọc nội dung (products/posts/categories) từ backend API và render đầy đủ như nội dung cũ.

**Architecture:** Mở rộng public API trả shape public (Localized/attributes/images/readTime/cover); `src/lib/content-api.ts` thêm hàm list/collection; các route public đổi loader sang fetch; blog render `html-v1`.

**Tech Stack:** React 19, TanStack Router, `resolveSeo` (`src/lib/content-seo.ts`), `sanitize.ts`, vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-content-public-backend-design.md`

## Global Constraints

- Chỉ đổi dữ liệu động (products/posts/categories/collections); từ vựng tĩnh (`productTypes`, `occasions`) giữ `import` từ `@/data/catalogue` (tập đóng).
- Ảnh: API trả `images:[url]`; URL tĩnh giữ nguyên, media id → `/api/media/:id`.
- SEO: `head` dùng `resolveSeo` (title/description/og) từ data API; client-side (Google render JS).
- Blog detail render `html-v1` qua sanitize; mục lục parse heading từ HTML.

---

### Task 1: Public API trả shape đầy đủ

**Files:**
- Modify: `backend/src/content/public-service.ts` (trả `name:{vi,en}`, `description:{vi,en}`, attributes, occasion, featured, sortOrder, images:[url], read_time, cover_url, category_name, author_name)
- Modify: `backend/src/content/public-routes.ts` (thêm `/api/public/collections`, `/api/public/categories` trả tên + slug)
- Test: `backend/test/content-public-http.test.mjs`

- [ ] **Step 1:** Sửa `public-service.ts` — join categories/users để lấy tên; resolve images (media id → `/api/media/:id`, URL tĩnh giữ nguyên); map `name`/`name_en` → `{vi,en}`.

- [ ] **Step 2:** Sửa `public-routes.ts` thêm `/collections` + `/categories` (scope).

- [ ] **Step 3:** Chạy test; commit.

### Task 2: Frontend content-api (list + collection)

**Files:**
- Modify: `src/lib/content-api.ts` (thêm `getPublicPosts`, `getPublicProducts`, `getPublicCategories`, `getPublicCollections`)

- [ ] **Step 1:** Thêm các hàm list trả `T[] | null` (dùng `getJson`); giữ graceful degradation. Chạy test (`src/lib/content-seo.test.ts` mở rộng nếu cần); commit.

### Task 3: Loader public đổi sang API

**Files:**
- Modify: `src/routes/index.tsx`, `blog.index.tsx`, `blog.$slug.tsx`, `products.index.tsx`, `products.$slug.tsx`, `collections.index.tsx`, `collections.$slug.tsx`
- Modify: `src/lib/content-seo.ts` (nếu cần shape mới)

- [ ] **Step 1:** Đổi loader từng route sang fetch API (loader async); map shape API → shape public component đang dùng (Localized, images, attributes...). Giữ component render gần như nguyên.

- [ ] **Step 2:** Blog detail render `html-v1` qua `sanitize.ts` + mục lục parse heading; cover từ `cover_url`.

- [ ] **Step 3:** `head` dùng `resolveSeo` với data API.

- [ ] **Step 4:** `tsc --noEmit` + build (`scripts/build.mjs`) + vitest; commit.

### Task 4: E2E smoke (browser) + evidence

**Files:**
- Test: `scripts/content-public-preview.test.mjs` (Playwright: mở trang chủ + /blog + /products trên preview server, assert có sản phẩm/bài viết mới, chụp screenshot)

- [ ] **Step 1:** Viết smoke test mở preview (mirror `tests/e2e/*.spec.mjs`), verify homepage hiển thị sản phẩm/bài viết từ API; chụp screenshot desktop + mobile vào `.superpowers/e2e/`.

- [ ] **Step 2:** Chạy test → PASS; commit.

---

## Self-Review
Spec §5 (API shape + route + SEO + blog render) → Task 1/2/3; §5 frontend → Task 3; §9 render HTML → Task 3. Đủ.
