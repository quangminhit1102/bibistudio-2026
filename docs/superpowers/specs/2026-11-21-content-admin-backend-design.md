# Thiết kế: Backend cho nội dung + chỉnh sửa form admin

- Ngày: 2026-11-21
- Trạng thái: chờ duyệt spec
- Phạm vi: posts, products, danh mục (product_categories), chuyên mục (content_categories), customers + form bài viết/sản phẩm + SEO public

## 1. Bối cảnh & vấn đề

- Site public đọc dữ liệu **tĩnh** từ `src/data/blog.ts` và `src/data/catalogue.ts`; admin ghi vào **store local trình duyệt** (seed từ các file đó). Vì vậy mọi sửa đổi trong admin hiện **không ảnh hưởng website thật**.
- Backend (Node/Express + MySQL trên cPanel/Passenger) hiện chỉ chứa `users/roles/audit/visitors/sessions`. Các entity nội dung (posts/products/categories/tags/customers) chưa có trên backend.
- SEO (`seoTitle`/`seoDescription`) đã có trong model admin nhưng **chưa được render ra head public** (blog hiện chỉ dùng `title` + `excerpt`).
- Form thêm/sửa bài viết, sản phẩm dùng cột `aside` cố định 250–290px → phần "Thông tin bài viết" / "Phân loại & hiển thị" bị hẹp khi thu nhỏ.

## 2. Quyết định kiến trúc

- **Backend là nguồn dữ liệu duy nhất** (không phải file tĩnh): admin CRUD ghi MySQL; site public đọc qua API.
- **Giữ toàn bộ bài viết/sản phẩm cũ**: migration một lần đưa dữ liệu tĩnh vào MySQL.
- **2 bảng phân loại riêng** `product_categories` (Danh mục) và `content_categories` (Chuyên mục) — đơn giản, tách bạch, không dùng cột phân biệt `kind`.
- `product_code` (mã sản phẩm) là **string chữ số, unique**.
- `vat_rate` **editable**, mặc định `8.00`.
- Media (ảnh) **giữ nguyên như hiện tại** (ảnh tĩnh trong bundle / media local admin), chỉ chuyển dữ liệu văn bản + quan hệ lên DB. (Xem §9.)

## 3. Model dữ liệu — schema v8

Bảng chung mọi bảng: `id` UUID PK, `created_at`, `updated_at`, `revision` (optimistic concurrency).

### product_categories (Danh mục sản phẩm)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| name | varchar(191) | |
| slug | varchar(191) | UNIQUE |
| description | text NULL | |
| parent_id | uuid NULL | FK → product_categories, ON DELETE RESTRICT |
| position | int | |
| active | boolean | |

Index: `slug` (unique), `parent_id`, `active`.

### content_categories (Chuyên mục bài viết)
Cùng cấu trúc như `product_categories` (FK tự trỏ, RESTRICT).

### posts
| Cột | Kiểu | Ghi chú |
|---|---|---|
| slug | varchar(191) | UNIQUE |
| title | varchar(255) | |
| excerpt | text | |
| content | longtext | TinyMCE HTML (định dạng admin hiện tại) |
| category_id | uuid | FK → content_categories, RESTRICT |
| author_id | uuid | FK → users |
| status | varchar(16) | `draft` \| `published` |
| publish_at | datetime NULL | mặc định = thời điểm tạo |
| image_id | varchar(64) NULL | tham chiếu media (xem §9) |
| seo_title | varchar(100) | |
| seo_description | varchar(320) | |

Index: `slug` (unique), `category_id`, `author_id`, `(status, publish_at)`.

### products
| Cột | Kiểu | Ghi chú |
|---|---|---|
| product_code | varchar(64) | UNIQUE (string chữ số) |
| name | varchar(255) | |
| slug | varchar(191) | UNIQUE |
| short_description | text | |
| description | longtext | TinyMCE HTML |
| product_type | varchar(50) | từ vựng đóng, validate app |
| collection | varchar(50) | từ vựng đóng, validate app |
| category_id | uuid | FK → product_categories, RESTRICT |
| price | bigint | VND |
| compare_at | bigint | VND |
| stock | int | chỉ quản lý ở trang Tồn kho (không còn trong form) |
| reserved | int | |
| status | varchar(16) | `draft` \| `published` \| `hidden` |
| image_ids | json | |
| tags | json | mảng string tự do (không phải entity `tags`) |
| seo_title | varchar(100) | |
| seo_description | varchar(320) | |

Index: `product_code` (unique), `slug` (unique), `category_id`, `(status, product_type, collection)`.

### customers
| Cột | Kiểu | Ghi chú |
|---|---|---|
| name | varchar(255) | |
| kind | varchar(16) | `bookstore` \| `individual` \| `company` |
| address | text | |
| phone | varchar(50) | |
| email | varchar(255) | |
| vat_rate | decimal(5,2) | default 8.00, editable |
| notes | text | |
| active | boolean | |

Index: `kind`, `active`.

### Bảng bị loại bỏ
- `tags` (thẻ bài viết): **bỏ hẳn**. Thẻ sản phẩm vẫn là cột `tags` (json) trên products.

