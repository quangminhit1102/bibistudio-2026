> Cập nhật phát hành 02/11/2026: bản admin đã lên production tại `4c6e070`. Xem [biên bản production](superpowers/reports/2026-11-02-admin-production-release.md). Các ghi chú “chưa push/deploy” dưới đây thuộc đợt nghiệm thu local trước phát hành.

# Kết quả cuối sau review — 02/11/2026

Source `9552afa` đã sửa các lỗi review bằng5 regressions RED→GREEN: nhầm snapshot giữa hai phiếu, mất draft khi refetch lỗi (phiếu/khách), link phiếu lỗi tải mãi, filter/export không theo URL và Back. Full check cuối đạt **98 admin tests +54 tooling/API**,1 ca POSIX bỏ qua trên Windows,0 lint errors/7 warnings đã có. Full build exit0.

Preview hiện tại4181 phục vụ `local-9552afa36d9005f69212e1015795eecb629dcc79`; `/api-test` xác nhận FE/BE khớp; browser missing-ID có lỗi/retry, editor đúng khách, trang visitors hiển thị và console error logs rỗng. Artifact SHA256 `c48a7bc7f11d99ab90b396df6a51d9aed3d638e3af68615f9c43ff11168f9fac`. JS public tăng7449 byte gzip/CSS59, trong budget gốc. Tài liệu được commit sau artifact, không đổi source chạy.

Một review độc lập và một fix pass đã xong; không có review lần hai. Ba điểm nhỏ mới để sau: badge chuông còn dạng chấm; filter phiếu chưa phân biệt khách trùng tên bằng ID; bảng báo cáo chưa có footer tổng đối chiếu. Các minor baseline được giữ nguyên và ghi đủ trong [execution report](superpowers/reports/2026-11-02-admin-business-execution.md).

Không push, merge hoặc deploy. Worktree/nhánh giữ để review. Phần dưới là bằng chứng trình duyệt đầy đủ trước fix pass tại90244f3; không ghi đè lịch sử quan sát đó.

---

# Admin business workflow — nghiệm thu local 02/11/2026

Bản hiện tại trên nhánh `codex/admin-dashboard`, source commit `90244f3`. Không push/deploy. Giao diện vẫn là demo IndexedDB, chưa nối Express/MySQL cho nghiệp vụ.

| Kiểm tra mới    | Kết quả quan sát                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` | Exit 0; 42 files/93 admin tests đạt; 54 tooling/API tests đạt, 1 POSIX permission test bỏ qua trên Windows; lint 0 lỗi/7 Fast Refresh warnings đã có |
| `npm run build` | Exit 0; SSR + cPanel CSR + BE + archive/checksum; cảnh báo chunk public >500kB và vite-tsconfig-paths vẫn còn                                        |
| Budget gốc      | Public JS closure gzip 174289 → 181753 (+7464 ≤10240); CSS 11206 →11265 (+59 ≤2048)                                                                  |
| Preview         | `http://127.0.0.1:4181`; FE/BE cùng `local-90244f3ec59d9fa4940b0ed09af83ec64442e390` tại `/api-test`                                                 |
| Basepath        | Build cpanel-temp thật, `/~vhplasti/admin/bookstore/books/book-1/edit` → customers; deep slip edit/reload/cancel giữ tiền tố                         |

Artifact `.releases/local-90244f3ec59d9fa4940b0ed09af83ec64442e390.tgz`; SHA256 `dc1fcbee02f5adeac8d03e8c494d7d448a82c2777c7eed7ce274284ccc694255`. Khi build, source sạch, tài liệu đang sửa; không gọi đây là artifact production.

Thử nghiệm trình duyệt thật:

