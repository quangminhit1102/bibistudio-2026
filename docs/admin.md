# BiBi Admin — hướng dẫn cho người và agent

Admin nằm trong app hiện có tại `/admin`, dùng React, TanStack Router/Query, TypeScript và CSS scoped. Đợt auth04/11 đang triển khai local: login, RBAC, account/role/permission, audit và khách truy cập đã nối Express/MySQL. Chưa phát hành đợt này lên production. Catalogue/content/media và nghiệp vụ kinh doanh vẫn lưu trong trình duyệt; sửa admin chưa xuất bản catalogue public. Xem [API/schema](admin-auth-api.md) và [vận hành/giới hạn](admin-auth-operations.md).

## Chạy và kiểm tra

Dùng Node24 và Docker Desktop. Sau `npm ci`, chạy `npm run db:setup:local` một lần để tạo DB develop, migrate và seed. Sau đó dùng các lệnh ở [build-and-deploy.md](build-and-deploy.md): `npm run dev`, `npm run check`, `npm run build`. FE và BE chạy cùng bằng một lệnh dev; mở `http://localhost:5173/admin`. Account local là `admin`/`user01`; password bootstrap local nằm trong file ignored `.env.migration.local`. Không dùng fixture bibi.admin trước đây để đăng nhập runtime mới.

`npm run test:admin` chỉ chạy bộ test admin. `npm run check` còn kiểm tra TypeScript, lint, ảnh catalogue, tooling, API với MySQL test và Chromium UI. Artifact auth có manifest schemaVersion2 để receiver cũ từ chối. Chưa phát hành trước khi hosting backup/migration/probe/rollback mới được kiểm chứng; build thành công không chứng minh đã deploy.

## Biên tập Bài viết và Sản phẩm — local

Đợt usability06/11 đã kiểm chứng local, chưa push/deploy: sidebar thu gọn có tooltip khi hover hoặc focus, Escape để đóng; form chỉ cảnh báo rời trang khi nội dung khác bản mở/lưu thành công. Hồ sơ Master hiển thị lý do bảo vệ, trường chỉ đọc vẫn focus/copy được. Nhãn trạng thái dùng xanh lá (thành công), đỏ (hủy/lỗi), vàng (cần chú ý), xanh dương (thông tin/VAT), tím (quyền/bảo vệ), xám (trung tính). Quyền Admin+User vẫn cộng dồn. Điện thoại/ảnh đại diện và tự sửa hồ sơ sẽ làm riêng trong đợt2, chưa có ở đợt này.

Hai màn tạo/sửa dùng **TinyMCE 8.10.1 tự host theo GPL**, do người dùng chọn và xác nhận ngày 03/11/2026. Không cần Tiny Cloud, API key hoặc CDN. Attribution, `license.md`, `notices.txt` và thông tin nguồn đi cùng asset; không thay đổi license của chính repository BiBi.

`npm ci` chuẩn bị asset sau khi cài backend/ops. `npm run dev` và các lệnh build cũng chuẩn bị lại asset; không có thêm lệnh thường ngày. `scripts/prepare-tinymce.mjs` lấy core, theme/model/icons, CSS sáng/tối, plugins lists/link/wordcount và bản dịch tiếng Việt từ dependencies đã khóa vào `public/vendor/tinymce-8.10.1/`. Thư mục sinh tự động bị Git bỏ qua nhưng được Vite đưa vào artifact. Không sửa asset vendor trực tiếp.

Editor chỉ tải ở trang tạo/sửa. Trang chi tiết và preview dùng renderer nhẹ. Nếu asset tải lỗi, form có nút Thử lại và chặn lưu khi editor chưa sẵn sàng, không ghi rỗng nội dung cũ.

- Bài viết: tiêu đề/slug/tóm tắt, nội dung có định dạng, ảnh với alt/chú thích, chuyên mục/tác giả/thẻ/ngày, ảnh bìa và SEO.
- Sản phẩm: tên/SKU/slug, mô tả ngắn/chi tiết, gallery đổi thứ tự/ảnh chính, loại/bộ sưu tập/danh mục độc lập. Giá/tồn kho nằm trong Thông tin nội bộ, không xuất hiện trong preview catalogue.
- Xem trước dùng nội dung đang nhập, không yêu cầu lưu; chọn Desktop/Mobile rồi Escape hoặc Đóng để quay lại. Lưu nháp đặt trạng thái Nháp. Mọi trạng thái chỉ áp dụng dữ liệu local, chưa xuất bản website.
- Slug bản mới tự sinh đến khi người dùng tự sửa; bản có sẵn giữ slug cũ. Lỗi validation/revision giữ nội dung đang nhập.

