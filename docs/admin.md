# BiBi Admin — hướng dẫn cho người và agent

Admin nằm trong app hiện có tại `/admin`, dùng React, TanStack Router/Query, TypeScript và CSS scoped. Đây là **demo trên trình duyệt**, chưa kết nối tài khoản, MySQL, thanh toán hoặc catalogue thật. Express hiện có vẫn chỉ phục vụ API demo. Không nhập dữ liệu nhạy cảm vào bản demo.

## Chạy và kiểm tra

Dùng Node24 và các lệnh ở [build-and-deploy.md](build-and-deploy.md): `npm ci`, `npm run dev`, `npm run check`, `npm run build`. FE và BE chạy cùng bằng một lệnh dev; mở `http://localhost:5173/admin`. Chọn một tài khoản demo theo vai trò. Không cần mật khẩu hay database.

`npm run test:admin` chỉ chạy bộ test admin. `npm run check` còn kiểm tra TypeScript, lint, ảnh catalogue, tooling triển khai và API. Build release dùng nguyên pipeline cPanel hiện có; admin được phát hành cùng FE khi có yêu cầu phát hành riêng. Không tự push/deploy chỉ vì test hoặc build đạt.

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
| Cài đặt        | `/admin/settings/general`               | Chung, appearance, security mô phỏng, hồ sơ cá nhân, reset                       |
| UI             | `/admin/components/overview`            | 7 nhóm ví dụ có tương tác, trạng thái và mã TypeScript                           |

Link dùng TanStack Router để giữ basepath, kể cả `/~vhplasti`. `/admin/login` và `/admin` đi vào dashboard với màn chọn tài khoản khi chưa có session. `noindex` chỉ phục vụ crawler, không phải lớp bảo vệ truy cập.

## Dữ liệu và reset

IndexedDB `bibi-admin-demo` chứa entity records và ảnh Blob. localStorage chỉ chứa `bibi-admin:session` và `bibi-admin:theme`. Seed tải theo module, ID ổn định: 50 sản phẩm, 12 khách mua hàng, 30 phiếu mẫu, 30 users, 40 bài và 200 sessions/80 visitors. Thời điểm analytics demo cố định 01/11/2026; phiếu mới dùng thời gian thao tác thực tế, dashboard mặc định theo ngày Việt Nam hiện tại. DB v2 tạo các store mới và giữ toàn bộ sách/đơn/dữ liệu/ảnh cũ; không tự chuyển chúng sang khách hoặc phiếu. Không khởi tạo thêm legacy qua các trang mới.

Seed không ghi vào `src/data/catalogue.ts`, không upload hosting và không làm thay đổi landing page. Ảnh admin nhập giới hạn5MiB/ảnh,40MP và10 file/lần. Metadata, Blob và audit được ghi cùng transaction; lỗi lưu không báo thành công. Xóa ảnh có liên kết trong gallery/ảnh đại diện/nội dung bài bị chặn. Xóa ảnh chưa dùng giải phóng cả Blob.

Reset tại **Cài đặt → Bảo mật demo → Reset demo**, cần xác nhận. Nó xóa admin DB và phiên demo, giữ tùy chọn website công khai. Ảnh và các sửa đổi demo bị xóa; lần đăng nhập tiếp theo tạo bộ mẫu mới. Nếu đổi seed trong source, dữ liệu đã sửa không tự bị ghi đè; dùng reset để xem bộ mẫu mới.

## Quy tắc dữ liệu

Service bất đồng bộ nằm ở `src/features/admin/services`; hợp đồng typed trong `contracts.ts`. Generic CRUD kiểm tra Zod, quyền, revision, liên kết và audit trong transaction. Bulk trả số mục thành công/lỗi cụ thể; export lấy toàn bộ kết quả lọc và chặn CSV formula injection. Search hỗ trợ tiếng Việt có/không dấu. Xung đột revision yêu cầu tải lại thay vì ghi đè.

Phiếu mua hàng có service riêng, số tăng theo năm và transaction cùng counter/audit. Snapshot khách/tên sản phẩm/SKU/đơn giá/VAT đã lưu được giữ khi danh mục đổi; form refetch không tự ghi đè bản nháp. Đổi khách có thể lấy lại VAT mặc định hoặc tự chọn. Tổng là số nguyên VND = tổng số lượng × đơn giá; VAT chỉ ghi Có/Không, không cộng thuế. Phiếu đã hủy vẫn còn lịch sử, không sửa/lưu lại hoặc dùng lại số; không xóa phiếu.

