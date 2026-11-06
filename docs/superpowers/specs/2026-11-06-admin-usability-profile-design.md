# Hoàn thiện thao tác admin và hồ sơ cá nhân

Trạng thái: bản thiết kế chờ owner duyệt, chưa phải lệnh triển khai. Owner chọn chia hai đợt; chưa cần tự đổi username hoặc mật khẩu. Code hiện tại React/TanStack/Express/MySQL trên cPanel; giữ architecture, tiếng Việt, giao diện tối giản và bundle nhẹ.

## Mục tiêu và giới hạn

Giải quyết đủ tám yêu cầu: nhận biết menu thu gọn, trạng thái không được sửa rõ ràng, giải thích multi-role, hồ sơ tự phục vụ cho non-Master, điện thoại/avatar User, cảnh báo thay đổi đúng, màu badge nhất quán, sửa lỗi tải edit phiếu. Hai đợt đều preview local và verify UI trước khi xin phát hành riêng; yêu cầu deploy trước đây không tự áp dụng cho đợt thay đổi mới này.

Không đổi công nghệ, không thêm thư viện UI lớn, không biến module sản phẩm/kinh doanh đang lưu local thành CMS backend, không thay dữ liệu phiếu hoặc reset tài khoản production. Không triển khai tự đổi username/mật khẩu, crop ảnh nâng cao hoặc chỉnh quyền của user01 trong đợt này. User01 production hiện có Admin+User; câu hỏi giữ/bỏ role Admin trước đây chưa được trả lời.

## Các hướng đã cân nhắc

1. Chia hai đợt: sửa lỗi/UX chung trước; sau đó hồ sơ và dữ liệu tài khoản. Mỗi đợt có phạm vi kiểm thử và phát hành riêng, giảm khó khoanh vùng khi lỗi. Owner chọn cách này.
2. Gộp tất cả một đợt: chỉ một lần review, nhưng thay cả form/UI lẫn schema/upload/auth cùng lúc, rollback phức tạp hơn. Không chọn.

Mỗi đợt vẫn sửa ở component/service dùng chung khi phù hợp, tránh vá từng trang bằng CSS hoặc logic trùng lặp.

## Những gì đã quan sát

- SidebarNavigation đã có title trên Link; chưa có tooltip nhất quán cho hover/focus. Dùng lại Tooltip Radix có sẵn trong primitives.
- ServerProfile dùng AccountForm/account.update; User chỉ có customer_access.view hiện nhận profile đọc thuần. AccountForm đã có fieldset disabled khi readOnly; phải tái hiện trạng thái thực và rà soát affordance/chú thích, không giả định mọi disabled đều hỏng.
- Backend quyền dạng resource.action, hợp quyền các role; fullAccess có thể bỏ qua kiểm tra permission. Admin+User vì vậy vẫn có quyền Admin. Đây là hành vi RBAC hợp lý, đề xuất giữ nguyên; User không phải role phủ định Admin.
- ComposeForm tự sinh slug bằng setValue(shouldDirty:true); TinyMCE phát onEditorChange sau khởi tạo. Đây là hướng điều tra dirty giả, chưa khẳng định nguyên nhân duy nhất.
- Trang edit PMH-2026-0002 ở production đã quan sát kẹt skeleton, chưa xác định root cause. SlipEditor resolve token số phiếu sang primary ID rồi tải record/options/role. Dữ liệu sales còn local theo trình duyệt, nên phải dùng fixture đúng trạng thái để tái hiện, không suy ra URL sai chỉ vì DB backend không có phiếu.
- Badge chung chỉ có neutral/success/warning/error; nhiều nơi dùng neutral mặc định.

## Đợt 1: lỗi tải, cảnh báo và UX chung

Thứ tự: (1) edit phiếu; (2) dirty guard sản phẩm/bài viết; (3) sidebar, readonly/disabled, badge; (4) kiểm thử hồi quy và preview.

### Edit phiếu

Tái hiện cả link trực tiếp owner đưa, đi từ danh sách/chi tiết, reload và back; giữ nguyên query returnTo. Đo trạng thái query/route/hook từ token số phiếu tới primary ID, options và role trước khi sửa. Có regression thất bại trước bản sửa.

Phiếu tồn tại phải tải được, lỗi/not-found/không quyền phải có trạng thái kết thúc rõ và retry phù hợp; không giữ skeleton khi query đã kết thúc. Kiểm tra phiếu hủy chỉ xem, phiếu trùng số báo conflict, ID cũ chuyển URL canonical, returnTo không mở redirect ngoài. Không tạo hoặc sửa phiếu production để chứng minh hoạt động.