Nội dung mới lưu chuỗi JSON `{format:'html-v1',html:...}` đã sanitize. Adapter đọc JSON Tiptap/plain text cũ; mở trang không tự ghi record. Chỉ lưu media ID, URL Blob được tạo khi hiển thị và giải phóng theo vòng đời. Service dùng cùng adapter và chặn xóa ảnh đang được dùng trong bài viết/mô tả sản phẩm.

Seed mới giữ ảnh inline/chú thích từ blog public; upgrade chỉ thêm media thiếu, không reset hoặc ghi đè record đã sửa. IndexedDB tách theo **origin**: đổi port/hostname local sẽ có thể mở kho khác. Không suy luận dữ liệu mất từ việc chưa thấy nó ở một port mới.

## Các module

| Nhóm           | Đường dẫn chính                         | Thao tác demo                                                                    |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| Tổng quan      | `/admin/dashboard`                      | KPI và biểu đồ tính từ dữ liệu, lọc ngày                                         |
| Khách truy cập | `/admin/analytics/visitors`             | ID/IP/location/thiết bị–OS/browser/phiên; dialog chi tiết cùng trang             |
| Sản phẩm       | `/admin/products/list`                  | Tạo/sửa/nhân bản/ẩn/xóa có kiểm tra liên kết, danh mục, tồn kho                  |
| Khách mua hàng | `/admin/customers`                      | Nhà sách, cá nhân, công ty; địa chỉ, có/không VAT, thông tin thêm, ngừng sử dụng |
| Phiếu mua hàng | `/admin/sales/slips`                    | Ngày giờ, khách, dòng sản phẩm/số lượng/đơn giá/tổng, nhãn VAT, hủy có lý do     |
| Báo cáo        | `/admin/sales/reports`                  | Theo năm/khách, tổng doanh thu ghi nhận, số lượng/giá trị sản phẩm và CSV đầy đủ |
| Nội dung       | `/admin/content/posts`                  | Bài viết với rich editor, chuyên mục, thẻ, SEO, ảnh                              |
| Media          | `/admin/content/media`                  | Nhập JPEG/PNG/WebP, xem trước, tìm, grid/list, xóa ảnh chưa dùng                 |
| Tài khoản      | `/admin/accounts/users`                 | Users, roles, ma trận phân quyền demo                                            |
| Hệ thống       | `/admin/audit-logs`, chuông trên header | Audit trước/sau; popup thông báo theo tài khoản, không có trang riêng            |
| Cài đặt        | `/admin/settings/general`               | Thông tin studio, giao diện sáng/tối, hồ sơ cá nhân và ảnh đại diện              |
| UI             | `/admin/components/overview`            | 7 nhóm ví dụ có tương tác, trạng thái và mã TypeScript                           |

Link dùng TanStack Router để giữ basepath, kể cả `/~vhplasti`. Khi chưa có phiên, `/admin` mở Login; `returnTo` chỉ nhận đường dẫn admin nội bộ an toàn. Session v2 không lưu mật khẩu; session legacy hết hạn một lần và giữ DB. `noindex` chỉ phục vụ crawler, không phải lớp bảo vệ truy cập.

## Dữ liệu và reset

IndexedDB `bibi-admin-demo` chứa entity records và ảnh Blob; giữ tên DB cũ để không mất dữ liệu. localStorage chỉ chứa session và theme. Seed lazy lấy sản phẩm/bài viết từ catalogue/blog hiện có (hiện74 sản phẩm), ảnh dùng URL nội bộ. Khách, phiếu, tài khoản và analytics vẫn là dữ liệu thử; không phải doanh số/tracking thật. Analytics cố định 01/11/2026; phiếu mới dùng thời gian thao tác thực tế, preset ngày dùng giờ Việt Nam hiện tại.

Seed không ghi vào `src/data/catalogue.ts`, không upload hosting và không làm thay đổi landing page. Ảnh admin nhập giới hạn5MiB/ảnh,40MP và10 file/lần. Metadata, Blob và audit được ghi cùng transaction; lỗi lưu không báo thành công. Xóa ảnh có liên kết trong gallery/ảnh đại diện/nội dung bài bị chặn. Xóa ảnh chưa dùng giải phóng cả Blob.

