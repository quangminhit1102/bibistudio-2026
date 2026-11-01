# UI local review — 01/11/2026

## Phạm vi người dùng yêu cầu

Đổi font Cormorant Garamond sang font dễ đọc, tăng zoom ảnh chi tiết, chuyển Facebook/Messenger sang bidiary, bỏ chữ BiBi Studio trang trí cỡ lớn cuối footer. Chỉ cập nhật local để review.

## Lovable và cách áp dụng

Đã dùng Lovable project `a92fe95d-ba22-47c3-be74-9ed93eadfc00`, workspace Minh's Lovable. Lovable đọc source và trả patch bằng plan mode, message `umsg_01m6an9h7newxtap7yc9vn6bp0`. Diff do connector trả về không có thay đổi source cloud. Codex áp dụng patch tại nhánh local `codex/local-ui-refinements`; không push, publish hoặc chạy workflow production.

- Font tiêu đề: Lora400/500 và italic400, giữ Inter cho nội dung; cập nhật cả font token và stylesheet Google Fonts.
- Kính zoom: dùng3× kích thước ảnh thực tế đang hiển thị, tính đúng lề object-contain; ẩn khi ảnh chưa tải hoặc con trỏ nằm ngoài ảnh. Tính lại mỗi pointer move để theo kích thước hiện tại. Tách helper `src/lib/magnifier-geometry.ts` để kiểm tra phép tính; lens cố định176px bằng inline style để không lệch khi cỡ rem thay đổi. Giữ tương tác fullscreen/touch hiện hữu.
- Facebook: `https://www.facebook.com/bidiary`; Messenger: `https://m.me/bidiary`, bao gồm link lời nhắn theo tên sản phẩm. Floating contact cũng dùng dữ liệu contact chung. Chỉ kiểm tra href, không gửi tin nhắn.
- Xóa wordmark khổng lồ và CSS không dùng; giữ logo, các cột footer và dòng bản quyền.

## Bằng chứng

- Commit source8348bb2e61a6d78614c12da1970c7d96289b93c6. Preview tại `http://127.0.0.1:4174/products/da-nang-map-notebook`; release local-8348bb2e61a6d78614c12da1970c7d96289b93c6.
- Regression geometry: test chạy RED vì helper chưa tồn tại, rồi4/4 GREEN; phủ zoom3×, con trỏ lệch tâm, lề ngang/dọc, thay đổi kích thước, ảnh chưa tải và input không hợp lệ. Dùng node:test hiện có, không thêm test framework.
- Node24 `npm run check`:55 tests,54 pass,0 fail,1 POSIX skip trên Windows; TypeScript/lint/catalogue đạt. `npm run build` exit0; cảnh báo chunk lớn hiện hữu. Build riêng rồi dùng `PREVIEW_PORT=4174 node scripts/preview.mjs .releases/local-<SHA>`.
- Browser desktop1440×900: font h1 là Lora và `document.fonts.check` true; kích thước background lens so với ảnh render đo được3.000× theo cả hai trục. Đã mở/đóng fullscreen mobile390×844, kiểm tra product Messenger href chứa bidiary và lời nhắn đúng mẫu. Product/trang chủ mobile không tràn ngang; trang chủ hiển thị font mới. Không thử trên điện thoại vật lý.
- Không còn sharetosmile12, Cormorant hoặc footer-wordmark trong source runtime; footer DOM không có wordmark, vẫn có bản quyền. Sản phẩm, ảnh catalogue, API và CI/CD không đổi.
- Ảnh bằng chứng tại thư mục visualization của session: `ui-local-font-zoom.png`, `ui-local-footer.png`, `ui-local-home-mobile.png`. Viewport override đã reset.

Chờ người dùng review giao diện trước mọi bước phát hành.

## Phát hành production sau khi người dùng duyệt

Người dùng yêu cầu push lên production ngày 01/11/2026. Fetch phát hiện Lovable có thêm merge commit 0af044b chỉ đổi bun.lock; đã merge giữ nguyên lịch sử, không force-push. Source giao diện đã review được đưa lên main tại 4c791499859ea42bbb7214c7bd3e222b2a6a4a57.

- Check Node24 ngoài sandbox:55 tests,54 pass,0 fail,1 POSIX skip. Sandbox không cho các test HTTP/deploy hoạt động đầy đủ; lần ngoài sandbox đạt exit0.
- CI main [41274633689](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41274633689) thành công49s; artifact13071350494.
- [Production41274734050](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41274734050) đã qua environment approval; promote thành công2m27s.
- Release: `4c791499859ea42bbb7214c7bd3e222b2a6a4a57-41274633689`. Receipt previous: `e1df4d2348eb9e06426afd7584c86a982c8f3278-41255894313`. Giữ rollback, không diễn tập chuyển bản trong lần này.
- Workflow xác nhận HTTP smoke, browser sản phẩm/API-test và old-client2 retained assets không dùng cache. Chạy độc lập scripts/smoke.mjs trên production đạt, bao gồm FE/BE version khớp, health/demo/JSON404 và ảnh.
- Browser production Đà Nẵng: Lora đã tải, toàn bộ href Facebook/Messenger là bidiary, footer-wordmark0; ảnh chính decode đạt. Lens background1959.98×2338.87 trên ảnh render653.325×779.624, tương ứng3×. Không gửi tin nhắn.
- Screenshot production lưu trong thư mục visualization session: ui-production-zoom.png.
