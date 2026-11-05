# Nhật ký cPanel trong admin BiBi

Trạng thái05/11: parser, schema riêng, importer, API phân quyền và giao diện đã qua test local theo từng phần. Tooling artifact3, cron và rollback đang kiểm chứng; chưa phát hành production cho feature này. Không suy ra đã import hosting từ tests synthetic.

## Cách hoạt động

Một cron Node24 kiểm tra/import mỗi15 phút; UI xem dữ liệu DB, không scrape Visitors và không cap1000 dòng. Nút Tải lại chỉ đọc lại DB. Owner chọn bộ lọc Log mới / Lịch sử archive, mặc định Log mới. Log mới là cache bản chụp đầy đủ của hai file đang ghi; khi có snapshot thành công mới thì thay cache cũ, không phải kho lưu trữ lâu dài. Lịch sử archive giữ mọi record đã nhập lâu dài. Hai nguồn có thể chứa cùng request nên không cộng chung tổng. Một record là một HTTP request, có thể là API/ảnh/bot; không phải một người hoặc phiên.

Ngày05/11 đã tạo request đánh dấu trên API/trang sản phẩm và thấy chúng trong current log sau khoảng9phút. Đây là số đo thử, chưa là cam kết độ trễ tối đa. Đã lưu mốc hash/byte archive riêng ngoài webroot để đối chiếu sau lần cập nhật archive thật; gate prefix này còn chờ. API báo stale khi quá45phút chưa có lần chạy, tách biệt với thời gian mới nhất của nguồn.

Giữ lịch sử archive đã nhập kể cả cPanel xóa nguồn; không purge archive theo90 ngày. Không thể phục hồi archive đã mất trước khi importer đọc. Thời điểm log mới phụ thuộc hosting ghi file và job15phút; archive phụ thuộc chu kỳ xử lý khoảng24giờ. IP nguồn chưa được Tino sửa thì vẫn là giá trị webserver ghi, chỉ được che trước lưu; không dùng làm định danh khách hoặc thay network rate limit auth.

## Local

Node24 + Docker Desktop; giữ các lệnh npm ci, npm run db:setup:local (setup một lần hoặc sau thay đổi schema), npm run dev, npm run check/build. Setup tạo text/gzip synthetic dưới .superpowers/local-access-logs, migrate feature explicit và nhập ví dụ cả hai nguồn bằng runtime DML account. Không copy log hoặc secret hosting về local/CI. Startup/HMR không tự migrate hoặc nhập log.

## Private config

ACCESS_LOG_ARCHIVE_DIR, ACCESS_LOG_CURRENT_DIR, ACCESS_LOG_DOMAIN_ALIAS, ACCESS_LOG_WORK_DIR là4 đường dẫn/alias không bí mật, deploy cấu hình một lần ngoài frontend. Production dự kiến archive=/home/vhplasti/logs, current=/usr/local/apache/domlogs/vhplasti (canonical đã đo), alias=bibistudio.vn.vhplastic.com và work=production/private/access-log-work. Current chỉ đọc đúng alias và alias-ssl_log. Queue current dùng sibling work-current; tổng private work512MiB dưới một job lock. Không dùng VITE_, cPanel API token hoặc PHP. Env file regular/owner0600 và không qua symlink theo loader hiện có.

CLI cố định: BIBI_PRIVATE_ENV_FILE trỏ private env, rồi node backend/dist/access-logs/cli.js migrate|status|sync. Migrate dùng maintenance DB account; status/sync dùng runtime DML, pool1. Không đưa password vào argv hoặc log. Không có API nhận file path hoặc trigger đồng bộ.

Sync exit0 khi complete/no-op,2 khi pending,1 khi lỗi. Output chỉ receipt/count/timestamp an toàn, tách current/archive. Một connection runtime pool1 và named job lock bao cả hai nguồn, tổng deadline120s, batch500. Archive giới hạn64MiB compressed/file,256MiB expanded/file; current text64MiB/file; tổng work512MiB và64KiB/line. Snapshot current staging không hiển thị cho HTTP đến khi count/hash hoàn tất và active pointer commit; chỉ dọn cache không active sau thành công. Không nâng giới hạn hoặc xóa archive để giấu lỗi. Backup native hiện128MiB cần headroom khi lịch sử tăng.

## Recovery

- Snapshot private0700/0600 giữ nguồn đã chụp đến khi checkpoint hoàn tất; không sửa/xóa file cPanel. Không dọn thủ công queue khi chưa đối chiếu checkpoint.
- Crash giữa batch: record và checkpoint cùng transaction; chạy lại sync để tiếp tục, không reset ordinal hoặc hash-dedup các dòng giống nhau.
- Prefix hoặc queued partial tail đổi: source_diverged, giữ evidence và dừng stream. Xác minh nguồn/DDL/checkpoint trước mọi recovery, không tự stamp complete hoặc reset source.
- Source thiếu, gzip hỏng, quyền lỗi, quota hoặc backlog: giữ dữ liệu đã commit, báo trạng thái và lần thành công cuối. Không biến lỗi thành bảng rỗng thành công.
- Feature ledger access_log_migrations riêng, phiên bản2; auth schema_migrations vẫn4. Artifact schemaVersion3 hash cả001/002. App rollback giữ archive/checkpoint/cache và auth revocations, không restore đè DB/down-migrate. Bootstrap cả hai nguồn phải complete trước activation. Probe rollback kiểm tra schema/quyền/counts nhưng cho phép dữ liệu stale để nguồn log lỗi không chặn phục hồi website; UI vẫn cảnh báo stale/lỗi. Phải kiểm chứng thật cùng tooling mới trước production.

Server log không có cookie/DNT/GPC/opt-out để áp dụng ngược tracker. Dataset operational này sẽ được ghi nhãn riêng; không trộn vào visitor/session/product-interest, không suy diễn khách theo IP+UA. DB/UI không lưu raw IP/UA, cookie, query, body hoặc raw line; line lỗi giữ marker an toàn, không drop im lặng.