### Cảnh báo chưa lưu

Dirty là chênh lệch ngữ nghĩa so với baseline đã tải/lưu thành công, không chỉ là đã phát event. Mount, TinyMCE chuẩn hóa HTML tương đương, tự sinh giá trị từ baseline, refetch không đổi dữ liệu và mở preview không làm dirty. Người dùng sửa nội dung/gallery/field thực sự thì có cảnh báo; sửa rồi trả về đúng baseline thì hết. Slug sinh từ tên do người dùng sửa được tính thay đổi cùng tên đó. Lưu thành công cập nhật baseline; lưu thất bại giữ dirty. Không xóa draft khi refetch hoặc đổi theme. Áp dụng create/edit sản phẩm và bài viết, kiểm tra form chung liên quan, không nới guard để che lỗi.

### Sidebar

Khi thu gọn desktop: tooltip có tên tiếng Việt bên cạnh từng icon, hiện khi hover hoặc focus, không bị vùng scroll cắt; accessible name đầy đủ, focus rõ, Escape đóng, click/Enter vẫn đi link. Không chỉ dựa title native. Khi mở rộng không hiện tooltip thừa. Giữ menu nhóm, active item, scroll, kéo độ rộng và drawer mobile. Mobile vẫn dùng menu có chữ; không bắt người dùng đoán icon.

### Readonly và common UI

Đợt 1 chỉ làm rõ trạng thái hiện tại, chưa mở quyền tự sửa hồ sơ. Master hiện thông tin readonly và lý do “Tài khoản quản trị gốc được bảo vệ”; không có nút Lưu hoạt động. Dữ liệu vẫn có thể đọc/copy; field disabled/readOnly dùng đúng ngữ nghĩa và nhãn. Nút thiếu quyền, chưa đổi dữ liệu, đang lưu hoặc không hợp lệ có trạng thái nhất quán và giải thích khi cần. Không phủ tooltip trực tiếp lên native disabled không nhận focus; dùng mô tả/wrapper phù hợp.

Rà soát Button, Field, AccountForm và form common, gồm nút Hủy/Hủy phiếu và màu chữ. Disabled frontend không thay thế backend checks. Không vô hiệu hóa mọi nút chưa chỉnh sửa nếu nó vẫn có tác dụng hợp lệ như Hủy/Quay lại/Xem trước.

### Badge

Lập inventory nhãn thực tế và nghĩa trước khi áp màu. Ánh xạ theo trạng thái miền nghiệp vụ, không dò chuỗi tiếng Việt tự động:

| Nhóm | Màu đề xuất | Ví dụ |
| --- | --- | --- |
| Thành công/đang hoạt động | xanh lá | Đã lưu, Hoạt động, Đã xuất bản |
| Chờ xử lý/cần lưu ý | vàng hổ phách | Chờ xử lý, Tồn kho thấp |
| Hủy/lỗi/nguy hiểm | đỏ dịu | Đã hủy, Thất bại |
| Chưa hoạt động/trung tính | xám | Ngừng hoạt động, Nháp |
| Thông tin/phân loại | xanh dương dịu | Có VAT; Không VAT dùng xám |
| Quyền/bảo vệ | tím dịu + icon phù hợp | Toàn quyền, Được bảo vệ |

Đây là đề xuất của agent chờ duyệt. Có VAT không phải thành công và Không VAT không phải lỗi; badge quyền/bảo vệ không giả cảnh báo. Giữ chữ/icon để phân biệt không chỉ bằng màu. Token nền/chữ/viền nhất quán cho light/dark, kiểm tra độ tương phản và badge dài/mobile. Không thay nghĩa hay trạng thái dữ liệu.

## Đợt 2: hồ sơ tự phục vụ và thông tin User

Master là tài khoản hệ thống isMaster/username admin đã bootstrap, không đồng nghĩa mọi user có role Admin. Đề xuất giữ Master bất biến như quy định cũ; mọi non-Master còn hoạt động, kể cả có role Admin, được sửa hồ sơ của chính mình. User chỉ có role User vẫn chỉ thấy module Khách truy cập và lối vào Hồ sơ cá nhân, không được mở quản lý tài khoản/role/permission.

