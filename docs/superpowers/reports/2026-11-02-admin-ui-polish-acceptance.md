# BiBi Admin — nghiệm thu hoàn thiện UI local 02/11/2026

Phạm vi: Login qua local AuthService có thể thay adapter, tiếng Việt, presentation migration, URL phiếu canonical, ảnh hồ sơ E, menu/nút, báo cáo,96 ví dụ component và chấm hero. Không làm A–D, không thêm dependency hoặc backend endpoint. Không push/merge/deploy. Bản production đã phát hành trước đó không được coi là có các thay đổi này.

## Lệnh và artifact cuối

- Source chạy: `08af94754ca416532f0e42c294b6903380772ade`, branch `codex/admin-dashboard`. Commit tài liệu sau đó không đổi source runtime.
- `npm run check` exit0: TypeScript, catalogue images, lint0 errors/10 warnings, **131/131 admin tests (59 files)**; tooling/API54pass,1POSIX permissions skip trên Windows. Những warning còn lại thuộc Fast Refresh/ref cleanup; không gọi là lint sạch warning.
- `npm run build` exit0 tạo `.releases/local-08af94754ca416532f0e42c294b6903380772ade.tgz`; SHA256 `bd9ac9b27b007dbbe6fc0627f538efd3693b2a4948e24701be15ec2a50394ac1`.
- Bundle report exit0: public static import closure JS gzip tăng7845byte (ngưỡng10240), CSS tăng146byte (ngưỡng2048); admin/chart/editor/seed không rò vào public graph. Build vẫn có cảnh báo lazy chunks >500KB; số đo không phải Lighthouse production.
- Preview đúng artifact tại `http://127.0.0.1:4193/admin/sales/reports`; `/api-test` hiển thị kết nối thành công và FE/BE cùng `local-08af94754ca416532f0e42c294b6903380772ade`.
- Login fixture đã dùng thật; DB origin4193 khởi tạo74 sản phẩm, reload danh sách giữ74, không ảnh lỗi. Alias `slip-demo-1/edit` replace thành `PMH-2026-0001/edit`, reload form hoạt động. Product Đà Lạt có8 ảnh tải thành công/0broken; homepage Space chọn ảnh3 cập nhật aria-current đúng.
- Artifact preview là local FE/Express, không nghiệm thu cPanel trực tiếp. Bộ test returnTo/asset basepath tiếp tục đạt; không ghi nhận một lượt preview `cpanel-temp` mới trong đợt này.

## Browser

- Thao tác96/96 ví dụ thuộc7 nhóm; inventory và quan sát từng mục tại [component audit](../../admin-component-audit.md).
- 18 trang ×5 kích thước360/390/768/1024/1440px và Login/Tạo phiếu ×5 (100 trường hợp bố cục): không tràn ngang toàn trang, không ảnh đã tải bị lỗi. Bảng có vùng cuộn riêng; kiểm tra sau khi layout/scrollbar ổn định.
- Light/dark và bàn phím đã được kiểm tra trong các lượt thao tác. Không khẳng định đã chạy mọi tích Descartes trạng thái/theme/viewport. Không dùng screenshot mockup làm bằng chứng.
- Báo cáo1440px:10 nhãn khách có cùng tọa độ trái290,8px, tên/mã tách dòng. Section có margin32px desktop và24px mobile. Mobile dùng ranked list từ cùng dữ liệu. Compact account trigger44×44px, đúng Hồ sơ/Đăng xuất; mobile drawer vẫn có liên kết sản phẩm sau khi desktop thu gọn.
- Avatar: chọn WebP thật, preview/lưu/reload đã xác nhận; giao dịch/quota/revision/permission/cleanup được kiểm tra bằng tests, không cố tình làm hỏng DB review.
- Hero trước sửa bị cắt controls20–55px khi Parallax cuộn. Sau sửa5 viewport có hit44×44px và cut0; cuộn gần hết hero controls đi cùng frame, không floating sang section sau. Enter chọn ảnh làm aria-current thay đổi đúng. Timer/reduced-motion/unmount được xác nhận bằng tests; không giả lập OS reduced-motion hoặc throttling mạng vì browser không cung cấp capability đó.
- Browser dev từng ghi một View Transition aborted khi điều hướng nhanh; trang tiếp tục hoạt động. Không coi log này là nghiệm thu console rỗng. HMR khi đổi context có lúc cần reload; artifact tĩnh là cổng nghiệm thu cuối.

