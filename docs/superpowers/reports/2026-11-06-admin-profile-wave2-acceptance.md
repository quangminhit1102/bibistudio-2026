# Admin Profile Wave2 — nghiệm thu local06/11/2026

Đã qua check/build/budget và kiểm chứng compiled trực tiếp. Review độc lập đã phát hiện4điểm cần sửa và2minor; các ca hồi quy đã tái hiện RED→GREEN, đang chạy cổng tổng sau sửa; chưa push, deploy hay đổi DB/config cPanel. Biên bản production cũ không áp dụng cho tính năng mới này.

## Bản kiểm chứng

- Branch `codex/admin-dashboard`; Wave2 base `7dbc40ed5650dbdde24b416e9f27e124f0a65de8`.
- Runtime source đã build: `c000565b0352d43285a5db8097812f14e5baceed`.
- Artifact `.releases/local-c000565b0352d43285a5db8097812f14e5baceed.tgz`, manifest4; identity4, access-logs2, profile1. SHA256 sidecar và kiểm tra inventory runtime/SQL đạt.
- Preview `http://127.0.0.1:4200/admin/settings/profile`; `/api/version` trả đúng SHA trên, `/api/ready`200. DB develop được guard ở127.0.0.1:33385/bibi_local, đã chạy setup/migration rõ ràng; không migrate khi server khởi động.
- Đã dùng trình duyệt Codex kiểm chứng bản compiled: đăng nhập tài khoản local không có role, sửa tên/phone, chọn preview/lưu PNG, tải lại; hồ sơ và ảnh vẫn được khôi phục. Tab được giữ mở. Fixture sở hữu riêng ghi tại `.superpowers/profile-preview.fixture.json`, không chứa dữ liệu production; không đổi tài khoản admin/user01 production.

## Phạm vi đã triển khai

| Nhóm | Kết quả |
| --- | --- |
| Metadata | Migration nullable, ledger/checksum riêng; phone7–15digits, leading0, optional+, nullable/nonunique |
| Self API | GET/PATCH profile cho mọi active session; strict allowlist, revision/no-op, audit tên trường; Master bất biến |
| Ảnh | Private immutable UUID, Bearer Blob/ObjectURL; raw PUT/DELETE If-Match, management permission, retire30ngày |
| Giải mã | jpeg-js0.4.4/pngjs7.0.0 chỉ backend, không native build; byte/pixel/header/CRC/EXIF/timeout/busy bounds |
| UI | Hồ sơ cho User/no-role, Master readonly; phone create/edit; chọn/xem trước/lưu/hủy/xóa ảnh riêng; giữ draft khi lỗi/refetch; header/sidebar đồng bộ |
| Rollback | Manifest4/runtime sidecar, native DB+files snapshot cùng lock, restore verifier và đọc ảnh; tool mới có thể rollback code cũ; từ chối DB-only fallback |
| Cleanup | Bảo vệ ảnh active/pinned; retired>=30ngày, orphan UUID>=24giờ; không dọn mù file lạ |

Các file thay đổi tập trung: `backend/profile-migrations`, `backend/src/profile`, app/runtime/config/contracts/account authorization/audit; `src/lib/admin-http.ts`, `src/features/admin/accounts`, shell; `ops/profile-*.cjs`, database/deploy/receiver/release; build/preview/local setup/check harness, backend/admin/e2e tests và các tài liệu liên quan. Xem lịch sử commit Wave2 để có danh sách chi tiết.

## Kết quả kiểm chứng

- Node24.22.2: `npm run check` exit0. Admin99files/266tests đạt; Node250tests:244đạt,6skip có điều kiện Windows/POSIX; watcher thực tế1/1 đạt; cả4browser suites auth/access-logs/admin-usability/profile đạt.
- Sáu skip cần Linux CI trước nghiệm thu release: symlink store, symlink paired-backup, native flock, SQL symlink validations, quyền POSIX routing. Không coi skip Windows là bằng chứng Linux đã đạt.
- `npm run build` exit0: SSR/CSR và bundle backend/SQL/runtime sidecar; không có secrets, upload, private hoặc node_modules trong archive.
- Bundle budget exit0: delta public initial gzip JS8704B (<10240), CSS313B (<2048); graph initial không chứa admin module.
- Lint0error/10warning hiện có về Fast Refresh/ref cleanup; jsdom cảnh báo scrollTo chưa implement; build cảnh báo chunk public>500kB. Không che/tắt các cảnh báo này.
- Native MariaDB dump/restore cô lập đã chạy thật, kiểm tra DB checksum và từng ảnh tham chiếu. Thiếu/hỏng ảnh và hỏng bản copy đều chặn receipt; giữ advisory lock, mutation chờ rồi timeout503 không commit. Cleanup giữ ảnh active/recent/pinned.
- Backend cũ pinned `e27102c` đã chạy thật trên DB mới: ready/login/account edit200; phone/avatar không mất; forward đọc lại ảnh200. Lỗi probe rollback thủ công đã tái hiện RED, sửa khôi phục current/routing và GREEN.
- PNG16MP output512×512:629ms/peak259692KiB khi chạy riêng; một full-run1397ms/320584KiB (~313MiB), final full-run1438ms/264704KiB. Đây là số đo local, không phải cam kết hosting. Worker heap128MiB không giới hạn cứng Buffer/RSS.
- Hai dependency runtime mới không có dependency bắc cầu, tổng726130B unpacked; audit runtime lúc cài ở Task3 là0 vulnerability. Không thêm dependency frontend.

