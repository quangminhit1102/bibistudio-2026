# Kiểm chứng menu nhóm admin — local

Source runtime `72b239bef60285fcd0c6d922784104cdb38861c5`. Chỉ local, không push/deploy.

## Đã triển khai

Năm nhóm,29 liên kết hai cấp có icon, chevron đơn giản, mở nhiều nhóm cùng lúc. Preference riêng `bibi-admin:nav-groups:v1`; tự mở nhóm chứa trang khi điều hướng/reload, vẫn cho phép đóng nhóm hiện tại. Desktop và drawer dùng chung state, mỗi renderer có aria ID riêng. Compact/tablet luôn truy cập được mọi icon được phép, không phụ thuộc trạng thái nhóm đóng. Giữ resize, scrollbar, profile và route URL.

## Test và review

- Test ban đầu FAIL vì thiếu capability; cấu hình/logic mới GREEN. Router thật tái hiện hai active links ở trang Viết bài mới; regression xác nhận FAIL2links rồi PASS1link sau exact matching. Trang chỉnh sửa vẫn highlight đúng danh sách.
- Review độc lập range057d2a4..5c7de2e phát hiện một Important: vai trò chỉ có quyền tạo nhìn thấy link bị guard view từ chối. Regression đã RED→GREEN, menu nay kiểm tra cả view và action.19 targeted tests đạt sau sửa. Không review lần hai; reviewer không có declined-to-judge trong phạm vi.
- Minor để sau: nhập trực tiếp URL tạo khi chỉ có quyền xem có thể làm breadcrumb/aria-current chỉ vào danh sách trong khi editor báo thiếu quyền. Link tạo đã bị ẩn trong menu; không cấp thêm quyền hoặc cho ghi dữ liệu. Cần resolve toàn bộ route trước rồi đối chiếu allowed items trong một đợt sau.
- TypeScript và scoped ESLint bản cuối exit0. Một lỗi format activeOptions được phát hiện và sửa bằng Prettier trước bản cuối. Không chạy lại tooling/API tests vì không đổi phần đó.
- Full suite trên bản cuối đạt **154/154 tests,62 files**, exit0. Lượt full trước fix có153 tests; không dùng lượt đó thay cho kết quả cuối154 tests.

## Browser thật

- Desktop1440px: Enter/Space mở Tổng quan, Quản lý sản phẩm và Kinh doanh cùng lúc; reload giữ cả3 nhóm. Đóng Tổng quan rồi Tab chuyển thẳng sang tiêu đề Quản lý sản phẩm, bỏ các link trong panel ẩn.
- Tại trang Viết bài mới chỉ một link active; trang product-1/edit highlight Danh sách sản phẩm. Permission custom role kiểm tra bằng unit test, không sửa tài khoản/dữ liệu review để giả lập browser.
- Compact:29 links icon hiện, không còn nút tiêu đề ẩn nhận focus. Tablet768px cũng đủ29 links. Desktop1024px/mobile390px không tràn ngang; drawer chọn Báo cáo tự đóng và khi mở lại đánh dấu Báo cáo. Aria-controls giữa hai renderer không trùng.
- Resize thật220→300px, không tràn ngang; profile header vẫn mở đúng Hồ sơ/Đăng xuất. Đã xem sáng/tối. Các lượt điều hướng phải đợi route ổn định; không lấy snapshot sớm đang transition làm kết quả nghiệm thu.

## Artifact

Build exit0, `.releases/local-72b239bef60285fcd0c6d922784104cdb38861c5`; previewRelease tại4193. `/api-test` xác nhận FE/BE cùng release. Trên chính artifact đã kiểm tra persistence ba nhóm sau reload, mobile drawer/active Báo cáo và aria IDs. Ảnh thực trong visualizations của chat: `admin-nav-groups-accepted-desktop.jpg`, `admin-nav-groups-accepted-mobile.jpg`; ảnh không phải mockup.