Doanh thu ghi nhận là tổng phiếu đã lưu, chưa hủy theo thời điểm tạo tại Việt Nam; không biểu thị tiền đã thu. Phiếu không thay stock/reserved. Báo cáo và CSV lấy toàn bộ dữ liệu lọc, biểu đồ chỉ Top 10 có nhãn rõ. Chưa có dữ liệu liên kết visitor–phiếu nên conversion để trống. Analytics dùng IP/location mô phỏng, không thu IP/tracking thật; chỉ gộp các URL sản phẩm đã có trong phiên, không log từng click.

Nội dung editor lưu JSON có whitelist nodes, marks và link; HTML dán dạng raw không được chạy. Ảnh bài viết lưu mediaId và được mở bằng Blob URL có cleanup. Không giữ ảnh base64 trong localStorage.

## Quyền và giới hạn

Super Admin/Administrator có quyền quản trị; Manager quản lý catalogue/sales; Editor quản lý nội dung; Viewer chỉ xem. Ma trận có thể chỉnh trong demo. Super Admin gốc và Super Admin cuối cùng được bảo vệ; Administrator không tự cấp vai trò cao nhất. Hồ sơ cá nhân chỉ sửa tên/email, không đổi role. Đổi role/vô hiệu hóa tài khoản đang dùng làm phiên demo cần đăng nhập lại.

Quyền được kiểm tra ở UI và service local để thử trải nghiệm. Người dùng có thể sửa dữ liệu trình duyệt: đây không phải auth/security production. MFA/session timeout ở trang Security chỉ là tùy chọn mô phỏng, chưa thực thi xác thực hoặc timeout server.

## Mở rộng Express/MySQL sau này

Giữ contract `EntityService<K>` cho list/get/create/update/remove/bulk/export và mã lỗi `validation`, `not-found`, `forbidden`, `conflict`, `storage`, `aborted`. Thay factory trong ServicesContext bằng adapter gọi Express `/api/admin/...`; chuyển page/filter/sort theo ListInput, hỗ trợ AbortSignal và revision/ETag. Components không nên biết SQL hoặc endpoint cụ thể.

Trước khi dùng thật phải làm auth cookie/session server, RBAC server, validation, transaction MySQL, migrations/backup, media storage ngoài DB trình duyệt, audit server, CSRF/rate limits theo cơ chế auth. Việc phát hành nội dung thật và xử lý thanh toán cần quy trình riêng. Không nối thẳng biểu mẫu demo vào database production.

## Hiệu năng và cấu trúc

Thin route adapters lazy-load admin shell và từng page. Charts, TipTap editor, showcase và seed là chunks động. CSS admin nằm dưới `.admin-root`; dark mode không bật trên `html` của landing page. Không gom admin vào public barrel hoặc import seed trong root.

`scripts/admin-bundle-report.mjs` so sánh closure static imports JS gzip với baseline trước admin và kiểm tra manifest không kéo admin vào graph public. Ngưỡng tăng public JS10KiB, global CSS2KiB. Báo cáo chỉ đo local build; không đồng nghĩa Lighthouse hoặc thời gian tải production. Xem [biên bản kiểm chứng](admin-acceptance.md) để biết phần đã chạy thực tế.

## Thông báo và URL cũ

Chuông mở popup bám nút trên desktop/mobile. Mỗi tài khoản có read receipt riêng; read mặc định cũ vẫn được tôn trọng. Click cập nhật ngay dấu đọc/badge; lỗi lưu khôi phục cả hai và không chuyển trang. Lưu thành công mới mở link hợp lệ; không có link thì giữ popup. Đánh dấu tất cả áp dụng toàn bộ thông báo, kể cả chưa tải trang. Đổi/đăng xuất tài khoản loại cache và bỏ kết quả mutation phiên cũ.

Các URL bookstore cũ về danh sách khách; orders/history/transactions về danh sách phiếu, không chuyển ID sách/đơn cũ thành ID khách/phiếu. Analytics cũ về Khách truy cập, visitor ID cũ giữ qua query; notifications về dashboard. Quyền key `bookstore` vẫn giữ cho custom role nhưng nhãn là Khách mua hàng.