Evidence local (ignored): `.superpowers/e2e/profile/` có full-check/build/backup-rollback logs, bundle-report/compiled-version JSON, ảnh ở390×844,900×1000,1440×1000 sáng/tối, ảnh xung đột/management/Master. Các luồng browser gồm: metadata/reload, PNG/JPEG replace/remove, upload503, revision409 giữ draft,2request401 chỉ1refresh (ngoài restore ban đầu), logout/login khi ảnh cũ còn pending, Admin+User tự sửa không đổi2roles, quản lý User không đổi role, Master không có action sửa.

## Quyết định khi triển khai và chi phí

1. Recovery migration dirty phải yêu cầu `resumeDirty` rõ ràng sau kiểm tra DDL; chi phí là thêm bước vận hành khi có gián đoạn.
2. CI lấy đủ git history và compile backend pinned khi không có artifact local; chi phí download history/compiler time để không skip rollback thật.
3. Lock profile rồi RBAC trên cùng connection; chi phí contention có giới hạn trong lúc backup, tránh cạn pool.
4. Tách header preflight ra module riêng trước worker; chi phí thêm một module được đóng gói/kiểm tra.
5. Tách avatar service và DTO repository khỏi metadata service; chi phí hai module nhỏ.
6. Quota128asset/64MiB/user; chi phí người đổi ảnh liên tục có thể phải chờ cleanup theo retention.
7. Dùng chung AvatarEditor cho self/management và test authenticated avatar riêng; chi phí hai file nhỏ, không thêm thư viện.
8. Mở callback `verifyRestored` trong backup hiện có để kiểm tra ảnh trước cleanup verifier; chi phí thêm hợp đồng nội bộ thay vì nhân đôi credential/restore logic.
9. Snapshot tối đa10000ảnh/1GiB, thư mục backup10000entry; giữ backup/pin đến khi hết hạn thủ công, file lạ/.pending cần kiểm tra; chi phí safe refusal, dung lượng tăng và thao tác vận hành.
10. Thêm `profile-runtime.json` kiểm hash inventory mà vẫn giữ shape manifest4 đã duyệt; chi phí một file bắt buộc và receiver phải kiểm tra nó.
11. Backup đôi cả trước recovery và phục hồi current khi rollback explicit thất bại; chi phí một backup nữa khi lỗi, dừng an toàn nếu không verify được.
12. Thay native file-picker tiếng Anh bằng Button tiếng Việt và tên file; chi phí wrapper nhỏ, không dependency mới.
13. Browser functional tests dùng warmup và font fallback theo harness có sẵn; chi phí không kiểm tra độ sẵn sàng Google Fonts trực tiếp trong CI. Một timeout tải trang cũ đã chạy lại diagnostic thành công mà không đổi product code.

## Cổng trước production

Chưa xác minh: Linux CI thực tế, Node24/RSS/codec limits trên cPanel, fixed private dir trong cả hai env, receiver4 trên hosting, paired native backup/restore thực tế trên hosting, protected/self/avatar probes và diễn tập rollback/forward production. Không phát hành chỉ dựa vào biên bản local này. Xem [vận hành hồ sơ](../../admin-profile-operations.md) và [build/deploy](../../build-and-deploy.md).


## Review độc lập và lượt sửa cuối

Fresh gpt-6-astra, read-only, range7dbc40e..85719ea; không reviewer phụ hoặc re-review. Đã tái hiện và sửa:

- Receiver dùng sai tên `checksums`: chuyển sang `migrationChecksums` của producer thật. Test đưa kết quả schema từ MySQL thật qua checker và từ chối checksum đổi. Đã thử CLI compiled trên DB develop thật → receiver checker: compatible=true/state=complete/version1.
- Backup/cleanup gọi trực tiếp bỏ qua schema: thêm kiểm tra packaged schema bên trong profile lock; backup chỉ nhận complete hoặc genuinely empty trước migration, cleanup chỉ complete. Drift mất pointer hoặc ledger version lạ không tạo receipt, không gọi native tool hoặc xóa ảnh/row.
- Reload503 sau409: chỉ remount form khi refetch thành công; giữ bản nháp qua request thất bại, retry thành công mới thay.
- PATCH/PUT đã200 nhưng GET refresh header503: đồng bộ shell bằng profile response đã được xác nhận với epoch/identity guard, không biến lỗi refresh sau đó thành lỗi lưu. Test metadata/avatar và callback từ phiên cũ không ghi sang user mới.

Hai minor được hoãn, không đưa vào lượt fix: PNG có dư scanline inflate vẫn được nhận và chuẩn hóa an toàn (review không thấy treo main loop/lộ bytes gốc); URL appearance riêng vẫn mở cho mọi HTTP user để đổi theme local, không mở thêm quyền backend. Chưa có quyết định sản phẩm để đổi hai hành vi này.

Các phần reviewer để ngoài đánh giá được chấp nhận theo phạm vi: hosting cần phát hành được duyệt riêng (chi phí còn nghiệm thu hosting);6skip cần Linux CI (chi phí chưa có bằng chứng Linux); live font theo ruling13 (chi phí chưa test Google Fonts trực tiếp); Wave1 ngoài điểm tích hợp đã duyệt không mở lại (chi phí không audit lại toàn bộ lịch sử).
