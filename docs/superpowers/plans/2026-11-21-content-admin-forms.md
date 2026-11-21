# Content Admin Editor Forms — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin đổi 5 entity nội dung sang backend API (single source), bỏ thẻ bài viết, đổi `sku`→`productCode`, `vatApplied`→`vatRate`, gỡ `stock` khỏi form sản phẩm, tác giả/ngày xuất bản tự động, và sửa bố cục form responsive.

**Architecture:** Thêm `createHttpEntityService` hiện thực `EntityService<K>` qua `AdminHttpClient` (đã có sẵn, xử lý auth + If-Match). Đăng ký 5 entity vào `serverEntities` trong `context.tsx`. Sửa model `contracts.ts`, các `config.tsx`, và `compose-form.tsx` + `admin.css`.

**Tech Stack:** React 19, TanStack Query, `AdminHttpClient` (`src/lib/admin-http.ts`), vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-content-admin-backend-design.md` (§6). Plan A tạo backend CRUD; Plan B tạo public API.

## Global Constraints

- Backend là nguồn duy nhất: các entity nội dung (posts/products/categories/customers) không dùng store local nữa.
- `author_id` của bài viết = account đang đăng nhập (không còn field "Tác giả").
- `publish_at` mặc định = thời điểm tạo (hôm nay), vẫn sửa được.
- Bỏ `tagIds` và entity `tags`. Thẻ sản phẩm = cột `tags` (JSON string tự do).
- `product_code` là string chữ số, unique; `vat_rate` decimal mặc định 8.00, editable.
- Bỏ `stock` khỏi form sản phẩm (chỉ còn `price`/`compareAt`; tồn kho ở trang riêng).
- Không viết lại git history (Lovable).

---

### Task 1: HTTP entity service

**Files:**
- Create: `src/features/admin/services/http-entity-service.ts`
- Test: `src/features/admin/services/http-entity-service.test.ts`

**Interfaces:**
- Consumes: `EntityService<K>` (contracts.ts:320), `AdminHttpClient` (admin-http.ts), `Resource`.
- Produces: `createHttpEntityService(client, entity, resource): EntityService<K>`.

- [ ] **Step 1: Viết test (fail)** — mock `AdminHttpClient` (đối tượng có `request`/`requestBlob`), gọi `createHttpEntityService(client, "customers", "bookstore").list({page:1,pageSize:10})` → assert gọi `request("/api/customers", { method:"GET", ... })` và trả `{items,total,page,pageSize}`.

- [ ] **Step 2: Viết service**

`src/features/admin/services/http-entity-service.ts`:

```ts
import type { AdminHttpClient } from "../../../lib/admin-http";
import type { Resource } from "./contracts";
import type { EntityKey, EntityService, ListInput, ListResult, CreateInput, AdminModels } from "./contracts";

function basePath(entity: EntityKey, resource?: Resource): string {
  if (entity === "categories")
    return resource === "content" ? "/api/content-categories" : "/api/product-categories";
  const map: Record<string, string> = {
    posts: "/api/posts",
    products: "/api/products",
    customers: "/api/customers",
  };
  if (!map[entity]) throw new Error("Unsupported server entity: " + entity);
  return map[entity];
}

export function createHttpEntityService<K extends EntityKey>(
  client: AdminHttpClient,
  entity: K,
  resource?: Resource,
): EntityService<K> {
  const base = basePath(entity, resource);
  return {
    async list(input: ListInput) {
      const q = new URLSearchParams({
        page: String(input.page),
        size: String(input.pageSize),
      });
      if (input.search) q.set("q", input.search);
      if (input.sort) { q.set("sort", input.sort.field); q.set("dir", input.sort.direction); }
      for (const [k, v] of Object.entries(input.filters ?? {})) if (v) q.set("f_" + k, v);
      return client.request<ListResult<AdminModels[K]>>(`${base}?${q}`);
    },
    async get(id, signal) {
      return client.request<AdminModels[K]>(`${base}/${id}`, { signal });
    },
    async create(input) {
      return client.request<AdminModels[K]>(base, { method: "POST", body: input });
    },
    async update(id, input, revision) {
      return client.request<AdminModels[K]>(`${base}/${id}`, { method: "PUT", body: input, ifMatch: revision });
    },
    async remove(id, revision) {
      await client.request<void>(`${base}/${id}`, { method: "DELETE", ifMatch: revision });
    },
    async bulk(action, records) {
      let updated = 0;
      const failures: { id: string; message: string }[] = [];
      for (const r of records) {
        try {
          if (action.type === "delete") await this.remove(r.id, r.revision);
          else await this.update(r.id, action.values as Partial<CreateInput<K>>, r.revision);
          updated++;
        } catch (e) {
          failures.push({ id: r.id, message: e instanceof Error ? e.message : "lỗi" });
        }
      }
      return { updated, failures };
    },
    async export(input) {
      const result = await this.list({ ...input, page: 1, pageSize: 200 });
      return result.items;
    },
  };
}
```

- [ ] **Step 3: Chạy test → pass** — Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' node_modules/vitest/vitest.mjs run src/features/admin/services/http-entity-service.test.ts`

- [ ] **Step 4: Commit** `git commit -m "feat(admin): add HTTP entity service for content entities"`

---

### Task 2: Đăng ký server entities + đổi service()

**Files:**
- Modify: `src/features/admin/services/context.tsx:48,178-190`

- [ ] **Step 1: Sửa `serverEntities`** thành:

```ts
const serverEntities: EntityKey[] = ["users","roles","audit","visitors","sessions","posts","products","categories","customers"];
```

