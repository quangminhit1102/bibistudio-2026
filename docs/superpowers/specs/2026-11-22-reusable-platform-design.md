# Thiết kế: biến bibistudio-2026 thành nền tảng dùng lại cho nhiều website

- Ngày: 2026-11-22
- Trạng thái: đã duyệt (2026-11-22)
- Nền: `main` tại `ae36409`
- Phạm vi: toàn repo (frontend công khai, admin, backend, `ops`, CI/CD), chia 5 giai đoạn, mỗi giai đoạn một PR.

## 1. Mục đích

Chủ repo muốn source này là nền móng cho các website sau BiBi Studio, không chỉ là sản phẩm riêng của BiBi. Lời của chủ repo: tách module, dễ mở rộng, dễ bảo trì, hiệu năng tốt, tách bạch trách nhiệm; bỏ logic kinh doanh ghi cứng; dựng site mới với rất ít chỉnh sửa; gọn, không thừa.

Hai quyết định chủ repo đã chốt:

1. **Loại site tiếp theo:** cùng loại với BiBi (catalogue thương hiệu, blog, admin), khác thương hiệu. Mỗi thương hiệu là một bản cài riêng (repo, DB, hosting riêng).
2. **Cách tổ chức mã:** mọi thứ riêng của một thương hiệu nằm trong thư mục `site/` của repo. Site mới tạo từ repo này (repo mẫu) rồi thay `site/`.

## 2. Hiện trạng (đã kiểm bằng đọc code)

**Đã dùng lại được:**
- Backend (`backend/src`, khoảng 12.300 dòng) chia module: `auth`, `accounts`, `roles`, `authorization`, `audit`, `visitors`, `access-logs`, `content`, `profile`. Cấu hình đọc từ biến môi trường (`backend/src/config.ts`).
- Bộ deploy (`ops/`) chạy theo `deploy-config.json` của từng site (đường dẫn, URL).
- Giao diện dùng CSS token (`src/styles.css`, khối `:root`).

**Đang ghi cứng cho BiBi:**

| Nhóm | Ở đâu | Ví dụ |
|---|---|---|
| Thương hiệu, liên hệ | 283 dòng code không tính test | Số điện thoại ở `src/data/contact.ts`, `src/components/floating-contact.tsx`, `src/features/admin/sales/print-draft.ts`, `src/features/admin/shared/forms/editor-preview.tsx` |
| Domain | `src/lib/seo.ts:4`, `src/routes/blog.$slug.tsx:13` (domain Lovable), `src/features/admin/analytics/components/visitor-session-list.tsx:18`, `.github/workflows/production.yml:48` | |
| Danh mục | `src/data/catalogue.ts` | `ProductTypeId`, `CollectionId`, `OccasionId` là kiểu cố định; admin lặp lại danh sách ở `src/features/admin/products/config.tsx` |
| Logic theo danh mục | `src/lib/content-adapter.ts:17-23`, `src/routes/collections.$slug.tsx:154` | Loại lạ bị đổi thành `notebook`; nhóm theo dịp chỉ bật khi `c.id === "greeting-cards"` |
| Thuộc tính sản phẩm | `backend/content-migrations/002_content_v9.sql` | Cột `pages`, `material_vi/en`, `format_vi/en`, `dimensions`, `occasion` |
| Nội dung trang | `src/routes/index.tsx` (399 dòng), `about.tsx` (197), `contact.tsx` (117) | Văn bản tiếng Việt viết thẳng trong JSX |
| Dữ liệu mẫu trong bundle | `src/data/catalogue.ts`, `src/data/blog.ts` | Trang công khai lấy dữ liệu này khi API lỗi hoặc trả 404 |
| Build, deploy | `vite.cpanel.config.ts` (`/~vhplasti`), `scripts/cpanel-deploy-artifacts.mjs` (tên file logo, `/home/vhplasti/...`), `cpanel.html` (tiêu đề, font) | |
| Admin | `src/features/admin/shell/navigation.ts` | Menu cố định; phiếu bán hàng, tồn kho, cài đặt, thông báo chỉ lưu trong trình duyệt (`src/features/admin/demo`) |

Dữ liệu trong DB production hiện có 74 sản phẩm và 10 bài viết, bằng đúng số trong `src/data/content-seed.generated.json`.

