# Hướng dẫn test toàn bộ feature — BiBiStudio Content Backend

> Dành cho một agent (hoặc người) test lại toàn bộ các feature đã implement. Tài liệu giả định người đọc chưa biết gì về codebase.

## 1. Bối cảnh & kiến trúc

Project BiBiStudio: website trưng bày catalogue (sổ tay, thiệp, postcard…). Trước đây nội dung là **file tĩnh** (`src/data/blog.ts`, `src/data/catalogue.ts`); admin ghi vào **store local trình duyệt**.

Đã implement **2 giai đoạn**:

- **Giai đoạn 1 (đã deploy production, schema v8):** nội dung admin (posts, products, danh mục/chuyên mục, khách mua hàng) chuyển sang **backend MySQL**. Các thay đổi form: `productCode` (mã sản phẩm, chữ số), `vatRate` (mặc định 8%), bỏ thẻ bài viết, tác giả tự động, ngày xuất bản mặc định hôm nay, gỡ `stock` khỏi form, SEO fallback, bố cục form responsive.
- **Giai đoạn 2 (chưa deploy, schema v9):** site public **đọc nội dung từ backend** (thay vì file tĩnh) để nội dung mới hiển thị đầy đủ; thêm **media upload** (ảnh lên backend), form sản phẩm mở rộng (tên song ngữ, thuộc tính, occasion, featured).

**Thư mục làm việc (worktree):** `C:\Users\Admin\.codex\worktrees\fullstack-cicd\bibistudio-2026`
**Nhánh:** `codex/admin-dashboard`
**Node dùng để chạy:** `.superpowers/node24/node_modules/node/bin/node.exe` (gọi qua `&` trong PowerShell).

---

## 2. Môi trường & lệnh chạy

Tất cả lệnh chạy từ thư mục worktree. Dùng node24:

```powershell
$node = ".\.superpowers\node24\node_modules\node\bin\node.exe"
```

| Việc | Lệnh |
|---|---|
| Setup DB local (migrate + seed) | `& $node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.build.json; & $node scripts/local-database.mjs` |
| Dev server (FE + Node + PHP) | `npm run dev` |
| Typecheck frontend | `& $node node_modules/typescript/bin/tsc --noEmit` |
| Typecheck backend (build) | `& $node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.build.json` |
| Test admin (vitest) | `& $node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin` |
| Test backend content | `& $node --test backend/test/content-*.test.mjs` |
| Test full (typecheck+lint+unit+backend+scripts+E2E) | `& $node scripts/check.mjs` |

> `scripts/check.mjs` cần MySQL test DB (tự dựng qua `ensureTestDatabase`) và chạy E2E Playwright. Một test `visitor-relay.spec.mjs` **flaky** khi chạy chung nhưng pass khi chạy riêng — không phải lỗi content.

**Trình duyệt để test UI:** Edge `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` (dùng Playwright `chromium.launch({ executablePath })`).

---

## 3. Test checklist — Giai đoạn 1 (backend v8 + form admin)

### 3.1 Backend CRUD content

- Khởi tạo DB: các bảng `posts`, `products`, `product_categories`, `content_categories`, `customers`, `media` tồn tại (`SHOW TABLES`).
- API admin (cần đăng nhập):
  - `GET /api/posts`, `GET /api/products`, `GET /api/customers`, `GET /api/product-categories`, `GET /api/content-categories` → 200, danh sách có phân trang (`?page=1&size=10`).
  - `POST /api/products` tạo sản phẩm → 201; `productCode` **phải là chữ số** (gửi `"abc"` → 400).
  - `PUT /api/products/:id` (kèm `If-Match: "<revision>"`) → cập nhật; sai revision → 409.
  - `DELETE` sản phẩm đang được tham chiếu → 409 `REFERENCED`.
- Migration v9 (nếu test trên DB v8 cũ): chạy migrate → phải **upgrade** lên v9 (không lỗi checksum), bảng `media` + cột mới trên `products`/`posts` xuất hiện; `GET /api/ready` → 200.

### 3.2 Seed giữ dữ liệu cũ

- `seedContent` **idempotent**: chạy 2 lần → lần 2 không thêm bản ghi.
- Seed đủ field: sản phẩm có `name_en`, `description_en`, `featured`, `occasion`, `sort_order`, `image_alt`; bài viết có `read_time`, `cover_image_id`/`image_id`.
- Bài viết `content` lưu dạng `html-v1` envelope: `{"format":"html-v1","html":"..."}`.

### 3.3 Form admin

Vào `/admin` (đăng nhập `admin` hoặc `user01` — mật khẩu bootstrap do `seedIdentity` tạo, xem `.env.local`/secrets).

- **Form bài viết (`/admin/content/posts/create`):**
  - Không còn trường "Tác giả" (tự lấy account đang đăng nhập).
  - "Ngày xuất bản" mặc định = hôm nay.
  - Không còn trường "Thẻ" (thẻ bài viết đã bỏ).
  - Có "Tiêu đề SEO"/"Mô tả SEO" + ghi chú fallback.
- **Form sản phẩm (`/admin/products/create`):**
  - "Mã sản phẩm" (không còn "SKU"), phải chữ số.
  - Không còn trường `stock` (tồn kho) trong form.
  - Có các field mới: tên tiếng Anh, mô tả vi/en, kích thước, số trang, chất liệu, khổ, occasion, featured, sort order, image alt.
  - Mô tả là text (vi/en), không còn rich-text.
- **Khách mua hàng (`/admin/customers`):** field `VAT (%)` (số, mặc định 8) thay cho checkbox cũ.
- **Danh mục / Chuyên mục:** CRUD đầy đủ (thêm/sửa/xóa, phân cấp cha/con).
- **Bố cục:** thu nhỏ cửa sổ (mobile/tablet) → form vẫn đủ rộng, không bị bóp hẹp.

