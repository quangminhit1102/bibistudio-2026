# Thiết kế: số liệu ảnh trong Thư viện ảnh, hồ sơ của quản trị viên chính, đổi mật khẩu trong Hồ sơ (đợt 1)

- Ngày: 2026-11-24
- Trạng thái: đã duyệt (2026-11-24)
- Nền: `main` sau khi PR #14 merge (nhánh làm việc dựng trên đỉnh PR #14, `5f095af`)
- Phạm vi: đợt 1 trong 5 yêu cầu ngày 24/11 của chủ repo, gồm yêu cầu 3, 4, 5. Không đổi DB, không đổi `ops/`.
- Ngoài phạm vi (đợt 2, thiết kế riêng): import khách hàng từ Excel, đơn giản hóa tồn kho. Hai việc đó cần migration nội dung thứ tư.

## 1. Yêu cầu (lời chủ repo)

3. "Các kích thước và size ảnh vẫn đang không được hiển thị chính xác mà chỉ hiển thị `— · —`"
4. "Tôi muốn quản trị viên cũng có thể update thông tin profile tương tự như user"
5. "Cho phép người dùng đổi mật khẩu trong profile"

Ràng buộc chung: giữ kiến trúc hiện tại, giao diện đơn giản, dễ dùng; duyệt kế hoạch trước khi implement; kiểm thử và chạy local, tốt thì deploy production.

## 2. Hiện trạng (đã kiểm bằng đọc code)

**Ảnh.** Trang Thư viện ảnh (`src/features/admin/content/pages/media.tsx`) liệt kê bản ghi `media` trong kho của trình duyệt. Mỗi ảnh hiện `kích thước · dung lượng` qua `formatDimensions` và `formatBytes`; giá trị 0 hiện thành `—`. Ảnh có sẵn của site (ảnh sản phẩm ở `/catalogue`, ảnh bài viết ở `/journal`) được seed với `size: 0, width: 0, height: 0` và một `url` công khai (`src/features/admin/products/seed.ts`, `src/features/admin/content/seed.ts`). Vì vậy mọi ảnh có sẵn hiện `— · —`; chỉ ảnh người dùng tự nhập mới có số liệu. Seed cũng ghi cứng định dạng: mọi ảnh sản phẩm là `image/webp` (thực tế 29 trong 92 file ở `public/catalogue` là JPEG), mọi ảnh bài viết là `image/jpeg`.

**Hồ sơ quản trị viên chính.** Tài khoản có `users.is_master` bị chặn sửa hồ sơ của chính mình ở ba chỗ:
- `backend/src/profile/service.ts`, `updateSelf`: trả 403 `PROTECTED_ACCOUNT`.
- `backend/src/profile/avatar-service.ts`, `mutable`: trả 403 `PROTECTED_ACCOUNT` cho mọi thao tác ảnh đại diện.
- Giao diện: `self-profile-form.tsx` để các ô chỉ đọc và thay nút Lưu bằng ghi chú "Tài khoản quản trị gốc được bảo vệ"; `avatar-editor.tsx` khóa khi `user.isMaster`.

Đây là quyết định cũ, ghi ở `docs/admin-auth-api.md` ("Backend từ chối thay đổi thông tin, mật khẩu, trạng thái, xóa hoặc đổi vai trò của tài khoản này, kể cả chính nó"). Yêu cầu 4 và 5 thay đổi quyết định đó cho phần "chính nó".

**Mật khẩu.** Không có đường tự đổi mật khẩu. Chỉ người có quyền `account.update` đặt mật khẩu cho tài khoản khác (`PATCH /api/accounts/:id`, `backend/src/accounts/service.ts`); thao tác đó thu hồi mọi phiên của tài khoản bị đổi. Quy tắc mật khẩu hiện có: ít nhất 8 ký tự, không quá 72 byte UTF-8, băm bcrypt cost 12 (`backend/src/auth/password.ts`). Giới hạn số lần gọi đã có sẵn: `consumeRateLimit` (`backend/src/auth/throttle.ts`), đang dùng cho đăng nhập.

**Phiên.** Mỗi lần đăng nhập là một dòng `refresh_token_sessions`. Mọi request có đăng nhập đều kiểm phiên của mình còn hiệu lực (`backend/src/auth/service.ts`, `backend/src/authorization/transaction.ts`), nên thu hồi một phiên có hiệu lực ngay ở request kế tiếp của thiết bị đó.

## 3. Thiết kế

### 3.1. Số liệu ảnh trong Thư viện ảnh

