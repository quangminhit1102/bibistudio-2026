# Content Public Admin Forms — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Mở rộng form admin (sản phẩm + bài viết) để thu thập đủ field public, và chuyển MediaPicker sang upload backend.

**Architecture:** Thêm field vào `productConfig`/`postConfig` (config-driven `ComposeForm`); MediaPicker dùng `POST /api/media` thay vì IndexedDB.

**Tech Stack:** React 19, TanStack, `AdminHttpClient` (`src/lib/admin-http.ts`), vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-content-public-backend-design.md`

## Global Constraints

- Field mới đặt trong `products/config.tsx` (post trong `content/config.tsx`) theo `EntityConfig.fields` hiện có (type: text/textarea/select/checkbox/number).
- `occasion` là `select` dùng danh sách cố định (id + label) mirror `occasions` trong `src/data/catalogue.ts`.
- Mô tả sản phẩm đổi thành **plain text** (2 ô textarea vi/en), bỏ rich-text cho mô tả sản phẩm.
- MediaPicker upload `POST /api/media` (base64, ≤2 MiB) và trả `media.id`.
- Không commit `src/routeTree.gen.ts` incidental.

---

### Task 1: Mở rộng model frontend (contracts + validation)

**Files:**
- Modify: `src/features/admin/services/contracts.ts` (Product thêm `nameEn?`, `descriptionEn?`, `shortDescriptionEn?`, `dimensions?`, `materialVi?`, `materialEn?`, `pages?`, `formatVi?`, `formatEn?`, `occasion?`, `featured?`, `sortOrder?`, `imageAltVi?`, `imageAltEn?`; Post thêm `readTime?`, `coverImageId?`)
- Modify: `src/features/admin/services/validation.ts` (schema field mới)
- Test: `tests/admin/` hiện có (cập nhật nếu cần)

- [ ] **Step 1:** Thêm field vào contracts + validation; chạy `tsc --noEmit` để bắt mọi nơi; commit.

### Task 2: Form sản phẩm (config fields)

**Files:**
- Modify: `src/features/admin/products/config.tsx`
- Modify: `src/features/admin/shared/forms/compose-form.tsx` (mô tả → 2 textarea thay rich-text; danh sách field metadata cập nhật)

- [ ] **Step 1:** Thêm các field mới vào `productConfig.fields` (nameEn, descriptionEn textarea full, dimensions, pages, materialVi/En, formatVi/En, occasion select, featured checkbox, sortOrder number, imageAltVi/En). Đổi `description` → 2 field textarea (vi/en) thay cho rich-text (bỏ `bodyKey` rich cho product).

- [ ] **Step 2:** Chạy `tsc --noEmit` + vitest admin; commit.

### Task 3: Form bài viết (config fields)

**Files:**
- Modify: `src/features/admin/content/config.tsx`

- [ ] **Step 1:** Thêm `readTime` (text) và `coverImageId` (media) vào `postConfig.fields`; `defaults` thêm `readTime: ""`, `coverImageId: null`. Chạy test; commit.

### Task 4: MediaPicker upload backend

**Files:**
- Modify: `src/features/admin/content/components/media-picker.tsx` (upload `POST /api/media` khi session http, lưu media.id vào imageIds)
- Modify: `src/lib/admin-http.ts` nếu cần helper upload media
- Test: `tests/admin/` (mock upload)

- [ ] **Step 1:** Sửa MediaPicker: khi `session.kind === "http"`, thay `store.importMedia` bằng `client.request("/api/media", { method:"POST", body:{ mimeType, data } })`; ảnh xem qua `/api/media/:id`. Chạy test; commit.

---

## Self-Review
Spec §4 → Task 2/3/4; §4 media upload → Task 4; §3 mô tả plain text → Task 2. Đủ.