### 3.4 Media upload (giai đoạn 2)

- Trong form sản phẩm, upload ảnh → `POST /api/media` trả `{id}`; ảnh hiển thị lại được.
- `GET /api/media/:id` → ảnh (jpeg/png); upload quá 2 MiB → 413; sai mime → 400.

---

## 4. Test checklist — Giai đoạn 2 (public đọc backend)

### 4.1 API public (không cần đăng nhập)

- `GET /api/public/posts` → danh sách bài **published**, shape `{ slug, title, excerpt, category_name, author_name, publish_at, read_time, cover_url, content, seo_title, seo_description }`.
- `GET /api/public/products` → `{ slug, name:{vi,en}, description:{vi,en}, images:[url], image_alt:{vi,en}, dimensions, pages, material:{vi,en}, format:{vi,en}, occasion, featured, sort_order, price, compare_at, ... }`.
- `GET /api/public/products/:slug`, `GET /api/public/posts/:slug` → chi tiết (404 nếu không tồn tại/không published).

### 4.2 Nội dung mới hiển thị public (test quan trọng nhất)

1. Thêm 1 sản phẩm mới (qua admin hoặc API `POST /api/products` với `status=published`).
2. Thêm 1 bài viết mới (`status=published`).
3. Mở public: `/products` (danh sách) và `/blog` (danh sách) → **sản phẩm/bài viết mới xuất hiện**.
4. Mở trang chi tiết `/products/:slug` và `/blog/:slug` → **hiển thị đầy đủ** (tên, mô tả, ảnh nếu có, thuộc tính, đọc thời gian, ảnh bìa, nội dung bài viết).

### 4.3 Hiển thị đầy đủ như nội dung cũ

- Sản phẩm cũ (74 SP seeded) hiển thị **y nguyên**: tên song ngữ, ảnh, thuộc tính (nếu có), occasion, featured.
- Bài viết cũ (10 bài seeded) hiển thị **y nguyên**: title, excerpt, tác giả, ngày, readTime, ảnh bìa, nội dung (mục lục nếu có heading).
- Ảnh cũ dùng URL tĩnh (giữ nguyên); ảnh mới dùng `/api/media/:id`.

### 4.4 SEO

- Mỗi trang chi tiết có `<title>` và `<meta name="description">` đúng:
  - `title = seo_title || title`; `description = seo_description || (excerpt/short_description)`.
  - Để trống SEO → fallback về tiêu đề/tóm tắt.
- Trang bài viết: `<meta name="description">` KHÔNG còn bị mô tả chung của site ghi đè (đã sửa).

---

## 5. Caveats đã biết (KHÔNG phải lỗi, đừng flag)

1. **SEO là client-side** (Google render JS nên đọc được; không chèn meta server-side). Cơ chế cố ý.
2. **SSR/client divergence:** khi chạy SSR (Lovable), API fetch là client-only → server render static, client render API; có thể có hydration mismatch nhẹ. Trên cPanel production (SPA client-side) không gặp.
3. **`/products/<type-slug>` (listing theo loại, vd `/products/notebooks`) chưa đổi sang API** — vẫn đọc dữ liệu tĩnh. Trang `/products/` và chi tiết sản phẩm đã đọc API. (Follow-up.)
4. **Ảnh inline trong bài viết** (data-media-id/bibi-media) bị bỏ khi render API (chưa có media public). Ảnh bìa/ảnh sản phẩm vẫn hiển thị.
5. **`/api/media` chưa rate-limit** (nên mirror `consumeRateLimit` sau).
6. **Tồn kho + Sales/phiếu giao hàng** vẫn local (chưa migrate backend).
7. **WebP** bị từ chối khi upload (chỉ jpeg/png).

---

## 6. Cách test UI bằng Playwright (Edge) — làm lại evidence

Script mẫu đã có sẵn (đừng dùng trong production, chỉ local):

- `.superpowers/public-evidence.mjs` — chụp 5 screenshot (home/blog/products + chi tiết sản phẩm/bài mới).
- `.superpowers/public-evidence-check.mjs` — verify bằng text (title + `document.body.innerText` chứa nội dung mới).

Chạy:
```powershell
& ".\.superpowers\node24\node_modules\node\bin\node.exe" .superpowers\public-evidence-check.mjs
```

Screenshot lưu ở `.superpowers/e2e/public-evidence/*.png`.

Để test UI tương tác thật (đăng nhập admin, nhập form, upload ảnh): mirror các spec trong `tests/e2e/` (vd `admin-usability.spec.mjs`, `visitor-context-bundle.spec.mjs`) — chúng dựng backend + MySQL test + vite + Playwright.

---

## 7. Tiêu chí "đạt" tổng kết

- [ ] `tsc --noEmit` (FE) + `tsc -p backend/tsconfig.build.json` (BE) clean.
- [ ] `vitest --config vitest.admin.config.ts` pass.
- [ ] `node --test backend/test/content-*.test.mjs` pass.
- [ ] Migration v8→v9 upgrade sạch (không lỗi checksum), `/api/ready` 200.
- [ ] Seed giữ nguyên 10 bài + 74 sản phẩm (đủ field).
- [ ] CRUD admin hoạt động (thêm/sửa/xóa, validate productCode/vatRate).
- [ ] **Sản phẩm/bài viết MỚI xuất hiện trên `/products`, `/blog` và trang chi tiết.**
- [ ] Nội dung cũ hiển thị y nguyên (ảnh + thuộc tính + tên song ngữ).
- [ ] SEO title/description đúng với fallback.
- [ ] Media upload/serve hoạt động (jpeg/png, ≤2MiB).
