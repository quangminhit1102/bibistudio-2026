# Khách truy cập: dữ liệu, kiểm chứng và vận hành

Trạng thái ngày 13/11/2026: đã triển khai và kiểm chứng local theo [thiết kế đã duyệt](superpowers/specs/2026-11-13-visitor-analytics-design.md). Chưa phát hành production. Chủ website xác nhận **chưa gửi yêu cầu Tino**; không có bằng chứng hosting đã sửa nguồn IP. Không bật `CLIENT_IP_SOURCE_VERIFIED` chỉ để có số liệu trên UI.

## Cách đọc số liệu

- Khách truy cập là một định danh cookie trình duyệt, không phải một người được xác định danh tính. Hai cookie cùng IP vẫn là hai khách; đổi IP không tự tạo khách mới.
- Một lượt truy cập là một phiên. Sau hơn 30 phút không nhận hoạt động, hoạt động mới mở phiên mới; đúng 30 phút vẫn cùng phiên. Thời gian là lúc server nhận batch, không phải thời điểm chính xác từng cú bấm.
- Các bộ lọc chọn phiên theo **thời điểm bắt đầu phiên**. KPI, bảng, biểu đồ đường, sản phẩm và chi tiết dùng cùng khoảng ngày, thiết bị, trình duyệt và IP tìm kiếm.
- Một phiên đã chọn vẫn hiển thị các URL ghi nhận sau ngày kết thúc bộ lọc. Mỗi URL/sản phẩm xuất hiện một lần trong phiên, có thời điểm ghi nhận đầu/gần nhất. Giới hạn 200 URL/100 sản phẩm mỗi phiên vẫn được báo khi đạt; không hứa đây là lịch sử mọi cú bấm.
- Top sản phẩm đếm số trình duyệt khác nhau đã quan tâm từng sản phẩm, không cộng số lần bấm. Tổng các cột sản phẩm có thể lớn hơn số khách vì một khách quan tâm nhiều sản phẩm.
- Cookie có hiệu lực 90 ngày. Dữ liệu khách, phiên, URL và sản phẩm thật đã lưu **không có TTL xóa**. Tác vụ `analytics:cleanup` mới chỉ dọn probe phát hành đã hết hạn và bộ đếm throttle cũ. Auth cleanup không đổi.

## Khoảng ngày và tải lại

Mặc định 1 tháng, có 6 tháng, 1 năm và Khoảng ngày. Chỉ chọn ngày, không chọn giờ. Theo giờ Việt Nam, từ 00:00 ngày bắt đầu đến trước 00:00 ngày sau ngày kết thúc; SQL dùng UTC. Ví dụ 01–13/11/2026 tương ứng `[2026-10-31T17:00:00Z, 2026-11-13T17:00:00Z)`.

Preset lấy 00:00 ngày mai làm mốc cuối rồi lùi 1/6/12 tháng lịch, clamp cuối tháng khi cần. Ngày 13/11/2026, 1 tháng hiển thị 14/10–13/11. Custom có thể truy vấn lịch sử cũ hơn một năm; bộ lọc không phải chính sách lưu trữ. Đổi khoảng ngày đưa bảng về trang đầu và làm mới chi tiết phiên. Tải lại lấy dữ liệu hiện có trong DB, không chạy importer cPanel. Mỗi report dùng một transaction READ ONLY REPEATABLE READ cho KPI/chuỗi thời gian/sản phẩm. Không cam kết một snapshot transaction chung cho nhiều HTTP request khi dữ liệu mới đang được ghi. Client có bộ lọc từ chối response backend cũ thiếu contract hoặc không khớp khoảng ngày và yêu cầu tải lại trang.

## API và schema

Các API đều cần Bearer token và `customer_access.view`:

