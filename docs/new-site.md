# Tạo một site mới từ nền tảng này

Một site là một repo riêng: bản sao của repo này, trong đó thư mục `site/` được thay bằng nội dung của thương hiệu mới. Phần lõi (`src/`, `backend/`, `ops/`, `scripts/`) giữ nguyên và nhận bản sửa từ repo gốc bằng `git merge`.

Trạng thái: các bước 1 đến 3 đã kiểm chứng trên máy phát triển (tạo site từ bộ site trống, `node scripts/check.mjs static`, `node scripts/check.mjs admin`, build cPanel); các lệnh merge ở bước 4 đã thử trên một cặp repo mẫu nhỏ, chưa thử với một repo site thật. Chưa có site thứ hai nào được deploy lên hosting; xem mục "Chưa tách" trước khi lên kế hoạch.

## 1. Tạo repo và thư mục `site/`

```bash
git clone <repo gốc> ten-site-moi
cd ten-site-moi
git remote rename origin platform      # repo gốc, để nhận bản sửa của lõi
git remote add origin <repo của site mới>
npm ci

git rm -r -q site                       # bỏ nội dung của site cũ
node scripts/new-site.mjs               # tạo site/ từ bộ site trống
```

`node scripts/new-site.mjs` chép `tests/fixtures/site-blank` vào `site/` và sửa các đường dẫn tương đối tới `src/platform`. Lệnh từ chối chạy khi `site/` còn tồn tại.

## 2. Điền nội dung của site

| File                         | Nội dung                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `site/site.config.ts`        | Tên, domain (`https://`, không có đường dẫn), ngôn ngữ, liên hệ, SEO, font, tên admin và các module admin |
| `site/catalogue.config.ts`   | Thuộc tính sản phẩm, cách nhóm sản phẩm trong một bộ sưu tập, phần riêng của trang từng bộ sưu tập        |
| `site/customers.config.ts`   | `extraFields`: các trường mở rộng của khách hàng dùng chung cho form, chi tiết, file mẫu và import Excel  |
| `site/messages/vi.ts`        | Mọi chữ của giao diện công khai. Thiếu một khóa thì kiểm tra kiểu và build đều báo tên khóa               |
| `site/pages/home.tsx`        | Thân trang chủ (nhận `products`), `about.tsx` và `contact.tsx` tương tự                                   |
| `site/theme.css`             | Màu, bo góc và font                                                                                       |
| `site/assets/brand-logo.tsx` | `BrandMark` và `BrandLogo`                                                                                |
| `site/tests/`                | Tuỳ chọn: test Vitest cho riêng site, chạy cùng `node scripts/check.mjs admin`                            |

Module admin: liệt kê trong `admin.modules` những gì site cần. Các mã hợp lệ là `content`, `products`, `inventory` (cần `products`), `customers`, `sales`, `analytics`, `accounts`, `audit`, `notifications`, `settings`, `components`. Module không được liệt kê thì mất khỏi menu và đường dẫn của nó chuyển về bảng điều khiển; API phía server của module đó vẫn chạy.

Tên, tên ngắn, domain, số điện thoại và email của site không được trùng một từ thông dụng có trong mã lõi (ví dụ tên ngắn "Example"): test ranh giới sẽ coi mọi chỗ xuất hiện từ đó là giá trị của site bị viết cứng.

Loại sản phẩm và bộ sưu tập không khai trong code: thêm trong admin (`/admin/products/types`, `/admin/products/categories`).

Trường khách hàng cố định nằm trong lõi; trường riêng của site khai trong `site/customers.config.ts`, đọc qua `src/platform/site.ts`. Site trống có sẵn file này với `extraFields: []`. Ví dụ:

```ts
import { defineCustomers } from "../src/platform/site-contract";

export default defineCustomers({
  extraFields: [
    {
      key: "customerCode",
      label: "Mã khách",
      type: "text",
      importHeaders: ["Mã KH"],
    },
  ],
});
```

Mỗi trường có `key` ổn định, `label`, `type` là `text`, `number` hoặc `boolean`; `importHeaders` là danh sách tiêu đề Excel thay thế, không bắt buộc. Giá trị lưu dưới khóa tương ứng trong `customers.extra`, không cần thêm cột SQL. Tối đa 30 khóa, mỗi giá trị chuỗi tối đa 500 ký tự. Form, chi tiết, file mẫu và parser import lấy các trường cố định cộng trường site qua `src/features/admin/customers/fields.ts`; không sửa lõi để thêm trường. Giữ các key đã dùng khi cập nhật site để dữ liệu cũ tiếp tục được hiển thị đúng.