Không có nút reset/security giả trong UI. Migration trình bày có version và chỉ đổi field còn khớp baseline cũ chính xác; không ghi đè field đã sửa, audit, snapshot phiếu, counter, tiền, stock hoặc Blob. Chỉ9 slug bản đồ khớp chính xác được nối với ID cũ; sản phẩm khác có ID ổn định theo slug. Record cũ không bị xóa. Sản phẩm nguồn chưa có ảnh dùng fallback, không tự bịa ảnh.

## Quy tắc dữ liệu

Service bất đồng bộ nằm ở `src/features/admin/services`; hợp đồng typed trong `contracts.ts`. Generic CRUD kiểm tra Zod, quyền, revision, liên kết và audit trong transaction. Bulk trả số mục thành công/lỗi cụ thể; export lấy toàn bộ kết quả lọc và chặn CSV formula injection. Search hỗ trợ tiếng Việt có/không dấu. Xung đột revision yêu cầu tải lại thay vì ghi đè.

Phiếu mua hàng có service riêng, số tăng theo năm và transaction cùng counter/audit. Snapshot khách/tên sản phẩm/SKU/đơn giá/VAT đã lưu được giữ khi danh mục đổi; form refetch không tự ghi đè bản nháp. Đổi khách có thể lấy lại VAT mặc định hoặc tự chọn. Tổng là số nguyên VND = tổng số lượng × đơn giá; VAT chỉ ghi Có/Không, không cộng thuế. Phiếu đã hủy vẫn còn lịch sử, không sửa/lưu lại hoặc dùng lại số; không xóa phiếu.

Doanh thu ghi nhận là tổng phiếu đã lưu, chưa hủy theo thời điểm tạo tại Việt Nam; không biểu thị tiền đã thu. Phiếu không thay stock/reserved. Báo cáo và CSV lấy toàn bộ dữ liệu lọc, biểu đồ chỉ Top 10 có nhãn rõ. Chưa có dữ liệu liên kết visitor–phiếu nên conversion để trống. Analytics dùng IP/location mô phỏng, không thu IP/tracking thật; chỉ gộp các URL sản phẩm đã có trong phiên, không log từng click.

Nội dung editor lưu JSON có whitelist nodes, marks và link; HTML dán dạng raw không được chạy. Ảnh bài viết lưu mediaId và được mở bằng Blob URL có cleanup. Không giữ ảnh base64 trong localStorage.

## Quyền và giới hạn

Vai trò hiển thị tiếng Việt, permission key giữ nguyên. Super Admin/Administrator có quyền quản trị; Manager quản lý catalogue/sales; Editor quản lý nội dung; Viewer chỉ xem. Super Admin gốc và cuối cùng được bảo vệ. Đổi role/ngừng hoạt động tài khoản đang dùng yêu cầu đăng nhập lại. Khách/tài khoản dùng Hoạt động/Ngừng hoạt động; sản phẩm/bài viết giữ trạng thái nghiệp vụ xuất bản riêng.

Quyền được kiểm tra ở UI và service local để thử trải nghiệm. Người dùng có thể sửa dữ liệu trình duyệt: đây không phải auth/security production. URL Security cũ về Hồ sơ; không có MFA/reset mật khẩu/session timeout giả.

## Hồ sơ và đăng nhập mở rộng

Tên/email/ảnh đại diện dùng cùng một nút Lưu. Chọn hoặc xóa ảnh chỉ thay bản nháp; Hủy không ghi DB. JPEG/PNG/WebP hợp lệ tối đa5MiB và40 triệu pixel; kiểm tra signature và decode. Blob, reference, revision và audit commit nguyên tử; lỗi quota/xung đột giữ ảnh cũ và bản nháp. Avatar riêng theo chủ, không cấp thêm quyền Content hoặc đưa vào media gallery; preview URL được thu hồi khi đổi/unmount.

`accounts/auth/contracts.ts` định nghĩa AuthService login/getSession/logout; `AdminProvider.authFactory` là seam thay local adapter bằng HTTP/session server sau này. Profile/CRUD vẫn dùng contract dịch vụ; không nhúng endpoint/SQL vào component. Bộ tùy chọn A–D chưa triển khai, chỉ E (ảnh hồ sơ) được chọn.

