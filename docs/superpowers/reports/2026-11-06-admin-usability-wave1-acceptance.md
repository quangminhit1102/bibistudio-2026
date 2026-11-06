# Admin usability đợt 1 — kiểm chứng

Đợt1 đã hoàn tất kiểm chứng local, chưa push hoặc deploy. Bản đầu đã qua full check/build/budget và compiled preview; review độc lập phát hiện3regression đã sửa với test RED→GREEN. Toàn bộ check/build/budget và compiled preview sau sửa đều đạt tại source `e27102c`.

## Các bản sửa và bằng chứng

- Phiếu `PMH-2026-0002/edit`: HTTP session không dùng query role local. Query bị disabled vẫn có `isPending=true`, nên màn edit chờ vô hạn dù đã tải phiếu và options. Chuyển điều kiện đợi sang `isLoading`; giữ nguyên kiểm tra quyền từ HTTP principal. Regression trước sửa thất bại, sau sửa4file20test đạt, gồm ID khác số phiếu, canonical URL, returnTo, không tồn tại/trùng số, thiếu quyền, lỗi options và phiếu đã hủy.
- Form sản phẩm/bài viết: baseline nội dung ngữ nghĩa thay vì chỉ `react-hook-form.isDirty`; chuẩn hóa nội dung HTML rỗng và b/strong, i/em. Không bỏ qua thay đổi ảnh/thứ tự gallery, định dạng, link hoặc khoảng trắng trường thường. Save thành công mới thay baseline; save lỗi/refetch không xóa draft.6file15test đạt sau regression RED.
- Sidebar: tooltip Radix portal bên phải, chỉ khi thu gọn trên desktop; nhãn accessible độc lập span bị ẩn. Hover/focus mở, Escape đóng, không thêm native title trùng.4file24test đạt.
- AccountForm: Master/view-only có lý do rõ, trường readonly vẫn focus/copy được; không cho submit thay đổi, Save của account thường chỉ bật khi dirty; Hủy/Quay lại không phụ thuộc dirty.3file9test đạt. Backend/RBAC không đổi.
- Badge: semantic mapping theo domain/state, giá trị không biết về neutral; sáu palette hỗ trợ light/dark, không chỉ dựa vào màu.6file30test đạt. Inventory bên dưới.

Browser acceptance dùng MariaDB test schema ngẫu nhiên + compiled Express + React/TinyMCE thật + Chromium. Browser context mới cô lập IndexedDB với trình duyệt người dùng, không đọc DB hosting hoặc dữ liệu local người dùng. Đã qua deep-link và list→detail→edit phiếu, hai form create pristine/theme/revert/gõ thật, guard điều hướng và beforeunload, Master readonly, tooltip hover/focus/Escape/vị trí/cạnh viewport sau cuộn, menu mobile, badge light/dark. Text/background contrast cả6tone >=4.5:1; document không tràn ngang ở390px. Bài test dùng CSS font fallback bằng response font stylesheet rỗng để không phụ thuộc Google Fonts; không mock editor, route hoặc API nghiệp vụ.

Evidence local: `.superpowers/e2e/admin-usability/*.png` (1440×1000 và390×844); screenshot đợi chuyển cảnh hoàn tất, không dùng ảnh skeleton/transition. Mobile editor thực đã kiểm tra không tràn ngang.

`npm run check` Node24 exit0:95file256test admin sau sửa review,209test API/tooling đạt +4skip dành cho Linux (flock/symlink/POSIX permissions), watcher phục hồi1test và3browser suite auth/access logs/usability đều đạt. Lint0error/10warning hiện có. Lượt đầu thất bại tại assertion E2E cũ còn tìm lời nhắc Master trước sửa và đòi disabled; đã cập nhật assertion enabled+noteditable+readonly theo thiết kế duyệt rồi chạy lại toàn bộ check đạt. Không hạ kiểm tra immutability backend.

`npm run build` exit0 tạo release `local-e27102cd49575ec06215b0842dd90c732d70d0b0`. `node scripts/admin-bundle-report.mjs` exit0: public initial JS gzip182977byte, delta8688byte so với baseline repo (giới hạn10240); CSS gzip11519byte, delta313byte (giới hạn2048). Manifest initial graph không chứa module admin. Vite vẫn cảnh báo chunk public >500kB như hiện tại; budget không vượt.