| API                                            | Nội dung                                                        |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/customer-access`                     | Bảng khách phân trang, tối đa 100 dòng/lần                      |
| `GET /api/customer-access/report`              | KPI, chuỗi thời gian điền 0, Top10 sản phẩm và tổng số sản phẩm |
| `GET /api/customer-access/report/products`     | Toàn bộ sản phẩm theo từng trang, mặc định20/tối đa100          |
| `GET /api/customer-access/:id`                 | Metadata khách và số phiên trong phạm vi lọc                    |
| `GET /api/customer-access/:id/session-history` | 20 phiên/lần, cursor ràng buộc khách và bộ lọc                  |
| `GET /api/customer-access/:id/sessions`        | Adapter phân trang chỉ đọc cho tab cũ                           |

Tham số dùng chung: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `deviceType`, `browser`, `search`. Bộ lọc sản phẩm cũ trả lỗi400 có kiểm soát. Cursor sai/đổi bộ lọc trả400; khách không tồn tại trả404. Raw IP không có trong API collector công khai.

Migration mới nằm trong `backend/visitor-migrations/001_history.sql`; ledger `visitor_history_schema_migrations` riêng. Auth vẫn đúng4 migration. Thêm các cột nullable metadata/IP trên phiên và hai index theo `started_at`/visitor; không backfill IP đầy đủ từ prefix. Runtime không tự chạy DDL. Local dùng lại `npm run db:setup:local`, sau đó `npm run dev`; không thêm lệnh develop hằng ngày.

Tool hosting cố định: `backend/dist/visitors/cli.js migrate|status`, đọc `BIBI_PRIVATE_ENV_FILE` từ private env ngoài webroot. `status` trả exit0 cho trạng thái empty hợp lệ hoặc complete; dirty/incompatible trả exit1. Dirty/checksum/DDL drift phải được kiểm tra trước khi resume qua maintenance; không tự bỏ qua hoặc sửa ledger. Manifest5 mang `visitorAnalytics` checksum SQL; readiness v5 yêu cầu visitor schema hoàn tất và giữ kiểm tra auth/profile hiện có.

## IP công khai: phần còn chờ Tino

`CLIENT_IP_SOURCE_VERIFIED=false` là mặc định. Chỉ bật `true` cùng `TRUSTED_PROXY_CIDRS` đúng topology sau khi đo thực tế. Resolver dùng `req.ip` đã qua Express trust proxy và kiểm tra peer thuộc CIDR tin cậy; không tự lấy IP đầu tiên của header client gửi. IP private/loopback/reserved/malformed trả chưa xác định. Quan sát chưa xác minh không ghi đè IP đã xác minh trong cùng phiên. IP đổi qua phiên mới được giữ ở snapshot riêng.

Nguồn cần được cấu hình tại hosting: proxy phải xử lý header không tin cậy. [Hướng dẫn Express](https://expressjs.com/en/guide/behind-proxies/) yêu cầu cấu hình trust khớp reverse proxy; [Passenger](https://www.phusionpassenger.com/docs/advanced_guides/in_depth/node/secure_http_headers.html) có cơ chế secure client-address, nhưng chưa chứng minh host này cung cấp nó. Không tự chuyển sang adapter đó hoặc đoán CIDR.

Chủ website gửi [yêu cầu hỗ trợ đã chuẩn bị](visitor-ip-hosting-request.md). Khi Tino phản hồi, kiểm tra request bình thường và giả `X-Forwarded-For`/`X-Real-IP`/`Forwarded`, chuỗi nhiều IP, hai mạng ngoài hosting, IPv4/IPv6 và hostname chính/www. Sau đó mới cấu hình private env và kiểm chứng lại login/refresh/throttle/collector. Không mở endpoint debug IP công khai hoặc đưa IP thật/token vào log/ticket.

## Bỏ nhật ký cPanel, backup và rollback

Luồng mới bỏ UI/API current/archive và cấu hình source log trong runtime. Endpoint cũ trả JSON404. Giữ nguyên dữ liệu, SQL migration và các tool tương thích cũ cần cho backup/rollback; không drop bảng hoặc xóa archive. Các test HTTP log được chạy bằng backend production cũ được pin tại `3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf` để kiểm tra khả năng phục hồi.

Receiver/ops phải được bootstrap đồng bộ trước artifact manifest5, gồm `visitor-metadata.cjs`, `visitor-lifecycle.cjs`, `visitor-cron-policy.cjs` và các file ops đã sửa. Không chỉ upload backend mới lên receiver cũ.

Trước activation: paired native backup/restore phải đạt; kiểm tra schema/checksum; tool ổn định ngoài `current` gỡ đúng marker `BIBI_ACCESS_LOG_SYNC_<root-hash>` và lưu bản sao crontab cùng receipt `private/visitor-history-retention.json`. Giữ các dòng khác nguyên byte. Nếu thấy job `analytics:cleanup` chưa được kiểm tra chính xác trên host thì **dừng phát hành**, không xóa theo substring hoặc thay cả crontab. Cần kiểm tra lệnh thực tế ở hosting trước khi xử lý. Receipt này cũng ngăn tool cron mới cài/chạy lại importer khi rollback về code cũ.

Rollback là đổi code về release trước tương thích, không restore đè DB đang có dữ liệu mới, không down migration. Phiên cũ hơn90 ngày vẫn còn dù UI cũ chỉ hiển thị khoảng90 ngày. Một lần rollback từv5 vềv4 vẫn dùng toolv5 để kiểm tra schema và giữ cron đã gỡ. Sau đó thao tác old→old không có tool visitor-aware sẽ bị chặn; muốn phát hành tiếp phải chọn release có khả năng kiểm tra history. Giữ releasev5 cùng các tool tương thích trong thời gian phục hồi.

Backup native hiện tự phát hiện và xác minh toàn bộ bảng; kiểm thử mới bao gồm ledger/IP phiên, log lưu cũ và avatar trong cùng restore. Giới hạn backup hiện tại128MiB không tự tăng hay xóa lịch sử để vừa giới hạn. Trước production phải đo dung lượng, headroom, phiên bản công cụ dump và quyền verifier thực tế. Lịch sử tăng lâu dài cần kế hoạch dung lượng từ hosting.

Phát hành theo [build-and-deploy](build-and-deploy.md): artifact của main CI thành công, Run workflow thủ công, cổng duyệt production, smoke và rollback. Chưa vượt các gate IP/cron/capacity/receiver thực tế thì chưa được gọi đây là bản production đã xác minh.

## Yêu cầu phát hành ngày13/11

Sau kiểm tra cPanel, chủ website yêu cầu deploy source hiện tại dù nguồn IP còn chưa đạt. Giữ CLIENT_IP_SOURCE_VERIFIED=false và hiển thị chưa xác định; không coi lần deploy này là hoàn tất mục tiêu IP thật. Các gate backup/cron/capacity/receiver, CI và kiểm chứng production vẫn bắt buộc.