**Cách làm đã chọn:** với ảnh chưa có số liệu, đo file thật khi hiển thị.

- Thêm `src/features/admin/content/media/facts.ts`:
  - `measureImage(url)`: tải file (`fetch`), lấy dung lượng và định dạng từ dữ liệu nhận được, lấy chiều rộng và chiều cao bằng cách giải mã ảnh. Chỉ nhận đường dẫn công khai cùng site (cùng kiểm tra với `publicPath` trong `media/resolve.ts`).
  - `useMediaFacts(asset)`: nếu bản ghi đã có `width`, `height`, `size` lớn hơn 0 thì dùng luôn; nếu chưa có và bản ghi có `url` thì gọi `measureImage` qua React Query (khóa theo `url`, không tải lại trong phiên làm việc).
- `media.tsx` dùng `useMediaFacts` cho dòng số liệu ở lưới, ở danh sách và trong hộp xem ảnh. Đang đo hiện `…`; đo lỗi (file không còn) hiện `—` như cũ. Định dạng trong hộp xem ảnh lấy theo file thật khi đã đo.
- Không ghi số liệu đã đo vào kho: seed và phần nâng cấp seed chỉ sửa bản ghi còn nguyên trạng, ghi thêm sẽ làm chúng thành "đã sửa".
- Trình duyệt đã tải các file này để hiện ảnh thu nhỏ, nên lần tải để đo lấy từ bộ nhớ đệm của trình duyệt.

**Cách không chọn:** sinh sẵn bảng số liệu lúc build (script đọc mọi ảnh trong `public/` của site). Chính xác tương đương, nhưng thêm một bước build, thêm file sinh ra phải giữ đồng bộ với ảnh, và mỗi site mới phải chạy nó. Chưa cần.

**Không đổi:** lọc theo định dạng vẫn dùng giá trị đã lưu; ảnh tải lên server từ ô chọn ảnh của sản phẩm và bài viết vẫn không nằm trong trang này (việc đó là một thay đổi khác, không thuộc yêu cầu).

### 3.2. Quản trị viên chính sửa hồ sơ của chính mình

- `backend/src/profile/service.ts`, `updateSelf`: bỏ nhánh từ chối `is_master`. Quản trị viên chính sửa được tên hiển thị, email, số điện thoại của mình, qua đúng kiểm tra đầu vào, kiểm `revision` và nhật ký `profile.update` như mọi tài khoản.
- `backend/src/profile/avatar-service.ts`: `mutable` chỉ từ chối `is_master` khi người thao tác không phải chính tài khoản đó (đường `/api/accounts/:id/avatar`). Đường `/api/profile/avatar` cho phép.
- Giữ nguyên: `backend/src/accounts/service.ts` vẫn từ chối mọi thay đổi tài khoản quản trị chính từ trang Tài khoản (thông tin, mật khẩu, trạng thái, vai trò, xóa), kể cả do chính nó gọi; tên đăng nhập và vai trò không sửa được trong Hồ sơ.
- Giao diện: `self-profile-form.tsx` bỏ chế độ chỉ đọc và ghi chú "được bảo vệ" (form này chỉ dùng cho hồ sơ của chính mình). `avatar-editor.tsx` chỉ khóa tài khoản quản trị chính khi đang sửa hộ người khác (trang chi tiết tài khoản).
- Chế độ dữ liệu trên trình duyệt (`FixtureProfile`): không đổi, ở đó hồ sơ đã sửa được.

### 3.3. Đổi mật khẩu trong Hồ sơ

**API mới:** `POST /api/profile/password`, thân `{ currentPassword, newPassword }` (strict), trả hồ sơ mới (`ProfileDto`, có `revision` mới).

Thứ tự xử lý:
1. Phải đăng nhập, đúng Origin của site (`requireBrowserOrigin`, như `PATCH /api/profile`).
2. Giới hạn số lần: 5 lần trong 15 phút cho mỗi tài khoản, 30 lần trong 15 phút cho mỗi dải mạng; quá thì 429 `RATE_LIMITED` kèm `Retry-After`. Tính cả lần đúng lẫn lần sai.
3. Kiểm đầu vào: mật khẩu mới ít nhất 8 ký tự, không quá 72 byte (cùng quy tắc với trang Tài khoản).
4. Trong một transaction có khóa dòng tài khoản: so `currentPassword` với hash đang lưu. Sai thì 400 `INVALID_CURRENT_PASSWORD` ("Mật khẩu hiện tại không đúng"). Không dùng 401, vì 401 làm giao diện coi như hết phiên.
5. Mật khẩu mới trùng mật khẩu hiện tại thì 400 `PASSWORD_UNCHANGED`.
6. Ghi hash mới, tăng `revision`, thu hồi mọi phiên khác của tài khoản (`revoke_reason = 'password_changed'`), giữ phiên đang dùng. Không tăng `auth_version`, vì tăng sẽ đăng xuất cả phiên đang dùng.
7. Ghi nhật ký `profile.password_change` (ai, lúc nào, số phiên bị thu hồi). Không ghi mật khẩu hay hash vào nhật ký, log hay thông báo lỗi.

