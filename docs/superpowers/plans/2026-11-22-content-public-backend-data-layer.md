# Content Public Backend (schema v9 + media) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Mở rộng backend để chứa đủ model public (song ngữ, thuộc tính, featured/occasion, readTime, cover) và thêm media upload/serve.

**Architecture:** Migration v9 thêm cột nullable vào `products`/`posts` + bảng `media`. Media store trên disk (mirror `backend/src/profile/avatar-store.ts`) + route upload/serve. Migration/seed mở rộng để giữ nguyên dữ liệu tĩnh cũ đủ field.

**Tech Stack:** Node 24 (`.superpowers/node24/...`), Express 5, mysql2/promise, Zod, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-22-content-public-backend-design.md`

## Global Constraints

- ID `VARCHAR(36)`; `revision`/`created_at`/`updated_at` DATETIME(3).
- Thêm cột **nullable** (không phá v8); migration là file SQL mới `002_content_v9.sql` trong `backend/content-migrations/` (KHÔNG sửa `001_content.sql` đã deploy).
- Ảnh cũ giữ URL tĩnh; chỉ ảnh mới upload media. `image_ids` chứa media id (mới) hoặc URL tĩnh (cũ); public API phân giải media id → `/api/media/:id`.
- Media store trên disk theo pattern `createAvatarStore` (an toàn symlink/alias, ngoài webroot).
- Node: `& '.superpowers/node24/node_modules/node/bin/node.exe'`; tests import từ `backend/dist`.

---

### Task 1: Migration v9 + media table + schemaStatus

**Files:**
- Create: `backend/content-migrations/002_content_v9.sql`
- Modify: `backend/src/content/schema.ts` (thêm target `media`; `migrateContent` xử lý multi-file; `contentSchemaStatus`/`assertContentReady` cập nhật steps)
- Test: `backend/test/content-schema.test.mjs`

**Interfaces:**
- Consumes: `migrateContent(pool, directory)` hiện có (chỉ đọc `001_content.sql`).
- Produces: `contentSchemaStatus`/`assertContentReady` chấp nhận 2 file (`001_content.sql` + `002_content_v9.sql`), ledger `completed_steps` tổng (6 steps).

- [ ] **Step 1: Viết migration SQL** — `002_content_v9.sql` gồm 2 statement:

```sql
ALTER TABLE products
  ADD COLUMN name_en VARCHAR(255) NULL,
  ADD COLUMN short_description_en TEXT NULL,
  ADD COLUMN description_en TEXT NULL,
  ADD COLUMN dimensions VARCHAR(100) NULL,
  ADD COLUMN pages VARCHAR(50) NULL,
  ADD COLUMN material_vi VARCHAR(255) NULL,
  ADD COLUMN material_en VARCHAR(255) NULL,
  ADD COLUMN format_vi VARCHAR(100) NULL,
  ADD COLUMN format_en VARCHAR(100) NULL,
  ADD COLUMN occasion VARCHAR(64) NULL,
  ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN image_alt_vi VARCHAR(255) NULL,
  ADD COLUMN image_alt_en VARCHAR(255) NULL;