## 4. Migration — giữ bài viết cũ

Migration một lần (chạy ở backend, idempotent) tại schema v8:

- Đọc `src/data/blog.ts` (10 bài) → insert vào `posts` với `status=published`, `publish_at = date`, `author_id = user hệ thống "BiBi Studio"`, `category_id` → tạo/ánh xạ `content_categories` theo `category` (tên), `content` = **tái dùng converter `ContentBlock[] → TinyMCE HTML`** (giống `content/seed.ts`).
- Đọc `src/data/catalogue.ts` (sản phẩm + collections) → insert vào `products` (ánh xạ `productType`/`collection`/`categoryId` như seed hiện có) và `product_categories`.
- `seo_title`/`seo_description` để trống (fallback hoạt động tự nhiên).
- Chỉ chạy khi bảng trống (không ghi đè dữ liệu đã có).

## 5. API public + SEO

### Endpoint đọc public (không cần đăng nhập)
- `GET /api/public/posts?page=&category=` → danh sách bài viết `published` (phân trang).
- `GET /api/public/posts/:slug` → chi tiết bài viết.
- `GET /api/public/products?type=&collection=&category=` → danh sách sản phẩm `published`.
- `GET /api/public/products/:slug` → chi tiết sản phẩm.
- `GET /api/public/categories?scope=product|content` → danh mục/chuyên mục (cây).

### Loader public
Các route `index.tsx`, `blog.index.tsx`, `blog.$slug.tsx`, `products.index.tsx`, `products.$slug.tsx`, `collections.*.tsx` chuyển từ `import "@/data/blog|/catalogue"` sang **fetch API**.

### SEO (fallback + crawler)
- `title = seo_title || title`; `description = seo_description || (post: excerpt / product: short_description)`.
- **Meta server-side**: Express chèn sẵn `<title>`, `<meta name="description">`, OG/Twitter, JSON-LD vào `index.html` khi phục vụ route public (tra DB theo path) để crawler đọc được mà không cần chạy JS. Client SPA vẫn fetch JSON để render.

## 6. Thay đổi giao diện admin

### Bố cục (fix hẹp)
- Bỏ cột `aside` cố định 250–290px. Đưa khối "Thông tin bài viết" (post) / "Phân loại & hiển thị" (product) thành **card full-width** ngay dưới tiêu đề, các trường xếp **grid responsive** (3 → 2 → 1 cột).
- Ảnh bìa/ảnh sản phẩm, nội dung, "Thông tin nội bộ", "Thiết lập SEO" chạy thành một cột. Áp dụng chung cho cả trang thêm và sửa (cùng `ComposeForm`).

### Form bài viết
- Bỏ trường **Tác giả** → `author_id` tự lấy account đang đăng nhập khi lưu (list/detail vẫn hiển thị tên).
- **Ngày xuất bản** mặc định = hôm nay (vẫn sửa được).
- **Thẻ bài viết**: bỏ.
- **SEO**: giữ 2 field + ghi chú "để trống → dùng tiêu đề/tóm tắt".

### Form sản phẩm
- `sku` → **Mã sản phẩm** (`productCode`).
- **Gỡ `stock` khỏi form** (chỉ còn `price`, `compareAt`; tồn kho quản lý ở trang Tồn kho).
- **SEO** fallback: `seo_description ← short_description`.

### Danh mục / Chuyên mục / Khách mua hàng
- Giữ CRUD hiện có (danh sách + modal), chuyển lưu trữ → backend API.
- `vat_rate` editable, mặc định 8.

## 7. Validation & phân quyền

- Tái dùng `validation.ts` + `permissions.ts` hiện có: slug/product_code unique, FK hợp lệ, không xoá mục đang tham chiếu (FK RESTRICT + `assertDeletable`).
- Ghi đọc public không cần auth; ghi admin vẫn qua RBAC hiện tại.

## 8. Phi mục tiêu (follow-up riêng)

- Media/ảnh thực (upload + lưu backend) — hiện vẫn local/static.
- Trang Tồn kho + Sales/Phiếu giao hàng chưa migrate lên backend (vẫn local).
- Bookstore module (demo riêng).
- Real-time/SSR full (chỉ chèn meta server-side).

## 9. Rủi ro & câu hỏi mở

1. **Ảnh media**: `image_id`/`image_ids` chỉ là tham chiếu; ảnh thực còn ở local/static → đổi máy có thể mất ảnh admin. Chấp nhận ở v1, làm sau.
2. **Tồn kho/sales tách rời**: `stock`/`reserved` ở bảng products nhưng trang Tồn kho & phiếu còn local → tạm thời hai nguồn; phải thống nhất ở follow-up.
3. **Render content HTML ở public**: public hiện render `ContentBlock[]`; sau khi chuyển backend, bài viết trả về HTML → cần renderer HTML an toàn (tái dùng `sanitize.ts`). Chi tiết ở plan.
4. **SEO server-side** là phần nhạy nhất (Express phục vụ `index.html` + chèn meta); cần kiểm thử kỹ với crawler.