Compiled preview `http://127.0.0.1:4199/admin` dùng DB develop loopback đã guard; không migrate/seed/reset dữ liệu. Edge thực: dashboard→PMH-2026-0002→Chỉnh sửa tải đầy đủ form; thu gọn sidebar và focus icon mở tooltip, Escape đóng; TinyMCE local trên create sản phẩm tải xong, rời form chưa sửa không bị hỏi; Hồ sơ Master hiện readonly và lý do khóa. Không lưu thay đổi dữ liệu nghiệp vụ trong lượt manual. Tab được giữ tại Hồ sơ cho owner review. Bằng chứng: `.superpowers/e2e/admin-usability/compiled-slip-tooltip.png`. Preview đã thay sang sourceSHA e27102cd49575ec06215b0842dd90c732d70d0b0 và đối chiếu /api/version. Sau reload Edge đã kiểm tra tooltip focus/Escape ở900px, khôi phục viewport desktop. Bằng chứng mới: `.superpowers/e2e/admin-usability/compiled-tablet-tooltip-final.png`. Commit tài liệu/chú thích sau e27102c không thay mã thực thi ứng dụng hoặc test.

## Phạm vi giữ lại

Đợt2 theo spec đã duyệt mới thêm self-profile API/phone/avatar và quyền tự sửa hồ sơ. Admin+User vẫn là cộng quyền hợp lệ; không tự đổi role của user01 trên production. Không migration/schema/auth thay đổi trong đợt1. Các dữ liệu catalogue/bài viết/phiếu vẫn ở store trình duyệt như kiến trúc hiện tại.

## Review độc lập và xử lý

Một reviewer fresh-context đã review toàn bộ range76dd885..4ec83ef; không có Critical, có3Important và1Minor. Không dispatch lượt review thứ hai; các bản sửa được kiểm chứng bằng regression và full suite theo quy trình native.

- Important: HTML TinyMCE chuẩn hóa xuống dòng giữa block làm Undo vẫn dirty. Unit RED đã tái hiện; actual seeded-editor còn cho thấy TinyMCE đổi thứ tự thuộc tính ảnh. Thêm regression RED cho thứ tự thuộc tính, chuẩn hóa chúng và whitespace ở ranh giới block. Vẫn giữ khác biệt inline/pre whitespace, media ID, alt, link, formatting. Unit và actual edit seeded post→gõ→Undo→rời trang đều GREEN.
- Important: date seed `2026-08-25` và ISO `2026-08-24T17:00:00.000Z` là cùng ngày hiển thị Việt Nam nhưng bị so chuỗi khác. Regression RED; dùng `calendarDate` cùng UI; actual input đổi ngày rồi trả về ngày cũ, beforeunload và điều hướng GREEN.
- Important: CSS rail768–1023px ẩn label nhưng React chưa collapsed nên không có focus tooltip. Browser900px RED; theo dõi đúng media query CSS để bật tooltip, không áp dụng cho mobile drawer. Browser900px focus/Escape và resize1440px GREEN.
- Minor để lại: cache fingerprint baseline và rich body khi nhập trường khác, tránh parse/sanitize hai body mỗi render. Reviewer đo jsdom khoảng18ms/100đoạn; chưa đo browser, chưa chứng minh lỗi tương tác thực. Không ghép tối ưu chưa duyệt vào lượt fix. Chi phí: bài viết rất dài có thể tốn thêm CPU khi gõ.

Quyết định phạm vi: self-profile API/phone/avatar/migrations/production role changes giữ đợt2 theo spec (chi phí: chưa có các khả năng này trong đợt1). Deploy/hosting/rollback đợt1 chưa thực hiện vì chỉ bàn giao local review (chi phí: phải kiểm chứng hosting ở lần phát hành được duyệt). Functional browser test dùng fallback font để tránh mạng ngoài; chi phí là test đó không chứng minh custom webfont, đã kiểm tra riêng compiled Edge bình thường. Main/admin modules được warmup trong harness, không tăng timeout để che lỗi UI.

## Tệp thay đổi

Các đường dẫn dưới đây tương đối với repository; inventory badge chi tiết ở phần sau.

| Nhóm | Tệp |
| --- | --- |
| Loading phiếu | `src/features/admin/sales/pages/slip-editor.tsx` |
| Dirty guard | `src/features/admin/shared/forms/compose-form.tsx`, `form-baseline.ts` |
| Sidebar | `src/features/admin/shell/admin-layout.tsx`, `sidebar-navigation.tsx` |
| Controls/Badge | `src/features/admin/accounts/account-form.tsx`, `shared/ui/primitives.tsx`, `shared/ui/status-badges.ts`, `admin.css`; call sites theo inventory bên dưới |
| Regression | `tests/admin/slip-editor-route.test.tsx`, `form-baseline.test.ts`, `editor-unsaved-guard.test.tsx`, `sidebar-tooltips.test.tsx`, `status-badges.test.tsx`, `server-profile.test.tsx`, `server-account-ui.test.tsx` |
| Browser/CI | `tests/e2e/admin-usability.spec.mjs`, `tests/e2e/auth.spec.mjs`, `scripts/auth-ui-check.mjs`, `.github/workflows/ci.yml` |
| Tài liệu | `docs/admin.md`, `docs/build-and-deploy.md`, biên bản này; spec/plan đã duyệt trong `docs/superpowers/` |

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