## 3. Mục tiêu, ngoài phạm vi, điều phải tránh

**Mục tiêu (kiểm được):**
1. Dựng site mới không sửa file nào ngoài `site/`, biến môi trường và `deploy-config.json`.
2. Một test tự động chặn tên thương hiệu, domain, số điện thoại của site xuất hiện ngoài `site/`.
3. CI build và chạy test với một bộ site trống (`tests/fixtures/site-blank`) để chứng minh lõi không phụ thuộc BiBi.
4. Website BiBi production hiển thị và hoạt động như hiện tại sau mỗi giai đoạn, trừ các thay đổi nêu rõ ở mục 9.
5. Toàn bộ test hiện có (689 test và 5 bộ trình duyệt) vẫn đạt; ngưỡng bundle admin không vượt.

**Ngoài phạm vi (quyết định của người viết, chủ repo có thể đổi):**
- Một hệ thống chạy nhiều site (multi-tenant) và hệ module cho loại hình kinh doanh khác.
- Trình dựng trang hoặc sửa giao diện trong admin.
- Dịch giao diện admin sang ngôn ngữ khác. Admin giữ tiếng Việt.
- Đưa phiếu bán hàng, tồn kho, cài đặt, thông báo lên server.
- Đổi tên định danh kỹ thuật nội bộ: tiền tố biến môi trường `BIBI_`, cookie `bibi_refresh`/`bibi_visitor`, header `X-Bibi-Request`, đường dẫn `_bibi`, giá trị mặc định JWT. Chúng không hiện ra với người dùng, đổi tên đụng tới receiver, cron và phiên đăng nhập trên production. Coi `bibi` là tên mã của nền tảng.
- SSR hoặc dựng sẵn HTML.

**Điều phải tránh:**
- Website BiBi thay đổi mà chủ repo không được báo trước.
- Lớp trừu tượng chỉ có một nơi dùng, ngoài ranh giới lõi/site.
- Làm hỏng đồng bộ Lovable (xem mục 4).

## 4. Ràng buộc

- **Lovable:** không viết lại lịch sử Git; nhánh nối với Lovable phải luôn build được; giữ `vite.config.ts`, `src/routes/`, `src/main.tsx` ở vị trí hiện tại.
- **Hai bản build:** Lovable (`vite.config.ts`, TanStack Start) và cPanel (`vite.cpanel.config.ts`, CSR). Cả hai phải đọc được `site/`.
- **Deploy:** production không build lại, chỉ nhận artifact của CI; receiver chỉ có `check|upload|deploy|rollback`.
- **Migration:** rollback ứng dụng không hoàn tác migration. Mọi thay đổi schema phải theo kiểu mở rộng trước, thu hẹp sau: bản mới thêm cột/bảng và vẫn giữ cột cũ, để bản cũ chạy được trên schema mới.
- **Bộ kiểm schema nội dung:** `backend/src/content/schema.ts` khóa danh sách file migration và dấu vân tay DDL; thêm phiên bản 3 phải mở rộng bộ kiểm này cùng test của nó.
- **Hosting:** cPanel/Passenger, Node 24, MariaDB.

## 5. Các cách đã cân nhắc

| Cách | Mô tả | Đổi lại |
|---|---|---|
| **1. Thư mục `site/` + repo mẫu (đã chọn)** | Phần riêng nằm trong `site/`; site mới tạo repo từ repo này | Mỗi site là bản sao; nhận bản sửa của lõi bằng merge từ repo gốc |
| 2. Một repo nhiều site (`sites/<tên>`) | Lõi một bản, mọi site cùng hưởng | Viết lại CI/CD cho nhiều site; Lovable chỉ gắn được một site |
| 3. Sửa hết trong admin | Thương hiệu, giao diện, nội dung trang lưu DB | Phải xây trình dựng trang; trang thiết kế riêng khó giữ chất lượng |

Chủ repo chọn cách 1 vì nhỏ nhất mà đạt mục tiêu, giữ được Lovable và CI/CD. Bộ site trống ở mục tiêu 3 đọc `site/` qua biến `SITE_DIR`, nên sau này chuyển sang cách 2 chỉ cần thêm thư mục.

## 6. Kiến trúc đích

