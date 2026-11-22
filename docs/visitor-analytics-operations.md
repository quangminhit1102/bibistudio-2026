# Khách truy cập: dữ liệu, kiểm chứng và vận hành

## Quản lý khách truy cập và loại trừ IP (21/11/2026)

Thiết kế đã duyệt: [visitor-controls](superpowers/specs/2026-11-21-visitor-controls-design.md). Manifest7 bổ sung capability `visitorControls`, checksum `backend/visitor-controls-migrations/001_controls.sql`, ledger riêng `visitor_controls_schema_migrations` version1 và singleton `visitor_exclusion_settings`. Không thay auth4, visitor-history1 hoặc context1; không sửa các SQL đã phát hành.

Quyền riêng `customer_access.delete` cho xóa khách/phiên và `customer_access.manage_exclusions` cho đọc/sửa IP loại trừ; mỗi thao tác còn cần `customer_access.view`. Admin toàn quyền mặc định; User chỉ xem. Có thể cấp riêng trong Phân quyền.

`Loại trừ IP` nhận tối đa200 rule: IP đầy đủ IPv4/IPv6 hoặc wildcard bốn nhóm IPv4. Dấu `*` thay một nhóm; không nhận regex hoặc `*.*.*.*`. Các rule chỉ áp dụng cho batch mới sau khi lưu, không xóa lịch sử. Nguồn so khớp là IP thực sự sẽ lưu: resolver đã xác minh trước, relay có chữ ký tiếp theo; không tin payload hoặc tự chọn X-Forwarded-For. Khớp rule trả204, không tạo/cập nhật analytics, không geo lookup/cookie mới. Vẫn duy trì xác thực relay và security receipt chống replay. Lỗi đọc cấu hình trả lỗi collector có kiểm soát, không ảnh hưởng render website.

Checkbox chọn các khách ở trang hiện tại, đổi trang/bộ lọc thì bỏ chọn. Xóa khách xóa mọi phiên kể cả ngoài khoảng ngày lọc; xóa phiên chỉ xóa đúng phiên. Popup xác nhận nêu không thể hoàn tác. Xóa không phải chặn tracking: lần truy cập sau có thể ghi nhận lại. Không dùng production để test xóa. Các bản ghi release probe không được xóa qua UI/API quản trị.

Receiver cần cập nhật từ ops đã commit, giữ bản sao tools trước cập nhật. Gói mới chỉ hoạt động sau paired backup/restore verifier → auth seed/migrations hiện có → context readiness → controls status/migrate/status → activation. Controls CLI chỉ chạy schema mutation trong lệnh bảo trì, không tự DDL khi server khởi động. Native backup hiện có sao lưu mọi bảng InnoDB, bao gồm settings/ledger mới.

Rollback dùng tool controls của current/candidate để kiểm tra rồi giữ nguyên DB; không down migration và không tự phục hồi bản ghi đã xóa. Bản trước manifest7 vẫn chạy với schema cộng thêm nhưng chưa có chức năng xóa/loại trừ IP; rule được giữ cho lần forward, không được hiểu là rule vẫn được thực thi trong collector cũ. Khi cần giữ tính năng loại trừ, chọn release manifest7 đã thành công.

**Cập nhật 14/11/2026:** relay manifest6 đã phát hành và rollback/forward thật đã đạt; IP quan sát và quốc gia ước lượng có trên UI. Giữ trust=false. Xem [biên bản hiện tại](superpowers/reports/2026-11-14-visitor-relay-acceptance.md); đoạn 13/11 dưới đây là mốc lịch sử.

Trạng thái ngày 13/11/2026: đã triển khai và kiểm chứng local theo [thiết kế đã duyệt](superpowers/specs/2026-11-13-visitor-analytics-design.md). Đã phát hành production release ee12307-43382604855 và kiểm chứng rollback/forward; xem [biên bản](superpowers/reports/2026-11-13-visitor-analytics-production-release.md). Chủ website xác nhận **chưa gửi yêu cầu Tino**; không có bằng chứng hosting đã sửa nguồn IP. Không bật `CLIENT_IP_SOURCE_VERIFIED` chỉ để có số liệu trên UI.

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

Phát hành theo [build-and-deploy](build-and-deploy.md): artifact của main CI thành công, Deploy production tự chạy hoặc chạy tay, smoke và rollback. Chưa vượt các gate IP/cron/capacity/receiver thực tế thì chưa được gọi đây là bản production đã xác minh.

## Yêu cầu phát hành ngày13/11

Sau kiểm tra cPanel, chủ website yêu cầu deploy source hiện tại dù nguồn IP còn chưa đạt. Giữ CLIENT_IP_SOURCE_VERIFIED=false và hiển thị chưa xác định; không coi lần deploy này là hoàn tất mục tiêu IP thật. Các gate backup/cron/capacity/receiver, CI và kiểm chứng production vẫn bắt buộc.

## Lưu ý CageFS khi phát hành

