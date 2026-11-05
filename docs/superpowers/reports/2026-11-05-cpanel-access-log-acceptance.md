# Kiểm chứng nhật ký cPanel

Trạng thái05/11: triển khai local trong worktree codex/admin-dashboard. **Feature chưa deploy production, chưa cài cron thật.** Source/gate hosting tách khỏi local/CI; không dùng fixture làm bằng chứng production.

## Phạm vi đã triển khai

- Cùng trang Khách truy cập, mặc định Nhật ký cPanel / Log mới; bộ lọc Log mới / Lịch sử archive; Khách và sản phẩm giữ tracker riêng90ngày và deep link visitor cũ.
- Log mới là snapshot cache đầy đủ của hai file HTTP/SSL, publish bằng pointer transaction sau kiểm tra hash/count, lỗi giữ cache thành công trước. Archive lưu lâu dài theo source/ordinal, không cap1000 hoặc purge90ngày. Không cộng chung hai nguồn có thể trùng request.
- Một job15phút/pool1/deadline120s, named job lock và deploy flock; batch500, tổng private work512MiB. Nút Tải lại chỉ đọc DB. Chu kỳ job không bảo đảm log hosting mới trong15phút; đã đo request xuất hiện sau khoảng9phút.
- API JWT/customer_access.view, server pagination20/50/100, UTC date/filter, safe detail/source basename. IP/UA được che/chuẩn hóa trước DB/UI, bỏ query/fragment/referrer credentials, lỗi giữ marker. Không suy đoán vị trí, phiên hoặc khách duy nhất.
- Feature migrations001/002 độc lập auth4; manifest3 hash cả hai, receiver cũ từ chối3, tooling mới giữ1/2. Native backup/restore-check và rollback app giữ archive/cache/auth revocations; exact e725 factory vẫn ready. First bootstrap cần cả current/archive complete; rollback không bị chặn chỉ vì nguồn log stale.

## Kiểm tra thực tế đã đọc kết quả

1. `node scripts/local-database.mjs`: additive002 + text/gzip synthetic + import cả hai thành công trên DB local33385; không reset tài khoản.
2. Lượt `node scripts/check.mjs` tại Task10: exit0,90UI files/221tests, Node200tests196pass4platformskip, watcher1pass, real MySQL/auth browser1pass. Sau lượt này còn chỉnh UI/câu chữ và prepared statements; final full check cần chạy lại trước khi kết luận nhánh đạt.
3. `node --test tests/e2e/access-logs.spec.mjs`: real MariaDB/Express/React/Chromium,1205record mỗi scope, page13=5, filter UTC/error, source loss giữ dữ liệu, refresh đồng thời chỉ1lần, desktop1440/mobile390 không overflow. Lượt polished24.9s pass; ảnh đã mở kiểm tra. Initial harness import Vite sai alias đã sửa; không tăng timeout hay thêm fallback.
4. Review ảnh thấy current mode có câu retention của archive và detail dùng lời nhắc form lưu/padding thiếu. Test current copy RED; đã sửa câu đúng phạm vi, summary/bộ lọc thu gọn và readonly detail. UI regression7pass. Source basename thiếu cũng RED ở cả hai API và đã sửa; không trả private path.
5. SQL mode `NO_BACKSLASH_ESCAPES`: RED cho nhập path chứa dấu nháy và search literal; đổi bulk insert/count/list sang native prepared execute. New+API/importer15tests pass, không giả định hosting đang bị ảnh hưởng bởi mode này.

**Còn phải hoàn tất tại Task8:** final full check sau các chỉnh sửa, build artifact/budget/preview, fresh whole-branch review và xử lý Important findings. Chưa coi các mục này đã đạt.

Ảnh synthetic nằm ở .superpowers/e2e/access-logs: current-desktop.png, current-mobile.png, archive-desktop.png, valid-record-desktop.png, parse-marker-desktop.png, parse-marker-mobile.png. CI chuẩn chạy cả auth và large-log browser test; chỉ upload hai thư mục ảnh fixture, retention7ngày. Không chép log/secret hosting vào CI.

## Hosting: đã làm và đang chờ

Đã đọc nguồn đúng domain, đo current-file freshness và lưu mốc archive hash/byte. Lúc22:10VN đã giữ4gzip/175935bytes tại private/access-log-source-preservation,0700/0600, kiểm tra hash với nguồn. Source chưa thay thế hệ từ mốc14:13UTC; prefixPreserved trên cùng snapshot **không** chứng minh append qua một cycle thật. Chi tiết/bằng chứng tại [freshness report](2026-11-05-access-log-freshness.md).

Task9 còn: real archive update-prefix gate, trusted tools upgrade theo hash, private config4giá trị, native production backup/restore-check, migration/queued bootstrap gồm archive đã giữ, đúng main CI artifact, HTTP/UI User/Admin, cài/đọc crontab và chạy job thật, rollback về e725 rồi phát hành lại. Không có feature release/run ID production để báo tại thời điểm này.

## Tệp và cấu hình

Backend: backend/src/access-logs (parse/schema/repository/snapshot/importer/current-snapshot/current-cache/read services/routes/CLI/probe/sync service), backend/access-log-migrations/001_access_logs.sql và002_current_cache.sql; app/runtime/contracts chỉ nối dependency/read routes. Frontend: src/features/admin/analytics/http-api.ts, server-access-logs.tsx, pages/visitors.tsx; DataTable thêm pageSizes optional, CSS log-scoped. Tooling: ops/access-log-metadata.cjs, access-log-cron.cjs, database-lifecycle/release/receiver/deploy; build/local/check browser wiring và CI evidence.

Tên cấu hình agent đặt một lần, không bí mật: ACCESS_LOG_ARCHIVE_DIR, ACCESS_LOG_CURRENT_DIR, ACCESS_LOG_DOMAIN_ALIAS, ACCESS_LOG_WORK_DIR. Dùng private env/DB accounts đang có, không thêm key/token/cPanel credentials hoặc VITE variable. Hướng dẫn giới hạn/recovery: [access-log-operations](../../access-log-operations.md).
