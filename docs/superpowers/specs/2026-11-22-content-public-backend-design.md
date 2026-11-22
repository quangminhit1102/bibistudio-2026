# Thiết kế: Public đọc backend — nội dung mới hiển thị đầy đủ

- Ngày: 2026-11-22
- Trạng thái: chờ duyệt spec
- Phạm vi: nội dung mới (sản phẩm/bài viết) từ admin hiển thị lên public đầy đủ như nội dung cũ; backend là nguồn duy nhất cho public.

## 1. Bối cảnh & vấn đề

- Hiện admin ghi nội dung (posts/products/categories/customers) vào MySQL (schema v8), nhưng site public vẫn đọc **file tĩnh** `src/data/blog.ts` + `catalogue.ts` (lựa chọn "B — lai" trước đó). Hậu quả: **nội dung mới không bao giờ hiện lên public** (đã xác minh: backend có 11 bài, public chỉ hiện 10 bài tĩnh).
- Yêu cầu: sản phẩm/bài viết **mới** phải hiển thị **đầy đủ như nội dung cũ**; dữ liệu cũ phải **giữ nguyên**; **đảm bảo SEO**.

## 2. Quyết định kiến trúc

- **Backend là nguồn duy nhất cho public** (hướng "B full"): public đọc API, không đọc file tĩnh cho nội dung động.
- **Ảnh cũ giữ URL tĩnh**: 74 sản phẩm cũ giữ nguyên đường dẫn ảnh tĩnh trong bundle; chỉ sản phẩm **mới** upload ảnh lên backend (media). Không copy ảnh cũ lên media.
- **Media upload backend** cho ảnh mới (mirror pattern avatar-store đã có).
- SEO giữ nguyên cơ chế client-side (`resolveSeo` + `head`), giờ dùng data từ API; Google render JS nên vẫn đọc được meta.

## 3. Data model — schema v9 (mở rộng v8, thêm cột nullable)

### products (thêm cột)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| name_en | varchar(255) NULL | tên tiếng Anh |
| short_description_en | text NULL | |
| description_en | text NULL | mô tả tiếng Anh (plain text) |
| dimensions | varchar(100) NULL | kích thước |
| pages | varchar(50) NULL | số trang |
| material_vi | varchar(255) NULL | chất liệu vi |
| material_en | varchar(255) NULL | |
| format_vi | varchar(100) NULL | khổ vi |
| format_en | varchar(100) NULL | |
| occasion | varchar(64) NULL | id trong danh sách cố định |
| featured | boolean NOT NULL DEFAULT 0 | |
| sort_order | int NOT NULL DEFAULT 0 | |
| image_alt_vi | varchar(255) NULL | |
| image_alt_en | varchar(255) NULL | |

- `description`/`short_description` giữ nguyên nghĩa là **plain text tiếng Việt** (đổi từ rich-text sang text để khớp public). Dữ liệu cũ giàu nếu có sẽ được chuyển về text khi migrate.
- `image_ids` (JSON) giữ nguyên: chứa **media id** (mới) hoặc **URL tĩnh** (cũ). Public API phân giải media id → `/api/media/:id`, giữ nguyên URL tĩnh.

### posts (thêm cột)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| read_time | varchar(50) NULL | vd "5 phút đọc" |
| cover_image_id | varchar(200) NULL | media id hoặc URL tĩnh |

- `content` giữ `html-v1`. Public render HTML (sanitize) thay cho `ContentBlock[]`; sinh mục lục bằng cách parse thẻ heading.

### media (bảng mới)
| Cột | Kiểu |
|---|---|
| id | varchar(36) PK |
| mime | varchar(64) |
| size | bigint |
| width | int |
| height | int |
| path | varchar(500) (đường dẫn file trên disk) |
| created_at / revision | như các bảng khác |

## 4. Admin form (mở rộng field)

- **Sản phẩm**: thêm `name_en`, `short_description_en`, `description_en` (textarea), `dimensions`, `pages`, `material_vi/en`, `format_vi/en`, `occasion` (select danh sách cố định), `featured` (checkbox), `sort_order` (number), `image_alt_vi/en`. Đổi `description` từ rich-text → textarea (vi) + textarea (en).
- **Bài viết**: thêm `read_time`, `cover_image_id` (ảnh bìa).
- **MediaPicker**: upload lên `POST /api/media` (base64, như avatar) thay vì IndexedDB; trả `media.id`; ảnh xem qua `GET /api/media/:id`.

## 5. Public API + frontend

### API public (đọc, không auth) — trả shape đầy đủ
- `GET /api/public/products` / `/api/public/products/:slug` → `{ slug, name:{vi,en}, description:{vi,en}, short_description, product_type, collection, price, compare_at, images:[url], image_alt:{vi,en}, dimensions, pages, material:{vi,en}, format:{vi,en}, occasion, featured, sort_order, seo_title, seo_description }`.
- `GET /api/public/posts` / `/api/public/posts/:slug` → `{ slug, title, excerpt, category_name, author_name, publish_at, read_time, cover_url, content, seo_title, seo_description }`.
- `GET /api/public/categories?scope=product|content`, `GET /api/public/collections` (danh sách bộ sưu tập, từ dữ liệu + từ vựng cố định).
- `GET /api/media/:id` (serve ảnh; public).

### Frontend
- Các route `index`, `blog.index`, `blog.$slug`, `products.index`, `products.$slug`, `collections.index`, `collections.$slug` đổi loader từ `import "@/data/..."` sang **fetch API** qua `src/lib/content-api.ts` (mở rộng thêm các hàm list + collection).
- Component dùng từ vựng tĩnh (`productTypes`, `occasions`) giữ nguyên (tập đóng). Dữ liệu động (products/posts/categories) đọc từ API.
- Blog detail: render `html-v1` qua sanitize (`sanitize.ts`); mục lục parse heading.
- `head` dùng `resolveSeo` với data API (SEO giữ nguyên + mô tả per-page).

## 6. Migration (giữ y nguyên hiển thị cũ)

- Mở rộng `generate-content-seed.mjs` để xuất đủ field (tên song ngữ, thuộc tính, occasion, featured, sortOrder, ảnh) từ `catalogue.ts`/`blog.ts`.
- `seedContent` insert đủ field; ảnh cũ = URL tĩnh nguyên bản.
- Sau migrate, public đọc API và hiển thị y hệt dữ liệu tĩnh cũ.

## 7. Validation & phân quyền

- Tái dùng `validation.ts`/`permissions.ts`: slug/product_code unique, FK hợp lệ, không xoá mục tham chiếu.
- Ghi public không cần auth; ghi admin qua RBAC hiện tại. Media upload cần `product.create`/`post.create`.

## 8. Phi mục tiêu (follow-up)

- Tồn kho + Sales/phiếu giao hàng migrate lên backend (vẫn local).
- Bookstore module (demo riêng).
- SSR full / server-side meta (giữ client-side — Google render JS).

## 9. Rủi ro & lưu ý

1. **Ảnh cũ giữ URL tĩnh** → sản phẩm cũ ổn; sản phẩm mới cần upload ảnh lên media thì mới có ảnh (nếu không có ảnh → placeholder).
2. **Mô tả đổi rich→plain**: dữ liệu cũ giàu (nếu có) được flatten khi migrate.
3. **Render HTML (blog)**: cần sanitize kỹ; mục lục parse heading có thể đơn giản hoá.
4. **Schema v9** thêm cột nullable → không phá v8; migration thêm bảng media + cột mới.