- [ ] **Step 2: Sửa `service()`** để dùng HTTP service cho server entity khi session http:

```ts
const service = useCallback(
  <K extends EntityKey>(entity: K, resource?: Resource) => {
    if (session?.kind === "http" && serverEntities.includes(entity))
      return createHttpEntityService(auth.client!, entity, resource);
    return createEntityService(store, entity, () => session, resource ?? resourceForEntity(entity));
  },
  [store, session, auth.client],
);
```

- [ ] **Step 3: Chạy typecheck + test admin hiện có** — Run: `& '.superpowers/node24/node_modules/node/bin/node.exe' node_modules/typescript/bin/tsc --noEmit`; `vitest run --config vitest.admin.config.ts tests/admin`

- [ ] **Step 4: Commit** `git commit -m "feat(admin): route content entities through backend API"`

---

### Task 3: Đổi model (contracts) — bỏ tags, sku→productCode, vatApplied→vatRate

**Files:**
- Modify: `src/features/admin/services/contracts.ts` (Product: `sku`→`productCode`; Customer: `vatApplied`→`vatRate: number`; Post: bỏ `tagIds`; bỏ `tags` khỏi `AdminModels` + `entityKeys`)
- Modify: `src/features/admin/services/validation.ts` (`sku`→`productCode` unique; bỏ validate `tagIds`; `vatRate` 0..100)
- Modify: `src/features/admin/products/seed.ts`, `content/seed.ts` (bỏ `tags`/`tagIds`, thêm `productCode`/`vatRate`)

- [ ] **Step 1: Sửa contracts** — thay tất cả tham chiếu `sku` → `productCode`; `vatApplied` → `vatRate`; xoá field `tagIds` trên Post và type `Tag` + `tags` khỏi `entityKeys`/`AdminModels`.

- [ ] **Step 2: Cập nhật seed/validation** theo đúng tên mới; chạy `tsc --noEmit` để bắt mọi chỗ còn sót (config, columns, inventory-service, entity-manager…).

- [ ] **Step 3: Commit** `git commit -m "refactor(content): rename sku to productCode, vatApplied to vatRate, drop tags"`

---

### Task 4: Sửa config form (content, products, customers)

**Files:**
- Modify: `src/features/admin/content/config.tsx`
- Modify: `src/features/admin/products/config.tsx`
- Modify: `src/features/admin/customers/config.tsx`

- [ ] **Step 1: content/config.tsx** — bỏ field `authorId` (select) và `tagIds`; `defaults.publishAt` = `new Date().toISOString()`; thêm `description` cho `seoTitle`/`seoDescription` ("để trống → dùng tiêu đề/tóm tắt"); xoá `tagConfig`.

- [ ] **Step 2: products/config.tsx** — đổi `{ key: "sku", label: "SKU" }` → `{ key: "productCode", label: "Mã sản phẩm" }`; xoá field `stock`; thêm mô tả SEO.

- [ ] **Step 3: customers/config.tsx** — thay `{ key: "vatApplied", type: "checkbox" }` bằng `{ key: "vatRate", label: "VAT (%)", type: "number", min: 0, max: 100 }`; `defaults.vatRate = 8`; cập nhật `columns`/`filters` VAT.

- [ ] **Step 4: Chạy typecheck + test, commit** — `tsc --noEmit`; commit `git commit -m "feat(admin): update content/product/customer forms"`

---

### Task 5: Bố cục form responsive (full-width metadata)

**Files:**
- Modify: `src/features/admin/shared/forms/compose-form.tsx` (dời khối aside → card full-width)
- Modify: `src/features/admin/admin.css` (grid `.a-compose-layout` → 1 cột; `.a-compose-fields` responsive)

- [ ] **Step 1: Sửa `compose-form.tsx`** — bỏ `<aside>`; đưa card "Thông tin bài viết"/"Phân loại & hiển thị" thành một `<Card>` trong `.a-compose-stack` chính (ngay sau card tiêu đề), dùng `<div className="a-compose-fields">` cho các trường (đã là grid 3→2→1). Ảnh bìa/ảnh sản phẩm thành card riêng cùng cột. Bỏ `authorId`/`tagIds` khỏi danh sách field (đã xoá ở Task 4). Ẩn `stock` không còn trong `config.fields`.

- [ ] **Step 2: Sửa `admin.css`** — `.a-compose-layout { grid-template-columns: 1fr; }`; giữ `.a-compose-fields` responsive (3 cột desktop → 1 cột mobile, đã có sẵn ở `@media (max-width:600px)`; thêm breakpoint 900px → 2 cột). Bỏ các rule `aside` không còn dùng.

- [ ] **Step 3: Chạy vitest UI admin + kiểm tra thủ công qua preview** — Run: `vitest run --config vitest.admin.config.ts tests/admin`; mở `/admin/content/posts/create` kiểm tra layout ở 3 kích thước.

- [ ] **Step 4: Commit** `git commit -m "feat(admin): responsive full-width editor metadata layout"`

---

## Self-Review

- **Spec coverage:** §6 (bố cục full-width, tác giả tự động, ngày xuất bản mặc định, bỏ thẻ, productCode, gỡ stock, vat_rate) — Task 3/4/5; nối backend — Task 1/2.
- **Placeholder scan:** `createHttpEntityService` có code đầy đủ; danh sách file đổi cụ thể.
- **Type consistency:** `vatRate`/`productCode` nhất quán giữa contracts, validation, config, seed; `basePath()` trả đúng đường dẫn backend Plan A đã tạo (`/api/posts`, `/api/products`, `/api/product-categories`, `/api/content-categories`, `/api/customers`).