- Tạo khách `LOCAL QA 02-11`, VAT Có. Lập `PMH-2026-0015`: 2×10000 +1×15000 =35000. Reload giữ nguyên. Đổi tên khách/VAT, đổi giá sản phẩm 45000→46000: phiếu cũ vẫn tên/nhãn/giá ban đầu. Giá sản phẩm sau đó được trả về45000.
- Báo cáo lọc đúng khách cho35000; hủy có lý do thì về0. Tồn kho sản phẩm1 vẫn30/reserved0. Không reset dữ liệu người dùng.
- 375px tạo tiếp phiếu `PMH-2026-0016`, hai dòng tổng25000, Không VAT, reload còn; báo cáo25000, hủy trên mobile rồi về0. Hai phiếu kiểm thử được giữ với trạng thái đã hủy.
- Form phiếu, reports và visitors tại375/768/1024/1440: scrollWidth bằng clientWidth sau ổn định. Bảng phiếu cuộn bên trong. Dirty cancel hiện xác nhận trước khi rời.
- Visitor mobile hiển thị card và dialog cùng trang: IP/location/thiết bị–OS/browser/3 phiên; Escape đóng. 250 phiên/phân trang, Back và lỗi ID được kiểm thử tự động.
- Popup thông báo375px có x12,width351,right363 trong viewport375; desktop x943,width360; sát chuông, cuộn bên trong. Đọc tất cả cập nhật badge3→0; Escape trả focus chuông. Viewer vẫn3 chưa đọc, Super Admin vẫn0 sau đăng nhập lại. Popup dark nhận đúng theme.
- `/admin/sales/order-history` và `/admin/sales/transactions` đều chuyển về phiếu, thao tác không treo. Alias ID sách không được đổi thành ID khách.
- Assets quan sát trên home/product chỉ gồm bốn script public, không admin/chart/editor/seed. Customers/slips list không có chart hoặc rich-editor. Ảnh Đà Lạt chính/gallery tải được; ảnh related ngoài viewport còn lazy. Link Facebook/Messenger dùng bidiary. `/api-test` kết nối thật tới Express preview và FE/BE khớp.

Các lỗi quota, mutation pending/session switch, thông báo không link, đọc tất cả ngoài trang và250 phiên được thử bằng fake-indexeddb/Query/UI integration tests; không cố tình làm hỏng DB review để ép lỗi trên browser. Zoom geometry có automated regression, không ghi nhận một phép đo hover mới trong đợt admin này. Một watcher fixture timeout ở lượt full check đầu; chạy riêng và full check sau đó đều đạt, không sửa tooling để che lỗi.

Bằng chứng và phạm vi review cuối nằm trong [execution report](superpowers/reports/2026-11-02-admin-business-execution.md). Ảnh/log JSON local trong thư mục visualizations của chat, tiền tố `admin-business-`.

---

## Biên bản 01/11 dưới đây là lịch sử trước đợt đổi nghiệp vụ

Các đường dẫn/quy tắc đơn hàng và số đo cũ dưới đây không mô tả giao diện hiện tại.

# Biên bản kiểm chứng admin local

Ngày 01/11/2026, Windows, Node24. Source ứng dụng đã kiểm chứng: `a751c59f807607c7dca71e8fbe06790f508af2a4`, nhánh `codex/admin-dashboard`. Chỉ triển khai local; không push, merge hoặc deploy production.

## Kết quả lệnh

| Kiểm tra                               | Kết quả thực tế                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                        | Exit0: TypeScript đạt, lint0 errors/7 cảnh báo Fast Refresh, ảnh catalogue đạt,49 admin tests đạt;54 tooling/API tests đạt và1 test POSIX permissions bỏ qua trên Windows |
| `npm run build`                        | Exit0: FE SSR + cPanel CSR, backend TypeScript, archive và SHA256 sidecar đã tạo                                                                                          |
| `node scripts/admin-bundle-report.mjs` | Exit0; closure JS public174289→181432 byte gzip (+7143, ngưỡng10240); CSS11206→11265 (+59, ngưỡng2048)                                                                    |
| Build `cpanel-temp` và deep reload     | Form `/~vhplasti/admin/products/product-2/edit` mở đúng; links giữ tiền tố; ảnh public dưới `/~vhplasti/catalogue/` đã tải thật                                           |
| Preview FE/Express                     | `http://127.0.0.1:4181/api-test` báo kết nối thành công; FE/BE cùng release `local-a751c59f807607c7dca71e8fbe06790f508af2a4`                                              |

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