Tách API self-profile (identity từ token, không nhận target user ID) khỏi account management. Allowlist chỉ displayName/email/phone/avatar; không nhận username/password/isMaster/roles/permissions/active/revision tùy ý. Có concurrency version như convention hiện có; bảo vệ Master ở backend, audit thay đổi nhưng không log bytes ảnh hoặc thông tin cá nhân đầy đủ. Hồ sơ không tự cấp thêm account.update cho User. Account management tiếp tục kiểm tra permission và chống tự nâng quyền.

Điện thoại optional, cho nhập số quốc tế theo chuẩn hóa rõ ràng, không tự thêm mã quốc gia hoặc dùng làm định danh đăng nhập; không yêu cầu unique. Email optional theo validation hiện có. Migrate additive nullable để tài khoản cũ vẫn dùng được; seed idempotent không reset hồ sơ/roles/password. Add DTO/UI tương ứng cho quản lý User có quyền và Hồ sơ; đây là dữ liệu MySQL thật, không chỉ cache trình duyệt. Trong quản lý User, thay ảnh/điện thoại của người khác chỉ theo account.update hiện có; không mở quyền quản trị mới.

Avatar upload/thay/xóa riêng; default initials khi chưa có ảnh/lỗi ảnh. Chỉ ảnh tĩnh hợp lệ, giới hạn dung lượng và pixel, từ chối SVG/HTML và ảnh không decode được; không chỉ tin extension/MIME. Xóa metadata và chuẩn hóa ảnh; lưu ngoài webroot trong vùng private, DB lưu tham chiếu opaque, không base64 vào bảng user. Phục vụ qua backend đã xác thực; ảnh được admin có quyền xem User và chính chủ truy cập. Không nhận URL ngoài/path từ client; không tạo endpoint đọc file tùy ý. Giới hạn/rate limit upload và dọn file orphan sau transaction lỗi; thay ảnh chỉ dọn bản cũ khi commit thành công, có chính sách giữ bản phục vụ backup.

Builder chọn decoder/resize tương thích Node24/cPanel sau khi đo footprint và kiểm chứng hosting; ưu tiên tận dụng code hiện có và tránh native dependency chưa kiểm tra. Baseline đề xuất JPEG/PNG, input tối đa2MiB/16triệu pixel, output tối đa512x512; WebP chỉ thêm nếu cùng decoder đã kiểm chứng. Đây là quyết định đề xuất của agent, không phải owner đã yêu cầu định dạng cụ thể. Upload original không rời origin hosting, frontend không có secret.

Profile cập nhật xong phản ánh ở header/sidebar sau reload/refresh; tên/email không làm thay đổi role. Đổi account/session phải xóa cache/blob URL của user trước, tránh lộ avatar giữa các tài khoản. Ghi lỗi upload/validation rõ, giữ bản ảnh cũ nếu thất bại.

## Kiểm thử và phát hành

Mỗi đợt có regression cho lỗi trước sửa; unit/integration cho logic, UI tests cho tương tác thực. Đợt 1: route edit phiếu, dirty create/edit/mount/đổi theme/lưu lỗi/đổi lại baseline; tooltip hover/focus/Escape/scroll và layout desktop/mobile; readonly/badge light/dark.

Đợt 2: MariaDB migrations/account cũ, self-only backend, request chỉnh role/target/Master bị từ chối, upload giả/quá lớn/thay-xóa/lỗi transaction, profile refresh và session isolation. User-only không được sửa nghiệp vụ; Admin+User quyền hợp như hiện tại; Master readonly. Không tái dùng user01 production có Admin để khẳng định User-only pass.

Chạy check/build và kiểm tra trực tiếp UI local với ảnh bằng chứng; owner review từng đợt. Khi được yêu cầu phát hành: đúng CI artifact, backup/native restore-check, bảo đảm schema mới tương thích release cũ và uploader cũ trước rollback; không down-migrate hoặc restore đè DB. Backend/avatar nằm trong scope đợt 2 nên phải có backup cả DB và file assets cùng manifest/hash, restore thử isolated; không coi DB backup một mình đủ cho avatar. Chưa deploy nếu auth, upload, tests hoặc UI verify thất bại.

## Còn giao builder quyết định

Tên route/module/API cụ thể theo convention; chọn decoder ảnh và phương thức streaming; bảng audit và badge inventory chi tiết; root cause phiếu sau khi trace; cách chuẩn hóa rich content để không tạo dirty giả; breakpoint/spacing/timing tooltip. Những lựa chọn này không được thay đổi quyền hoặc mở rộng tính năng ngoài thiết kế.
