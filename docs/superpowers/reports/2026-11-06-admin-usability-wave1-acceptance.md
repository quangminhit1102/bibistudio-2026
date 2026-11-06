# Admin usability đợt 1 — kiểm chứng

Đang hoàn tất kiểm chứng local, chưa push hoặc deploy. Full check đã đạt; build/budget/compiled preview và review cuối còn chờ.

## Các bản sửa và bằng chứng

- Phiếu `PMH-2026-0002/edit`: HTTP session không dùng query role local. Query bị disabled vẫn có `isPending=true`, nên màn edit chờ vô hạn dù đã tải phiếu và options. Chuyển điều kiện đợi sang `isLoading`; giữ nguyên kiểm tra quyền từ HTTP principal. Regression trước sửa thất bại, sau sửa4file20test đạt, gồm ID khác số phiếu, canonical URL, returnTo, không tồn tại/trùng số, thiếu quyền, lỗi options và phiếu đã hủy.
- Form sản phẩm/bài viết: baseline nội dung ngữ nghĩa thay vì chỉ `react-hook-form.isDirty`; chuẩn hóa nội dung HTML rỗng và b/strong, i/em. Không bỏ qua thay đổi ảnh/thứ tự gallery, định dạng, link hoặc khoảng trắng trường thường. Save thành công mới thay baseline; save lỗi/refetch không xóa draft.6file15test đạt sau regression RED.
- Sidebar: tooltip Radix portal bên phải, chỉ khi thu gọn trên desktop; nhãn accessible độc lập span bị ẩn. Hover/focus mở, Escape đóng, không thêm native title trùng.4file24test đạt.
- AccountForm: Master/view-only có lý do rõ, trường readonly vẫn focus/copy được; không cho submit thay đổi, Save của account thường chỉ bật khi dirty; Hủy/Quay lại không phụ thuộc dirty.3file9test đạt. Backend/RBAC không đổi.
- Badge: semantic mapping theo domain/state, giá trị không biết về neutral; sáu palette hỗ trợ light/dark, không chỉ dựa vào màu.6file30test đạt. Inventory bên dưới.

Browser acceptance dùng MariaDB test schema ngẫu nhiên + compiled Express + React/TinyMCE thật + Chromium. Trình duyệt/origin mới cô lập IndexedDB, không đọc DB hosting hoặc dữ liệu local người dùng. Đã qua deep-link và list→detail→edit phiếu, hai form create pristine/theme/revert/gõ thật, guard điều hướng và beforeunload, Master readonly, tooltip hover/focus/Escape/vị trí/cạnh viewport sau cuộn, menu mobile, badge light/dark. Text/background contrast cả6tone >=4.5:1; document không tràn ngang ở390px. Bài test dùng CSS font fallback bằng response font stylesheet rỗng để không phụ thuộc Google Fonts; không mock editor, route hoặc API nghiệp vụ.

Evidence local: `.superpowers/e2e/admin-usability/*.png` (1440×1000 và390×844); screenshot đợi chuyển cảnh hoàn tất, không dùng ảnh skeleton/transition. Mobile editor thực đã kiểm tra không tràn ngang.

`npm run check` Node24 exit0:95file253test admin,209test API/tooling đạt +4skip dành cho Linux (flock/symlink/POSIX permissions), watcher phục hồi1test và3browser suite auth/access logs/usability đều đạt. Lint0error/10warning hiện có. Lượt đầu thất bại tại assertion E2E cũ còn tìm lời nhắc Master trước sửa và đòi disabled; đã cập nhật assertion enabled+noteditable+readonly theo thiết kế duyệt rồi chạy lại toàn bộ check đạt. Không hạ kiểm tra immutability backend.

## Phạm vi giữ lại

Đợt2 theo spec đã duyệt mới thêm self-profile API/phone/avatar và quyền tự sửa hồ sơ. Admin+User vẫn là cộng quyền hợp lệ; không tự đổi role của user01 trên production. Không migration/schema/auth thay đổi trong đợt1. Các dữ liệu catalogue/bài viết/phiếu vẫn ở store trình duyệt như kiến trúc hiện tại.

## Inventory badge trước sửa (Task5)

| Exact call sites dưới src/features/admin | Stable state / nghĩa | Hiện tại → đề xuất |
| --- | --- | --- |
| sales/pages/slips.tsx; sales/pages/slip-detail.tsx | saved/void: Đã lưu/Đã hủy | neutral → success/error |
| sales/components/slip-form.tsx; sales/pages/slips.tsx; sales/pages/slip-detail.tsx; customers/config.tsx; customers/pages/detail.tsx | vatApplied boolean: Có VAT/Không VAT | neutral → info/neutral |
| customers/config.tsx | active boolean: Hoạt động/Ngừng hoạt động | neutral → success/neutral |
| accounts/server-accounts.tsx; accounts/server-account-detail.tsx; accounts/config.tsx | active/inactive | success/neutral giữ nguyên |
| accounts/server-accounts.tsx | isMaster: Quản trị chính | neutral → privilege + lock |
| accounts/server-roles.tsx | fullAccess / protected: Toàn quyền/Được bảo vệ | neutral → privilege, protected + lock |
| products/config.tsx | published/draft/archived | success/warning/neutral → success/neutral/neutral |
| content/config.tsx; bookstore/config.tsx | published/draft | success/warning → success/neutral |
| dashboard/pages/dashboard.tsx | saved/void, stock-low | success/neutral → success/error; stock warning giữ |
| notifications/pages/notifications.tsx | read/unread | neutral/warning giữ |
| sales/pages/orders.tsx; sales/pages/order-detail.tsx; sales/pages/transactions.tsx | Legacy order/payment enum, chỉ route alias cũ không phải phiếu hiện tại | Giữ nghĩa/màu đang có; không đổi thành status của phiếu |
| components/data-display.tsx | showcase tone samples, +5 trong tháng | Bổ sung info/privilege samples; success giữ |

Common controls đã đọc: AccountForm Master trước dùng disabled fieldset, không focus/copy; sửa readonly + lý do rõ; edit pristine Save disabled, cancel/back không phụ thuộc dirty. ComposeForm save gated ready/busy/writeBlocked; RecordForm cancel busy-only; VoidSlip confirm/cancel busy-only; server roles/permissions apply cần có thay đổi; legacy profile Hủy là hủy thay đổi nên dirty-dependent là đúng. Không thay backend permissions.