Áp dụng cho mọi tài khoản đang hoạt động, kể cả quản trị viên chính. Lưu ý vận hành: mật khẩu của quản trị viên chính lấy từ biến môi trường chỉ ở lần seed đầu; sau khi đổi trong Hồ sơ, giá trị trong biến môi trường không còn là mật khẩu đang dùng. Nếu quên, chỉ khôi phục được bằng thao tác trên DB, vì không ai khác được đặt mật khẩu cho tài khoản này.

**Giao diện:** thêm thẻ "Đổi mật khẩu" trong trang Hồ sơ (`server-profile.tsx`), dưới thẻ "Thông tin tài khoản", là một form riêng (`password-form.tsx`):
- Ba ô: Mật khẩu hiện tại, Mật khẩu mới, Nhập lại mật khẩu mới (`autocomplete` đúng loại để trình quản lý mật khẩu nhận ra).
- Kiểm ngay trên form: mật khẩu mới ít nhất 8 ký tự, hai ô mới khớp nhau, khác mật khẩu hiện tại. Lỗi hiện ngay dưới form.
- Thành công: xóa ba ô, thông báo "Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.", cập nhật hồ sơ đang mở bằng `revision` mới để form thông tin không báo xung đột.
- Ba ô mật khẩu không tính vào cảnh báo "chưa lưu" khi rời trang.
- Chế độ dữ liệu trên trình duyệt không có mật khẩu, nên không có thẻ này.

## 4. Kiểm thử

Viết test trước, theo từng phần:

- **Ảnh** (`tests/admin`): bản ghi có số liệu thì không đo; bản ghi seed (số liệu 0, có `url`) hiện đúng kích thước và dung lượng sau khi đo; đo lỗi hiện `—`; đường dẫn không hợp lệ không được tải.
- **Hồ sơ quản trị viên chính** (`backend/test`, `tests/admin`): tài khoản chính sửa được tên, email, điện thoại và ảnh đại diện của mình; người khác có quyền `account.update` vẫn bị từ chối khi sửa tài khoản chính, kể cả ảnh đại diện; tài khoản chính vẫn không tự đổi được vai trò, trạng thái, tên đăng nhập; form không còn chỉ đọc.
- **Đổi mật khẩu** (`backend/test`, `tests/admin`): đổi đúng thì đăng nhập được bằng mật khẩu mới và không được bằng mật khẩu cũ; phiên đang dùng còn, phiên khác bị từ chối; sai mật khẩu hiện tại trả 400 và không đổi gì; mật khẩu mới ngắn, quá 72 byte hoặc trùng cũ bị từ chối; thiếu Origin bị từ chối; quá 5 lần trả 429; nhật ký có `profile.password_change` và không chứa mật khẩu; form báo lỗi khi hai ô mới không khớp.
- **Toàn bộ:** `npm run check` (gồm nhóm `blank-site`), build.
- **Chạy local:** backend với MariaDB local, đăng nhập bằng tài khoản chính và một tài khoản thường, đi qua ba luồng trên trình duyệt (có ghi hình).

## 5. Triển khai

- Một PR vào `main` (sau khi PR #14 merge). Không có migration, không đổi deploy tools, nên không cần chạy script cài trên cPanel.
- Deploy theo luồng hiện có: CI của `main` đạt, run Deploy production chờ chủ repo Approve.
- Kiểm sau deploy: trang Hồ sơ của tài khoản chính sửa được; Thư viện ảnh hiện số liệu. Việc thử đổi mật khẩu trên production do chủ repo tự làm.
- Quay lui: deploy lại bản trước. Không có thay đổi dữ liệu nào cần hoàn tác; mật khẩu đã đổi vẫn giữ nguyên.

## 6. Tài liệu cập nhật cùng PR

`docs/admin-auth-api.md` (quy tắc tài khoản quản trị chính, bảng API hồ sơ), `docs/admin.md` (mục Hồ sơ, Thư viện ảnh).
