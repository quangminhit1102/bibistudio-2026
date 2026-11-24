# Nền tảng tái sử dụng, giai đoạn 5a: bộ site trống, job CI và hướng dẫn tạo site mới

Nối tiếp giai đoạn 4 (PR #11). Giai đoạn 5 của bản thiết kế được tách đôi vì lần deploy production gần nhất lỗi ở bước probe và chưa rõ nguyên nhân:

- **5a (PR này):** không đụng workflow deploy, công cụ deploy cPanel, hosting hay dữ liệu production.
- **5b (sau khi deploy chạy được lại):** `production.yml` đọc `PRODUCTION_BASE_URL`, `scripts/cpanel-deploy-artifacts.mjs` và đường dẫn tạm đọc từ `site/`, test ranh giới chuyển sang toàn repo.

## Mục tiêu

Một thay đổi ở lõi mà chỉ chạy được với site mặc định phải làm CI đỏ, và người tạo site mới có một lệnh cùng một tài liệu để bắt đầu.

## Việc làm

1. **Bộ site trống** `tests/fixtures/site-blank`: đủ các file lõi đọc từ một site (`site.config.ts`, `catalogue.config.ts`, `messages/vi.ts`, ba trang, `theme.css`, logo) với tên "Northwind Studio", một thuộc tính sản phẩm, không mạng xã hội, không vị trí, không font. `tsconfig.json` riêng trỏ `@site/*` vào chính nó.
2. **Test của lõi đúng với mọi site.** Sáu file trong `tests/admin` khẳng định giá trị của BiBi. Phần đó chuyển sang `site/tests/` (chạy cùng test admin qua `vitest.admin.config.ts`); phần còn lại dùng dữ liệu của riêng test.
3. **Giai đoạn `blank-site`** trong `scripts/check.mjs` và job CI cùng tên: kiểm tra kiểu, toàn bộ test admin, build cPanel với `SITE_DIR=tests/fixtures/site-blank`, rồi kiểm tra bản build mang tên site và tên admin của site đó. Bản build ghi vào `.superpowers/site-blank` để không ghi đè `dist-cpanel`.
4. **`node scripts/new-site.mjs [thư mục]`**: chép bộ site trống thành site mới và sửa đường dẫn tương đối.
5. **Tài liệu:** `docs/new-site.md`, mục cấu hình site và bảng job trong `docs/build-and-deploy.md`, `AGENTS.md`.

## Khác bản thiết kế

- Bộ site trống bật đủ mọi module admin thay vì ít nhất có thể. Tắt bớt thì 53 test admin của các module đó đỏ theo đúng thiết kế giai đoạn 4, và job không còn chạy được toàn bộ test admin. Việc tắt module đã có test riêng (`tests/admin/admin-modules.test.ts`).
- Thêm lệnh `new-site.mjs`, vì chép tay phải sửa đường dẫn tương đối trong ba file.
- `emitCpanelIndex` trong `vite.cpanel.config.ts` đọc thư mục đầu ra từ cấu hình Vite thay vì viết cứng `dist-cpanel`. Mặc định không đổi.

## Ảnh hưởng tới deploy

Deploy production chỉ chạy khi mọi job CI trên `main` đạt, nên job `blank-site` trở thành một điều kiện nữa của deploy. Workflow deploy không sửa.

## Chưa làm, ghi trong `docs/new-site.md`

Dữ liệu mẫu và ảnh (`src/data`, `public/`) vẫn của site gốc (giai đoạn 3b-2, chờ sửa dữ liệu ảnh production); phần deploy vẫn mang giá trị của site gốc (5b).

## Kiểm chứng

- `node scripts/check.mjs blank-site` đạt; `assertSiteBuild` từ chối khi đưa cấu hình của site khác.
- Trong một bản sao của repo: xoá `site/`, chạy `node scripts/new-site.mjs`, rồi `node scripts/check.mjs static`, `node scripts/check.mjs admin` và build cPanel.
- `npm run check` và `npm run build` với site mặc định.