Riêng import, địa chỉ tối đa 1 KiB, ghi chú tối đa 2 KiB và tổng `extra` tối đa 2 KiB, tính theo JSON UTF-8 đã serialize (kể cả escape). Các trường tên, đại diện, điện thoại và email vẫn có giới hạn ký tự tương ứng cột SQL, cộng ngân sách byte riêng trong `backend/src/content/customer-import.ts`. Tổng ngân sách từng trường và phần envelope cho 1.000 dòng cho ra giới hạn request 7.861.064 byte (dưới 8 MB); client kiểm tra trước khi gửi. File Excel vẫn tối đa 2 MB. Các giới hạn import không thay đổi CRUD khách hàng hoặc dữ liệu `extra` cũ được giữ lại khi cập nhật.

## 3. Kiểm tra và build

```bash
node scripts/check.mjs static           # kiểu, lint, ảnh catalogue
node scripts/check.mjs admin            # test admin và test của site
npm run dev                             # xem site ở http://localhost:5173
npm run build                           # đóng gói bản phát hành
```

`npm run check` chạy mọi giai đoạn, gồm cả backend và trình duyệt (cần Docker). Cách chuẩn bị DB local, biến môi trường và deploy: [build-and-deploy.md](build-and-deploy.md).

## 4. Nhận bản sửa của lõi từ repo gốc

Commit mọi thay đổi trước (kể cả file mới trong `site/`), rồi:

```bash
git fetch platform
git merge --no-commit platform/main

# Giữ nguyên site/ của bạn, bỏ mọi thay đổi repo gốc làm trong site/ của nó:
git reset -q HEAD -- site
git checkout -- site
git clean -fdq -- site

node scripts/check.mjs static && node scripts/check.mjs admin
git commit
```

- `git merge` có thể báo xung đột trong `site/`; ba lệnh ngay sau đó giải quyết hết các xung đột ấy bằng bản của bạn. Xung đột ngoài `site/` nghĩa là repo của site đã sửa lõi: sửa tay như một lần merge thường.
- `git clean` xoá file chưa commit trong `site/`, nên phải commit trước khi bắt đầu.
- Lõi thêm một khóa chữ mới hoặc một file bắt buộc: bước kiểm tra báo tên khóa hoặc đường dẫn bị thiếu; thêm vào `site/` rồi mới `git commit`.
- Không sửa lõi trong repo của site. Cần đổi lõi thì sửa ở repo gốc rồi merge về, nếu không các lần merge sau sẽ xung đột.

## Bộ site trống và job `blank-site`

`tests/fixtures/site-blank` là site nhỏ nhất mà lõi chấp nhận, bật đủ mọi module admin. Job CI `blank-site` (`node scripts/check.mjs blank-site`) kiểm tra kiểu, chạy toàn bộ test admin và build cPanel với `SITE_DIR=tests/fixtures/site-blank`, rồi kiểm tra bản build mang tên của site đó. Job này đỏ nghĩa là lõi vừa phụ thuộc vào site mặc định; khi lõi thêm một khóa chữ hay một file bắt buộc cho site, phải thêm vào bộ site trống trong cùng PR.

Test trong `tests/admin` phải đúng với mọi site. Điều chỉ đúng với một site (domain, số điện thoại, thuộc tính sản phẩm, nội dung trang chủ) đặt trong `site/tests/`.

Muốn thử một site khác mà không thay `site/`: `node scripts/new-site.mjs sites/thu` rồi đặt `SITE_DIR=sites/thu` cho `npm run dev`, `npm run test:admin` hoặc `npm run build:cpanel`. Thư mục site phải nằm trong repo.

## Chưa tách

- **Dữ liệu mẫu và ảnh:** sản phẩm và bài viết mẫu (`src/data`), ảnh trong `public/catalogue`, `public/journal`, và `public/favicon.svg`, `public/bibi-logo.svg`, `public/zalo.png` vẫn là của site gốc và đi theo mọi bản build. Site mới phải thay các file này trong `public/` và nhập dữ liệu của mình qua admin. Việc chuyển chúng vào `site/` chờ sửa xong dữ liệu ảnh trên production ([content-image-refs.md](content-image-refs.md)).
- **Deploy:** workflow production, đường dẫn hosting và công cụ deploy cPanel vẫn mang giá trị của site gốc. Site mới cần hosting, secret và biến repo riêng, và phải sửa các giá trị đó theo [build-and-deploy.md](build-and-deploy.md) cho tới khi phần deploy đọc cấu hình từ `site/`.
- **Tên kỹ thuật nội bộ** có `bibi` (biến môi trường `BIBI_`, cookie, header, khóa lưu trữ) giữ nguyên; coi đó là tên mã của nền tảng.
- **Ngôn ngữ:** chữ giao diện đọc từ `messages/vi.ts`; admin chỉ có tiếng Việt.