## Mở rộng Express/MySQL sau này

Giữ contract `EntityService<K>` cho list/get/create/update/remove/bulk/export và mã lỗi `validation`, `not-found`, `forbidden`, `conflict`, `storage`, `aborted`. Thay factory trong ServicesContext bằng adapter gọi Express `/api/admin/...`; chuyển page/filter/sort theo ListInput, hỗ trợ AbortSignal và revision/ETag. Components không nên biết SQL hoặc endpoint cụ thể.

Trước khi dùng thật phải làm auth cookie/session server, RBAC server, validation, transaction MySQL, migrations/backup, media storage ngoài DB trình duyệt, audit server, CSRF/rate limits theo cơ chế auth. Việc phát hành nội dung thật và xử lý thanh toán cần quy trình riêng. Không nối thẳng biểu mẫu demo vào database production.

## Hiệu năng và cấu trúc

Thin route adapters lazy-load admin shell và từng page. Charts, TipTap editor, showcase và seed là chunks động. CSS admin nằm dưới `.admin-root`; dark mode không bật trên `html` của landing page. Không gom admin vào public barrel hoặc import seed trong root.

`scripts/admin-bundle-report.mjs` so sánh closure static imports JS gzip với baseline trước admin và kiểm tra manifest không kéo admin vào graph public. Ngưỡng tăng public JS10KiB, global CSS2KiB. Báo cáo chỉ đo local build; không đồng nghĩa Lighthouse hoặc thời gian tải production. Xem [biên bản kiểm chứng](admin-acceptance.md) để biết phần đã chạy thực tế.

## Thông báo và URL cũ

Chuông mở popup bám nút trên desktop/mobile. Mỗi tài khoản có read receipt riêng; read mặc định cũ vẫn được tôn trọng. Click cập nhật ngay dấu đọc/badge; lỗi lưu khôi phục cả hai và không chuyển trang. Lưu thành công mới mở link hợp lệ; không có link thì giữ popup. Đánh dấu tất cả áp dụng toàn bộ thông báo, kể cả chưa tải trang. Đổi/đăng xuất tài khoản loại cache và bỏ kết quả mutation phiên cũ.

Các URL bookstore cũ về danh sách khách; orders/history/transactions về danh sách phiếu, không chuyển ID sách/đơn cũ thành ID khách/phiếu. Analytics cũ về Khách truy cập, visitor ID cũ giữ qua query; notifications về dashboard. Quyền key `bookstore` vẫn giữ cho custom role nhưng nhãn là Khách mua hàng.

Link phiếu mới dùng số `PMH-2026-0001`; URL primary ID cũ vẫn resolve rồi replace canonical, giữ query/hash. Service luôn cập nhật primary ID, không dùng số phiếu làm ID DB. Số trùng báo conflict; không chọn ngẫu nhiên record.

### Công cụ biên tập blog mở rộng — 03/11/2026

Editor bài viết và mô tả sản phẩm có menu tiếng Việt Sửa/Chèn/Định dạng/Bảng/Công cụ/Xem. Hỗ trợ H2–H4, gạch ngang, chỉ số trên/dưới, màu chữ/nền, bảng, ký tự đặc biệt, đường phân cách, thụt lề (tối đa240px khi lưu), tìm/thay thế, đếm từ và toàn màn hình. Xem trước của biểu mẫu dùng cả nội dung chưa lưu và không nạp editor.

Chèn/sửa ảnh qua thư viện hiện có; ô chiều rộng nhận16–4096px hoặc để trống. Kích thước kéo trong editor được lưu thành chiều rộng; chiều cao luôn tự động để giữ tỉ lệ và ảnh co lại trên mobile. Bảng, màu và các định dạng được lọc theo whitelist khi lưu, không cho CSS vị trí tùy ý hoặc ảnh/iframe bên ngoài. Màu/định dạng dán từ phần mềm khác có thể được TinyMCE chuẩn hóa; dùng công cụ Định dạng để áp dụng lại.

Chỉ nạp plugin cộng đồng từ package TinyMCE đã cài, không thêm dependency, CDN hoặc API key. Thư mục vendor và mã nguồn TinyMCE có version, giấy phép và thông báo đi kèm như hướng dẫn build/deploy. Dữ liệu admin vẫn nằm trong trình duyệt; đưa UI lên hosting không biến nó thành CMS dùng chung hay cập nhật bài public.