Receiver phải giữ SSH_ORIGINAL_COMMAND để validate lệnh SSH. Chỉ child crontab nhận bản sao environment đã bỏ biến này; nếu truyền nguyên biến, CageFS trên hosting đã đo trả Invalid argument. Bản sửa ee12307 có regression test và đã qua rollback/deploy GitHub thật. Không tắt kiểm tra crontab hoặc bỏ khóa deploy để né lỗi.

## Relay IP/quốc gia — manifest6 đã phát hành 14/11

Không dùng cron hoặc importer. Browser gửi batch hiện có qua `/api/analytics/relay/collect.php`; PHP ký IP quan sát được, Express ghi snapshot phiên và tra quốc gia offline. UI ghi “Chưa xác minh” và “Ước lượng”. `CLIENT_IP_SOURCE_VERIFIED=false`; auth và trust proxy không đổi. MMDB DB-IP Country Lite 11/2026, CC-BY-4.0; attribution nằm trong UI và `backend/geoip/country.lock.json`.

Receiver cần bootstrap đồng bộ từ source đã commit: `release.cjs`, `receiver.cjs`, `deploy.cjs`, `database-lifecycle.cjs`, ba file `visitor-context-{metadata,lifecycle,routing}.cjs` và `php/{loader.php,relay.htaccess}`, cùng các dependency ops hiện có. Stable Passenger `production/app/app.cjs` cũng phải lấy đúng source `ops/passenger/app.cjs` đã review (sao lưu trước), để chuyển schemaVersion vào readiness và không báo khỏe khi thiếu context của manifest6. Trước ghi, đối chiếu SHA256 từng file với source và sao lưu ops hiện tại; không lấy file từ working tree chưa commit. Manifest6 ghi checksum SQL, tổng hợp hai PHP file theo thứ tự ASCII và SHA256/version MMDB. Receiver từ chối asset thiếu, thay đổi hoặc symlink. Archive vẫn giới hạn256MiB.

Cấu hình private, ngoài webroot và0600:

- `private/analytics-relay.json`: đúng4 trường `environment: "production"`, `secret` (32byte random base64url43ký tự), `targetUrl: "https://bibistudio.vn/api/analytics/collect"`, `origins` giống AUTH_ALLOWED_ORIGINS.
- `private/runtime.env` và `private/maintenance.env`: cùng `ANALYTICS_RELAY_SECRET`; `GEOIP_COUNTRY_FILE=<deploy-root>/current/backend/geoip/country.mmdb`; `CLIENT_IP_SOURCE_VERIFIED=false`. Khóa relay riêng, không dùng lại khóa JWT, identity hay probe. Không đưa cấu hình vào VITE_, argv hoặc log.

Bootstrap loader chỉ tạo `api/analytics/relay/collect.php` và `.htaccess` trong child đó (`PassengerEnabled off`, không liệt kê thư mục). Không sửa `.htaccess` của `/api`. Routing root vẫn dùng quy trình phát hành cũ. Trước thay child files, lưu bản sao trong `private/relay-routing-backup-<UUID>/before.json`; hash các file đã cài nằm tại `private/analytics-relay-routing.json`. File có sẵn không đúng hash bị chặn để kiểm tra, không ghi đè. Loader xóa realpath/stat cache trước mỗi request vì Node đổi symlink ngoài PHP worker; chọn PHP từ realpath `current`, kiểm tra capability và checksum; release cũ trả404 để tab mới dùng fallback hữu hạn, IP unknown.

Trình tự: paired native backup/restore có avatar → auth/history migrations như cũ → context status/migrate/status → cài child loader → chuyển current → restart → readiness PHP thực (GET405 JSON, không chấp nhận source/404) và auth/profile/analytics probe. Migration context lỗi xảy ra trước khi đổi current. Không restore đè DB live hay down migration. Ledger riêng `visitor_context_schema_migrations` version1, auth4 và visitor-history1 không sửa. Receipt replay là state tạm, dọn tối đa100receipt hết hạn mỗi batch; lịch sử thật không TTL.

Rollback v6→v5 dùng context tool của current v6 để kiểm tra trước khi chuyển. Dữ liệu session mới vẫn ở DB; v5 có thể đổi cột ip_status thành unavailable nhưng không xóa IP/country snapshot, v6 khôi phục ý nghĩa observed khi forward. Old→old không có context tool ở current/candidate bị chặn sau khi relay đã cài; giữ release v6 cho forward. Không chọn tool ngẫu nhiên từ một release retained khác. Importer và TTLcron đã retired giữ nguyên trạng thái tắt.

Local đã đo: PHP loader v6/old/tampered trả405/404/503; pinned backend productionv5 vẫn chạy auth/profile sau DDL mới; backup native phục hồi snapshot/ledger/receipt trong verifier riêng. Artifact local đầu tiên199025808byte (~189.8MiB), dưới256MiB; đây chưa phải artifact CI/production. Manifest6 đã deploy production và diễn tập rollback/forward ngày14/11; xem [biên bản live](superpowers/reports/2026-11-14-visitor-relay-acceptance.md). Hai nguồn Windows/hosting và hai hostname có IP observed/quốc gia ước lượng; trust=false. IPv6 live và mạng ngoài thứ hai chưa đo.
