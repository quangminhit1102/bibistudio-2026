# Biên bản kiểm chứng admin local

Ngày01/11/2026, Windows, Node24. Đây là biên bản đang bổ sung trong quá trình nghiệm thu, không phải xác nhận deploy.

## Đã quan sát

- Build cPanel thành công; preview tại `http://127.0.0.1:4181/admin/dashboard` mở được màn chọn tài khoản và dashboard có dữ liệu.
- Tạo `LOCAL-REVIEW-001` qua form sản phẩm: danh sách tăng50→51, refresh vẫn có bản ghi.
- Lượt `check` đầu tích hợp:30 admin tests đạt;54 tooling/API tests đạt,1 POSIX permissions test bỏ qua trên Windows. TypeScript đạt; lint0 errors,7 cảnh báo Fast Refresh khi component/hook export chung file.
- Các test thêm sau lượt này: conversion theo visitor duy nhất và hủy import ảnh đang decode sau reset đã chạy riêng đạt. Cần ghi lại lượt suite cuối sau hoàn thiện.
- So sánh closure JS build đầu: baseline174289B gzip, hiện181032B, tăng6743B; CSS tăng59B gzip. Manifest không có admin trong static import graph public. Cần đo lại bản cuối và kiểm tra network trình duyệt.
- Test quota lúc nhập ảnh xác nhận rollback Blob, metadata, audit; xóa ảnh chưa dùng giải phóng Blob. Test link media trong nội dung chặn xóa ảnh đang dùng.

## Cần hoàn tất trước khi ghi toàn bộ kế hoạch đạt

- Full check/build trên source cuối và review độc lập.
- Responsive375/768/1024/1440/1920, light/dark, drawer, keyboard, reduced motion.
- Các luồng chính: books, editor/media, order/inventory, permissions/logout/reset, global search và showcase.
- Deep reload `/~vhplasti/admin/...`, network public không tải admin/chart/editor/seed.

Không push, merge hoặc deploy admin trong đợt triển khai local này.

## Review độc lập và sửa lỗi

Reviewer độc lập đã kiểm tra toàn nhánh tại `e433e44`. Đợt sửa đã xử lý: revision của form được giữ theo snapshot, chỉ gửi field được phép và bảo vệ reserved; seed dữ liệu có thể tham chiếu trước khi xóa; kiểm tra quyền reset ở service; hủy mutation của phiên cũ và đồng bộ session qua tab; chặn Administrator xóa Super Admin; dashboard chỉ trả/hiện các hàng chi tiết được cấp quyền; stock edit ghi ledger, nhân bản không sao chép lượng giữ; calendar date theo múi giờ Việt Nam; Manager gắn ảnh theo quyền catalogue; thêm lọc sách, nhân bản bài viết, chi tiết từng user và usage code của component thật.

Các regression đã chạy riêng đạt: reference/stock/reset/delete/logout/media6 ca cùng calendar; dashboard access1; management capabilities2; usage inventory1; edit snapshot1. Test snapshot đã tái hiện revision sai2 rồi xác nhận sửa về snapshot1. Test cross-tab được bổ sung sau sửa và đã đạt. Full check sau sửa đang chờ ghi nhận.

Ba điểm nhỏ giữ lại để review sau: tìm chính xác tên có dấu ngoặc kép có thể không khớp search JSON; trang chi tiết còn hiện Edit cho Viewer rồi báo thiếu quyền; attachment picker có chọn file nhưng chưa kéo/thả (thư viện media riêng có kéo/thả).
