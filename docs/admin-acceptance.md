# Biên bản kiểm chứng admin local

Ngày 01/11/2026, Windows, Node24. Source ứng dụng đã kiểm chứng: `a751c59f807607c7dca71e8fbe06790f508af2a4`, nhánh `codex/admin-dashboard`. Chỉ triển khai local; không push, merge hoặc deploy production.

## Kết quả lệnh

| Kiểm tra | Kết quả thực tế |
|---|---|
| `npm run check` | Exit0: TypeScript đạt, lint0 errors/7 cảnh báo Fast Refresh, ảnh catalogue đạt,49 admin tests đạt;54 tooling/API tests đạt và1 test POSIX permissions bỏ qua trên Windows |
| `npm run build` | Exit0: FE SSR + cPanel CSR, backend TypeScript, archive và SHA256 sidecar đã tạo |
| `node scripts/admin-bundle-report.mjs` | Exit0; closure JS public174289→181432 byte gzip (+7143, ngưỡng10240); CSS11206→11265 (+59, ngưỡng2048) |
| Build `cpanel-temp` và deep reload | Form `/~vhplasti/admin/products/product-2/edit` mở đúng; links giữ tiền tố; ảnh public dưới `/~vhplasti/catalogue/` đã tải thật |
| Preview FE/Express | `http://127.0.0.1:4181/api-test` báo kết nối thành công; FE/BE cùng release `local-a751c59f807607c7dca71e8fbe06790f508af2a4` |

Artifact local: `.releases/local-a751c59f807607c7dca71e8fbe06790f508af2a4.tgz` cùng `.sha256`. Preview chính: `http://127.0.0.1:4181/admin/dashboard`. Đây không phải nghiệm thu trên cPanel/production thật.

## Trình duyệt đã kiểm chứng

- Tạo sản phẩm `LOCAL-REVIEW-001`:50→51 bản ghi, refresh còn dữ liệu. Tạo bài viết với rich editor, mở chi tiết đọc lại đúng nội dung tiếng Việt đã nhập.
- Manager đăng nhập, mở Edit sản phẩm, nhập ảnh WebP và lưu thành công dù không có quyền Content. Ảnh lưu cục bộ, không upload hosting.
- Đơn `BIBI-1001` đi Pending→Confirmed→Processing→Cancelled qua hộp xác nhận. Timeline lưu đủ; chi tiết sản phẩm sau hủy có stock30/reserved0.
- Chi tiết `/admin/accounts/users/user-1` hiển thị đúng Minh Nguyễn. Tìm `da nang` cho kết quả Đà Nẵng và mở đúng sản phẩm.
- Editor dashboard không có panel khách hàng đơn hàng, visitor chi tiết hoặc audit bị từ chối. Đăng xuất trong một tab đưa tab thứ hai về màn đăng nhập, không reload.
- Reset có bước xác nhận; Hủy giữ dữ liệu. Việc xóa/reset, tái tạo seed và giữ namespace public được kiểm tra bằng automated tests; không xóa dữ liệu review của người dùng để chụp ảnh.
- Dashboard, products/list và forms showcase ở375/768/1024/1440/1920px:15 trường hợp không có overflow ngang toàn trang hoặc ErrorState. Bảng cuộn bên trong container.
- Light/dark đã mở thật. Drawer mobile mở/đóng bằng Escape, focus quay về nút mở. Reduced motion được kiểm tra qua CSS rule và chart animations=false; không giả lập thiết lập OS trong trình duyệt.
- Network trên `/` và product detail chỉ tải public scripts/styles, không tải admin/chart/editor/seed. Mở riêng products/list không tải chart hoặc rich-editor chunks.
- Có regression mới cho toàn bộ ảnh catalogue viết trực tiếp và descriptor dưới basepath cPanel. Production `/catalogue/...` giữ nguyên URL.

## Review độc lập

Reviewer kiểm tra toàn nhánh tại `e433e44`. Đợt sửa đã xử lý các Important findings: snapshot/revision và reserved của form cũ; seed tham chiếu trước khi xóa; quyền reset; mutation của phiên cũ và đồng bộ session qua tab; bảo vệ Super Admin khi xóa; giới hạn dữ liệu chi tiết dashboard; ledger của stock edit và reset reservation khi duplicate; ngày theo múi giờ Việt Nam; quyền media theo catalogue; bộ lọc sách, nhân bản bài viết, chi tiết user và usage code component thực tế.

Regression đã quan sát RED→GREEN cho các nhóm trên, gồm snapshot tái hiện revision2 rồi xác nhận dùng revision1. Test đồng bộ StorageEvent được bổ sung sau implementation và đã đạt; không ghi nhận RED cho test đó. Suite cuối49/49 đạt. Không chạy review thứ hai; fix pass được kiểm chứng bằng regression và full suite.

Test watcher từng qua assertions nhưng còn job dependency optimizer nền. Đã cô lập cache và tắt prebundle riêng fixture HTTP (fixture không tải frontend modules); test riêng và full check đều kết thúc exit0. Dev thật vẫn prebundle mặc định.

## Ba điểm nhỏ để review sau

1. Search dựa trên JSON có thể không khớp tên chứa dấu ngoặc kép khi tìm nguyên văn; tìm tiếng Việt không dấu thông thường đã đạt.
2. Viewer còn thấy Edit ở một số trang chi tiết; bấm vào nhận thông báo thiếu quyền, không ghi được dữ liệu.
3. Attachment picker dùng nút chọn file, chưa kéo/thả; thư viện media riêng hỗ trợ kéo/thả.

## Phạm vi và bằng chứng

Giữ TanStack Table8.21.3 để phù hợp API đã kiểm thử; nâng v9 là việc riêng. Tích hợp các module trước khi chốt showcase, rồi dùng một review toàn nhánh để kiểm tra các giao diện chung. Backend auth/MySQL/thanh toán/tracking thật vẫn ngoài phạm vi demo. Các ca HTML/CSV/Unicode đã kiểm tra không thay thế một đợt security audit toàn diện.

Baseline có provenance và hash tại `admin-baseline.json`; số đo cuối tại `admin-performance.json`. Inventory routes nằm trong `src/routes/admin*.tsx`, inventory96 ví dụ UI nằm trong `src/features/admin/components/catalogue.ts` và có usage snippets ở `usage.ts`.

Ảnh và log bằng chứng local nằm trong `C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/`: `admin-desktop-light-accepted.jpg`, `admin-desktop-accepted.jpg` (dark), `admin-mobile-accepted.jpg`, `admin-responsive-accepted.json`, `admin-public-network-accepted.json`, `admin-product-list-network-accepted.json`, `admin-check-accepted.log`, `admin-build-accepted.log`.
