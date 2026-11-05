# Nhật ký cPanel trong admin BiBi

Trạng thái05/11: parser, schema riêng và importer đang được triển khai/test local. Chưa có API/UI, cron hoặc release production cho feature này. Không suy ra đã import hosting từ tests synthetic.

## Cách hoạt động

Một cron Node24 nhập archive Raw Access của riêng BiBi mỗi ngày vào MySQL; UI sẽ xem dữ liệu DB, không scrape Visitors và không cap1000 dòng. Current log đang ghi không được nhập song song để tránh trùng với archive. Một record là một HTTP request, có thể là API/ảnh/bot; không phải một người hoặc phiên.

Giữ dữ liệu đã nhập kể cả cPanel xóa nguồn. Không tự purge bảng log theo90 ngày. Không thể phục hồi archive đã mất trước khi importer đọc. Thời điểm dữ liệu mới nhất phụ thuộc lần cPanel archive, không hứa luôn đủ đến nửa đêm hôm qua. IP nguồn chưa được Tino sửa thì vẫn là giá trị webserver ghi, chỉ được che trước lưu; không dùng làm định danh khách hoặc thay network rate limit auth.

## Local

Node24 + Docker Desktop; giữ các lệnh npm ci, npm run db:setup:local (setup một lần hoặc sau thay đổi schema), npm run dev, npm run check/build. Setup tạo gzip synthetic dưới .superpowers/local-access-logs, migrate feature explicit và nhập ví dụ bằng runtime DML account. Không copy log hoặc secret hosting về local/CI. Startup/HMR không tự migrate hoặc nhập log.

## Private config

ACCESS_LOG_ARCHIVE_DIR, ACCESS_LOG_DOMAIN_ALIAS, ACCESS_LOG_WORK_DIR là3 đường dẫn/alias không bí mật, được deploy cấu hình một lần, ngoài frontend. Production dự kiến /home/vhplasti/logs, bibistudio.vn.vhplastic.com và production/private/access-log-work. Không dùng VITE_, cPanel API token hoặc PHP. Env file regular/owner0600 và không đi qua symlink theo loader hiện có.

CLI cố định: BIBI_PRIVATE_ENV_FILE trỏ private env, rồi node backend/dist/access-logs/cli.js migrate|status|sync. Migrate dùng maintenance DB account; status/sync dùng runtime DML, pool1. Không đưa password vào argv hoặc log. Không có API nhận file path hoặc trigger đồng bộ.

Sync exit0 khi complete/no-op,2 khi pending,1 khi lỗi. Output chỉ receipt/count/timestamp an toàn. Mỗi lượt tối đa120s, batch500; giới hạn64MiB compressed/file,256MiB expanded/file,512MiB work queue,64KiB line. Không nâng giới hạn hoặc xóa dữ liệu để giấu lỗi. Dung lượng backup native hiện128MiB cũng cần headroom khi lịch sử tăng.

## Recovery

- Snapshot private0700/0600 giữ nguồn đã chụp đến khi checkpoint hoàn tất; không sửa/xóa file cPanel. Không dọn thủ công queue khi chưa đối chiếu checkpoint.
- Crash giữa batch: record và checkpoint cùng transaction; chạy lại sync để tiếp tục, không reset ordinal hoặc hash-dedup các dòng giống nhau.
- Prefix hoặc queued partial tail đổi: source_diverged, giữ evidence và dừng stream. Xác minh nguồn/DDL/checkpoint trước mọi recovery, không tự stamp complete hoặc reset source.
- Source thiếu, gzip hỏng, quyền lỗi, quota hoặc backlog: giữ dữ liệu đã commit, báo trạng thái và lần thành công cuối. Không biến lỗi thành bảng rỗng thành công.
- Feature ledger access_log_migrations riêng; auth schema_migrations vẫn4. App rollback giữ các bảng log và checkpoint, không restore snapshot DB/down-migrate. Phải kiểm chứng thực tế cùng tooling mới trước production.

Server log không có cookie/DNT/GPC/opt-out để áp dụng ngược tracker. Dataset operational này sẽ được ghi nhãn riêng; không trộn vào visitor/session/product-interest, không suy diễn khách theo IP+UA. DB/UI không lưu raw IP/UA, cookie, query, body hoặc raw line; line lỗi giữ marker an toàn, không drop im lặng.