CREATE TABLE media (
  id VARCHAR(36) PRIMARY KEY,
  mime VARCHAR(64) NOT NULL,
  size BIGINT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  path VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB;
```

- [ ] **Step 2: Sửa `schema.ts`** — `targets` thêm `"media"`; `asset(directory)` đọc đúng 2 file (`001_content.sql`, `002_content_v9.sql`) và tách steps (DDL `ALTER TABLE` + `CREATE TABLE` đều hợp lệ); `migrateContent` lặp cả 2 file ghi `ddl_hashes`; `assertContentReady` yêu cầu `completed_steps === 6`. Đọc `backend/src/visitors/controls-schema.ts` để mirror logic multi-step.

- [ ] **Step 3: Chạy test** `& '.superpowers/node24/node_modules/node/bin/node.exe' --test backend/test/content-schema.test.mjs` (cập nhật expected steps) → PASS; commit.

---

### Task 2: Media store + upload/serve route

**Files:**
- Create: `backend/src/content/media-store.ts`
- Create: `backend/src/content/media-routes.ts`
- Modify: `backend/src/app.ts` (mount media route khi `options.content` có; `content` option thêm `mediaDirectory`)
- Modify: `backend/src/runtime.ts` (thêm `mediaDirectory: resolve(__dirname, "../media")` hoặc env `BIBI_MEDIA_DIR`)
- Test: `backend/test/content-media.test.mjs`

**Interfaces:**
- Consumes: `createAvatarStore` pattern (`backend/src/profile/avatar-store.ts`).
- Produces: `createMediaStore({ root }): { save(bytes: Buffer, mime: string, w: number, h: number): Promise<{id,path}>; read(id): Promise<Buffer> }`; `mediaRoutes(store, auth, config): Router` mount `/api/media`.

- [ ] **Step 1: Viết test (fail)** — upload base64 → 201 trả `{id}`; GET `/api/media/:id` → 200 image bytes; ảnh quá 2 MiB → 413.

- [ ] **Step 2: Viết `media-store.ts`** mirror `avatar-store` (an toàn path/symlink, ghi file vào thư mục media, đọc lại).

- [ ] **Step 3: Viết `media-routes.ts`** — `POST /api/media` (authenticate + requirePermission `product.create` OR `post.create`; nhận `{ mimeType, data(base64) }` → save → trả `{id}`); `GET /api/media/:id` (authenticate, serve `image/jpeg`|`image/png`). Mount trong `app.ts`.

- [ ] **Step 4: Chạy test → PASS; commit.**

---

### Task 3: Service/route trả field mới (products/posts)

**Files:**
- Modify: `backend/src/content/service.ts` (DTO + list/get + create/update cho `name_en`, `description_en`, `dimensions`, `material`, `pages`, `format`, `occasion`, `featured`, `sort_order`, `image_alt`, `read_time`, `cover_image_id`)
- Modify: `backend/src/content/routes.ts` (Zod schema create/update thêm field mới)
- Test: `backend/test/content-service.test.mjs`, `backend/test/content-http.test.mjs`

**Interfaces:**
- Consumes: `products`/`posts` columns v9.
- Produces: `ProductDto` mở rộng (`nameEn`, `descriptionEn`, `dimensions`, `materialVi/En`, `pages`, `formatVi/En`, `occasion`, `featured`, `sortOrder`, `imageAltVi/En`), `PostDto` thêm `readTime`, `coverImageId`.

- [ ] **Step 1: Sửa DTO map (snake→camel)** trong `service.ts` — thêm các trường trên vào `ProductDto`/`PostDto` và `rowToDto`.

- [ ] **Step 2: Sửa create/update SQL** để ghi/đọc các cột mới.

- [ ] **Step 3: Sửa Zod schema trong `routes.ts`** thêm field mới (optional/nullable).

- [ ] **Step 4: Chạy test → PASS; commit.**

---

### Task 4: Seed giữ nguyên dữ liệu cũ (đủ field)

**Files:**
- Modify: `scripts/generate-content-seed.mjs` (xuất đủ field từ `catalogue.ts`/`blog.ts`: name_en, description_en, dimensions, material, pages, format, occasion, featured, sortOrder, imageAlt; posts: read_time, cover)
- Modify: `backend/src/content/seed.ts` (insert đủ field)
- Test: `backend/test/content-seed.test.mjs`, `scripts/generate-content-seed.test.mjs`

**Interfaces:**
- Consumes: `catalogue.ts` `Product`/`Collection`/`Occasion` shape; `blog.ts` `BlogPost`.
- Produces: `content-seed.json` đủ field; `seedContent` insert đủ field.

- [ ] **Step 1: Sửa `generate-content-seed.mjs`** — map `Product.name.en` → `name_en`, `description.en` → `description_en`, `dimensions/material/pages/format/occasion/featured/sortOrder/images/imageAlt` → các cột mới; `BlogPost.readTime/coverImage` → `read_time`/`cover_image_id`.

- [ ] **Step 2: Sửa `seed.ts`** insert đủ field mới.

- [ ] **Step 3: Chạy test + regenerate seed → PASS; commit.**

---

## Self-Review
- Spec §3 (schema v9 + media) → Task 1; §5 (media serve) → Task 2; §3 field → Task 3; §6 (migration đủ field) → Task 4. §7 validation → Task 3. Không còn placeholder.