```
site/                     phần riêng của một thương hiệu (BiBi)
  site.config.ts          tên, domain, liên hệ, SEO, menu, ngôn ngữ, module admin bật
  catalogue.config.ts     thuộc tính sản phẩm, cách nhóm trong bộ sưu tập
  theme.css               token màu, font
  messages/vi.ts          chữ giao diện trang công khai
  pages/                  home.tsx, about.tsx, contact.tsx
  assets/  public/        logo, favicon, ảnh
  seed/                   dữ liệu mẫu để nạp DB lần đầu
src/platform/             hợp đồng giữa lõi và site
  site-contract.ts        kiểu SiteConfig, CatalogueConfig, SitePages
  site.ts                 nơi duy nhất import từ `@site/*`
src/ (còn lại)            lõi công khai và admin
backend/  ops/  scripts/  lõi server, deploy, công cụ
```

**Quy tắc ranh giới:**
- Lõi chỉ đọc site qua `src/platform/site.ts`. Không file lõi nào khác import `@site/*`.
- `site/` được import các thành phần dựng trang của lõi (`src/components/**`, `src/lib/**`), không import `src/features/admin/**` hay `backend/**`.
- Backend không đọc `site/`. Thứ backend cần (origin, tên DB) tiếp tục đến từ biến môi trường. Dữ liệu mẫu đi vào DB qua lệnh seed.
- `@site` là alias trong `tsconfig.json` và hai file cấu hình Vite, trỏ tới `SITE_DIR` (mặc định `site`).

**`SiteConfig` (tối thiểu):**
```ts
type Localized = Record<string, string>; // khóa là mã ngôn ngữ
type SiteConfig = {
  name: string; shortName: string; url: string;
  locales: string[]; defaultLocale: string;
  contact: { phone: string; phoneDisplay: string; email: string; address?: string;
             social: { id: string; label: string; href: string }[] };
  seo: { titleSuffix: string; description: string; ogImage?: string };
  navigation: { header: NavItem[]; footer: NavItem[] };
  fonts: { href: string }[];
  admin: { title: string; modules: string[] };
};
```

## 7. Năm giai đoạn

Mỗi giai đoạn là một PR độc lập, merge xong site BiBi vẫn chạy.

### Giai đoạn 1: cấu hình site, giao diện, chuỗi thương hiệu
- Tạo `site/site.config.ts`, `site/theme.css`, `site/assets`, `src/platform/*`, alias `@site`.
- Chuyển `src/data/contact.ts`, khối `:root` và font trong `src/styles.css`, logo vào `site/`.
- `cpanel.html`: tiêu đề, mô tả, font, `lang` sinh từ cấu hình bằng một plugin Vite nhỏ.
- Thay mọi chuỗi thương hiệu, domain, liên hệ trong lõi (trang công khai, admin, bản in phiếu) bằng giá trị cấu hình. `SITE_URL` lấy từ `site.url`, nên SEO canonical trỏ đúng `bibistudio.vn` (mục bảo mật S7).
- Thêm test ranh giới (mục 8) ở chế độ chỉ kiểm các file đã chuyển.

### Giai đoạn 2: danh mục và thuộc tính sản phẩm từ dữ liệu
> Cập nhật 2026-11-23: giai đoạn này tách thành hai PR. Bản đang chạy và deploy tools trên host chỉ chấp nhận đúng hai phiên bản migration nội dung, nên migration phiên bản 3 không thể lên và rollback trong một release. PR 2a (`docs/superpowers/plans/2026-11-23-reusable-platform-phase2a.md`) không đổi DB: cho backend và deploy tools chấp nhận schema mới hơn một bước, thêm `site/catalogue.config.ts`, bỏ `asType`/`asCollection` và nhánh `greeting-cards`. PR 2b làm phần còn lại bên dưới, sau khi 2a đã lên production và deploy tools đã bootstrap lại.

- Bộ sưu tập đã có sẵn trong DB: bảng `product_categories` trên production chứa đúng 7 bộ sưu tập (nạp từ seed), có trang quản lý trong admin và `GET /api/public/collections`. Dùng lại bảng này, không tạo bảng danh mục chung mới.
- Migration nội dung phiên bản 3:
  - Bảng `product_types`, cùng cấu trúc với `product_categories` (không có `parent_id`).
  - Thêm vào cả hai bảng: `translations` JSON dạng `{ "<ngôn ngữ>": { name, plural?, tagline?, intro? } }` và `image` (đường dẫn công khai hoặc mã media).
  - Cột `products.attributes` JSON.
  - Nạp `product_types` và `translations`, `image` từ danh sách hiện có trong `src/data/catalogue.ts`; chép `dimensions`, `pages`, `material_*`, `format_*`, `occasion` vào `attributes`.
  - Giữ nguyên các cột cũ. Bản này ghi cả cột cũ lẫn `attributes`; một bản sau mới bỏ cột cũ.
- `products.product_type` và `products.collection` giữ kiểu chuỗi, backend kiểm giá trị phải là slug đang có trong `product_types` và `product_categories`. Việc gộp `products.collection` với `products.category_id` (hai trường cùng nghĩa) không nằm trong đợt này.
- API: `GET /api/public/product-types`, mở rộng `GET /api/public/collections` (thêm `translations`, `image`); CRUD loại sản phẩm cho admin theo quyền của module sản phẩm, dùng lại trang quản lý danh mục hiện có.
- `site/catalogue.config.ts` khai báo thuộc tính (`key`, nhãn, kiểu `text | localized-text | select`; lựa chọn của `select` gồm `value`, nhãn, ghi chú) và cách nhóm: `groupBy: { "greeting-cards": "occasion" }`. BiBi khai báo `dimensions`, `pages`, `material`, `format`, `occasion`.
- Trang công khai và form admin đọc loại sản phẩm, bộ sưu tập từ API, đọc thuộc tính từ cấu hình. Bỏ `asType`/`asCollection` và nhánh `greeting-cards`. `/products/$slug` tra slug trong danh sách loại lấy từ API (có cache) trước khi coi là sản phẩm.
- Loại sản phẩm lạ: hiện nhãn là chính slug, không đổi sang loại khác.

### Giai đoạn 3: nội dung trang, chữ giao diện, dữ liệu mẫu
- Thân trang chủ, giới thiệu, liên hệ chuyển thành `site/pages/*.tsx`. Route trong `src/routes/` chỉ còn loader, thẻ head và gọi trang của site.
- Chữ giao diện trong thành phần lõi công khai (header, footer, tìm kiếm, thẻ sản phẩm, phân trang) chuyển vào `site/messages/vi.ts` qua hàm `t()`. Không thêm thư viện i18n.
- `src/data/catalogue.ts`, `src/data/blog.ts`, ảnh `src/assets/blog`, `public/catalogue` chuyển vào `site/seed` và `site/public`. Chúng chỉ dùng để nạp DB.
- **Điều kiện trước khi bỏ dữ liệu tĩnh (đã xác nhận trên production):** 74 sản phẩm nạp từ seed có mã ảnh dạng `catalogue-image-<slug>-N`. API trả `/api/media/catalogue-image-...`, và URL này trả HTTP 400. Ảnh hiện ra được là nhờ `toPublicProduct` (`src/lib/content-adapter.ts`) lấy ảnh từ dữ liệu tĩnh khi trùng slug. Vì vậy phải sửa `image_ids` của các sản phẩm này thành đường dẫn công khai `/catalogue/...` (API đã trả nguyên giá trị bắt đầu bằng `/`) bằng một bước migration dữ liệu, kiểm mọi URL ảnh trả 200, rồi mới bỏ dữ liệu tĩnh.
- Kiểm tương tự cho ảnh bìa của 10 bài viết (bài tĩnh dùng ảnh đóng gói trong `src/assets/blog`); bài nào API chưa có ảnh dùng được thì sửa dữ liệu trước.
- Bỏ việc lấy dữ liệu tĩnh khi API lỗi hoặc 404 (mục bảo mật S4): 404 hiện trang không tìm thấy, lỗi mạng hiện trang lỗi có nút thử lại. Trước khi bỏ, một script so slug tĩnh với DB production và dừng nếu thiếu.
- Đưa 94 ảnh không dùng trong `public/Images` ra khỏi repo đang build (đề xuất tối ưu O1).

### Giai đoạn 4: module admin
- Mỗi tính năng admin (`content`, `products`, `customers`, `sales`, `analytics`, `accounts`, `audit`, `settings`) xuất một bản khai: `id`, mục menu, quyền cần có. `navigation.ts` dựng menu từ các bản khai có trong `site.admin.modules`.
- Route của module bị tắt chuyển về bảng điều khiển trong `beforeLoad`.
- Module chỉ lưu trong trình duyệt (`sales`, tồn kho, thông báo, cài đặt) mặc định tắt cho site mới, BiBi vẫn bật.
- Xóa 22 file không còn nơi nào import và 2 thư viện không dùng (đề xuất tối ưu O5).

### Giai đoạn 5: deploy, CI, bộ tạo site mới
- `production.yml`: `BASE_URL` lấy từ biến repo `PRODUCTION_BASE_URL`. Cần [PR #1](https://github.com/quangminhit1102/bibistudio-2026/pull/1) merge trước.
- `scripts/cpanel-deploy-artifacts.mjs`, `vite.cpanel.config.ts`: danh sách file và đường dẫn tạm lấy từ `site/`.
- `tests/fixtures/site-blank`: bộ site tối thiểu. CI thêm một job build và chạy test admin với `SITE_DIR=tests/fixtures/site-blank`.
- Test ranh giới chuyển sang chế độ toàn repo.
- `docs/new-site.md`: các bước tạo site mới, cách nhận bản sửa của lõi từ repo gốc.
- Cập nhật `docs/build-and-deploy.md`, `AGENTS.md`, file kiến trúc.

## 8. Kiểm thử

- **Test ranh giới** (`scripts/site-boundary.test.mjs`): đọc `site.config.ts`, lấy tên, domain, điện thoại, email; thất bại nếu chúng xuất hiện ngoài `site/`, `docs/`, `tests/`, `README.md`, và danh sách định danh nội bộ được phép (mục 3). Cũng thất bại nếu file ngoài `src/platform/site.ts` import `@site/*`.
- **Bộ site trống** build và chạy test admin trong CI.
- **Không đổi hiển thị:** trước và sau mỗi giai đoạn, chụp trang chủ, giới thiệu, liên hệ, danh sách và chi tiết sản phẩm, blog ở hai cỡ màn hình rồi so ảnh. Khác biệt phải giải thích được trong PR.
- **Migration phiên bản 3:** test trên MariaDB thật (như các migration hiện có): chạy lên từ phiên bản 2 có dữ liệu, chạy lại không đổi gì, và bản backend cũ vẫn đọc ghi được trên schema mới.
- `npm run check` và `npm run build` đạt ở mỗi PR.

## 9. Thay đổi hành vi trên production (cần chủ repo biết)

| Giai đoạn | Thay đổi |
|---|---|
| 1 | Thẻ canonical và URL trong dữ liệu SEO đổi từ domain Lovable sang `bibistudio.vn` |
| 2 | Migration phiên bản 3 chạy khi deploy; thêm bảng và cột, không xóa gì. Sản phẩm có loại lạ hiện đúng slug thay vì bị đổi thành sổ tay |
| 3 | `image_ids` của 74 sản phẩm seed được sửa trong DB. Khi API lỗi, trang công khai hiện trang lỗi thay vì dữ liệu mẫu; `/Images/*` trừ ảnh đang dùng trả 404 |
| 4 | Không có, nếu BiBi bật đủ module như hiện nay |
| 5 | Phải đặt biến repo `PRODUCTION_BASE_URL` trước khi merge |

## 10. Liên quan tới việc đang chờ

- [PR #1](https://github.com/quangminhit1102/bibistudio-2026/pull/1) (CI/CD): độc lập với giai đoạn 1–4; giai đoạn 5 cần nó merge trước.
- Danh sách bảo mật: S7 nằm trong giai đoạn 1, S4 trong giai đoạn 3. S1, S2, S3, S5, S6, S8, D1, D2 vẫn là PR riêng, chờ duyệt.
- Đề xuất tối ưu: O1 nằm trong giai đoạn 3, O5 trong giai đoạn 4. O2, O3, O4, O6, O7 vẫn là PR riêng, chờ chọn.

## 11. Để người thực hiện quyết

- Tên trường cụ thể trong `SiteConfig` ngoài phần tối thiểu ở mục 6.
- `site/public` dùng `publicDir` của Vite hay giữ `public/` ở gốc và coi nó thuộc về site, tùy bản build Lovable chạy được với cách nào.
- Cách chia commit trong từng giai đoạn.
