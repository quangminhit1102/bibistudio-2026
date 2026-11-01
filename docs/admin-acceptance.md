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