## Review độc lập và fix pass

Một reviewer mới kiểm tra range6027ef1..13af673, không reviewer triển khai, không review lần hai. Sáu Important được chấp nhận và sửa trong một lượt, regression quan sát RED→GREEN:

1. Route resolver refetch lỗi giữ editor/bản nháp phiếu và cho retry.
2. Order seed chỉ tham chiếu explicit seed-owned products; không tạo lịch sử cho custom UUID hoặc tham chiếu sản phẩm không có.
3. Các caller cùng seed group đều await migration riêng; theo dõi cả migration khi drain/reset.
4. Migration kiểm tra unique trong transaction, giữ field đang xung đột slug/email và vẫn đổi field an toàn khác.
5. Menu/modal/tooltip/notification portal nhận theme từ React Context, không đọc DOM cũ trong render. Browser toggle rồi keyboard-open xác nhận nền/chữ đúng cả sáng/tối.
6. Copy trang người dùng, dashboard và visitor bỏ nhãn mô phỏng; trạng thái account dùng Ngừng hoạt động. Giới hạn dữ liệu/auth vẫn ghi thật trong tài liệu kỹ thuật.

Minor để sau: label chart desktop dùng native title nên tên bị ellipsis chưa tự bung ra trực quan khi Tab focus; hover có title, mobile có tên đầy đủ. Đây không phải claim keyboard tooltip hoàn chỉnh.

## Các quyết định đã áp dụng

1. Chuẩn hóa heading Task1 thành Task 1 để script parse; chỉ format, không chi phí hành vi.
2. Dev cPanel config thiếu HTML fallback: dùng middleware local bị gitignore; không sửa production routing. Nếu khác biệt môi trường, artifact preview là kiểm tra quyết định.
3. Catalogue chỉ có9 exact map slug (không Sa Pa), một số ảnh nguồn trống: map đúng9, giữ product-10 cũ và fallback khi nguồn không có ảnh. Chi phí là một số sản phẩm cũ vẫn có fallback, không tự gán sai ảnh.
4. Dùng account-avatar.tsx cho UI và profile-avatar.ts cho validation để tránh import cùng basename .ts/.tsx. Không chi phí cho người dùng.
5. Auth/RBAC server và lưu đa thiết bị ngoài phạm vi đã duyệt; local AuthService/IndexedDB không phải bảo vệ thật. Nếu dùng như bảo mật production có rủi ro truy cập dữ liệu trình duyệt; phải có backend auth trước khi dùng thật.
6. Reviewer không chạy lại browser/build và không nghiệm thu live; implementer kiểm chứng artifact local riêng. Chi phí là không có nghiệm thu browser/live độc lập.
7. Filename CSV legacy order không đổi vì route redirect trước khi component mount. Nếu bật lại component, filename cũ cần sửa.
8. Browser không có capability OS reduced-motion hoặc throttling mạng: dùng regression cho reduced motion/timer và đo geometry thực. Chi phí là chưa có bằng chứng browser dưới mạng chậm giả lập hoặc khi đổi thiết lập OS.

Nguồn bằng chứng local: thư mục visualizations của chat, tiền tố `admin-polish-` và `hero-dots-`. Hướng dẫn vận hành ở [admin.md](../../admin.md), pipeline ở [build-and-deploy.md](../../build-and-deploy.md).
