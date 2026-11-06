# Admin usability đợt 1 — kiểm chứng

Đang triển khai local, chưa push hoặc deploy. Báo cáo chỉ ghi bằng chứng đã có; full check/build/browser/review cuối còn chờ.

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
