# IP và quốc gia theo phiên — thiết kế relay analytics trên cPanel

Trạng thái: dự thảo chờ chủ website duyệt. Phương án PHP nhỏ + Express + GeoIP offline đã được chọn; chưa được coi là đã triển khai hoặc kiểm chứng production.

## Mục tiêu và phạm vi đã chốt

Chủ website muốn IP công khai và vị trí xuất hiện khi ghi nhận khách, không chờ cron hoặc log. Trước mắt vị trí chỉ cần quốc gia, cho phép ghi nguồn IP chưa xác minh và xem xét xác minh nguồn hosting sau. Giữ React/Express/MySQL/cPanel, local develop ít lệnh, CI/main artifact/manual production và rollback đang có. Không thêm lịch sử từng cú bấm.

Luồng: trình duyệt gửi batch analytics hiện có → endpoint PHP hẹp trên cùng domain → Express xác nhận envelope nội bộ → collector lưu phiên/IP và tra quốc gia bằng MMDB offline → UI đọc API hiện có. Không dùng PHP cho account/auth hoặc nghiệp vụ khác.

## Các phương án đã cân nhắc

1. Log cPanel + GeoIP có sẵn: đã kiểm tra Visitors có IP, AWStats dùng geoipfree, module Perl tra IPv4/quốc gia hoạt động. Không đáp ứng lấy IP ngay vì lần đo log trước chậm khoảng9phút; cần ghép request/phiên và retry. Chủ website yêu cầu xem lại cron và chọn giải pháp tốt hơn.
2. PHP nhận IP trực tiếp + Node/GeoIP offline: phương án đã chọn ngày13/11. Thêm một relay hẹp, không chờ log, không cần API key dịch vụ hoặc gửi IP khách ra ngoài.
3. API IP/GeoIP bên ngoài: giảm phần dữ liệu trên host nhưng phụ thuộc quota/mạng và chia sẻ IP với bên thứ ba, không chọn.

## Bằng chứng và giới hạn hiện tại

- Node test cùng vhost nhận socket loopback; normal request không có public IP header. Header giả, kể cả tên secure Passenger, đi xuyên từ nguồn hosting. Không bật trust proxy toàn app.
- Spike PHP05/11 từng nhận IP ngoài hosting ở hai nguồn; raw REMOTE_ADDR có thể bị ảnh hưởng bởi forwarding header từ hosting. Bộ chặn forwarding header đã qua24request trong spike đó. Đây là bằng chứng cũ, phải đo lại trên host hiện tại.
- Cookie bibi_visitor đang HttpOnly/Secure/SameSite=Lax, Path=/api/analytics. Auth cookie/access token và refresh flow không thay đổi.
- GeoIP có sẵn chỉ quốc gia/IPv4. Phương án builder chọn là DB-IP Country Lite MMDB có ghim phiên bản/checksum, khoảng8MB ở bản11/2026, đọc trong Node để hỗ trợ dữ liệu IPv4/IPv6 và tránh spawn Perl trên mỗi request. Độ phủ phải đo bằng dataset thật; không hứa mọi IP đều tra được.
- IP là địa chỉ mạng kết nối/NAT/VPN; quốc gia là ước lượng, không phải vị trí GPS hay định danh con người. Dữ liệu cũ thiếu IP không thể suy ngược từ prefix.

## Endpoint và routing

Chỉ một endpoint POST relay collector, cùng domain. Đường dẫn dự kiến `/api/analytics/relay/collect.php` để giữ nguyên phạm vi cookie. Bootstrap tạo loader PHP ổn định và cấu hình child directory tắt Passenger riêng tại đường dẫn đó; loader gọi PHP artifact của release current sau kiểm tra capability. Không tắt Passenger cho /api hoặc sửa routing auth.

Gate đầu tiên trước implementation rộng: thử cách định tuyến hẹp trên app thử/candidate cô lập; xác nhận PHP thực thi, không trả source, cookie đúng path và không ảnh hưởng /api chính. Nếu hosting không hỗ trợ child override, phải quay lại chốt routing; không âm thầm mở Path cookie ra / hoặc đổi định danh khách. Không ghi probe/key vĩnh viễn vào webroot.

Relay không là proxy tổng quát: target/method/path Express cố định trong private config, không nhận URL/IP khai báo từ payload. Không forward Authorization hoặc auth cookie; chỉ anonymous analytics cookie, Origin đã whitelist, UA và DNT/GPC cần cho collector. Set-Cookie anonymous cùng status/header cần thiết được chuyển nguyên nghĩa, không làm mất HttpOnly/Secure/path, không cache. Các giới hạn JSON16KiB, số batch và timeout đều hữu hạn; giới hạn wire gồm envelope cũng phải hữu hạn.

PHP lấy REMOTE_ADDR sau khi áp dụng bộ chặn forwarding header đã đo; validate public IPv4/IPv6, normalize mapped IPv4, không dùng private/loopback làm IP khách. Forwarding-header rejection chỉ áp dụng ingress PHP công khai, không làm Node trust XFF. Nếu sau này thêm CDN/proxy cần kiểm tra lại điều kiện ingress.

## Envelope nội bộ

Một HMAC key ngẫu nhiên riêng, không tái sử dụng auth/analytics/deploy key, ở private config0600 ngoài webroot; frontend không có key. PHP ký canonical version, timestamp ngắn hạn, request ID, method/path cố định, hash raw body, IP, Origin, UA/privacy flags và hash anonymous cookie. Node constant-time verify trước khi sử dụng IP. Invalid/tampered/expired envelope bị từ chối; cùng envelope gửi lại không được tạo phiên hoặc liên kết sản phẩm mới, không ghi đè quan sát IP mới hơn.

Đây là xác thực relay của website, không phải tuyên bố nguồn IP hosting đã được kiểm định toàn diện. Source vẫn là `php_relay`, status `observed`/chưa xác minh. `CLIENT_IP_SOURCE_VERIFIED` giữ false; không dùng relay cho auth/rate limit auth. Collector có thể dùng IP public từ envelope hợp lệ cho bucket network riêng của analytics, vẫn giữ visitor/global caps.

Endpoint Express collector trực tiếp hiện có tiếp tục nhận batch từ tab cũ; không có envelope thì không được khai báo IP. Nếu nhận header envelope mà chữ ký sai phải reject, không downgrade sang unsigned để ghi IP. Tab mới dùng PHP; nếu relay hỏng thì có thể gửi batch cũ tới Node để giữ số liệu nhưng IP phải unknown, không bịa kết quả. Fallback giới hạn theo retry hiện tại, không vòng lặp vô hạn.

## Lưu trữ và GeoIP

Giữ batch15giây, cookie identity, phiên30phút và giới hạn URL/sản phẩm hiện có. Lưu IP/nguồn/thời điểm quan sát và quốc gia/mã quốc gia/phiên bản GeoIP trên phiên. Một cập nhật metadata theo batch/phiên, không thêm bảng lịch sử sự kiện theo click. Quốc gia chỉ tra khi IP đổi/chưa có kết quả; cache có giới hạn theo IP+dataset version, timeout tra cứu không làm mất batch analytics. Quốc gia cập nhật phải thuộc cùng IP và timestamp; dữ liệu cũ trả muộn không ghi đè mới, quan sát nguồn tốt hơn không bị hạ cấp.

Không chỉnh hoặc tái checksum visitor-migrations/001_history.sql đã phát hành. Dùng migration additive/ledger capability riêng theo convention profile/visitor; country/IP-source columns nullable, code cũ bỏ qua. Manifest/receiver/readiness khai báo feature mới rõ ràng (version và asset checksum), không giấu DDL ngoài lifecycle. Builder chốt tên ledger/DTO nhất quán trong plan. Native backup hiện có phải bao gồm schema và row mới.

MMDB ghim version và SHA256, có attribution DB-IP trên UI dùng kết quả. Dataset nằm ngoài FE bundle và được package/verify cùng release; không gọi dịch vụ GeoIP theo request, không tải bản mới trên request. Việc cập nhật dataset là thao tác release có chủ đích; không thêm cron thu thập. Thiếu hoặc sai checksum dataset khiến candidate không qua acceptance; lookup không có record trả unknown. Kiểm tra metadata IPv6 cùng các IP test thực tế, không chỉ dựa tên file.

## Giao diện và local

Trang Khách truy cập giữ nguyên bố cục/filter/charts. Bảng và popup hiện IP đầy đủ với trạng thái chưa xác minh, quốc gia kèm nhãn ước lượng; không hiện tỉnh/thành giả. IP/country của hàng khách theo phiên được chọn gần nhất trong cùng phạm vi ngày; chi tiết từng phiên giữ snapshot riêng. Hiển thị unknown khi thiếu nguồn/kết quả, dữ liệu cũ giữ nguyên; không hồi phục menu nhật ký cPanel.

Local vẫn npm run dev/check/build. Máy Windows chưa có PHP CLI: dùng image PHP chính thức ghim version qua Docker đã là điều kiện DB local, tích hợp tự động vào dev/test tooling; không yêu cầu người dùng chạy thêm lệnh PHP. Express debugger vẫn attach như cũ. Local preview dùng relay/PHP thật khi nghiệm thu, không lấy fixture IP làm bằng chứng host. PHP/Node thiếu readiness phải báo rõ. Builder quyết định chi tiết port/image/stream HTTP adapter và module boundaries trong plan, không đổi yêu cầu một lệnh dev.

## Phát hành, rollback và kiểm chứng

Chỉ production, không cron enrichment. Cập nhật receiver/loader/config từ đúng source/checksum và backup trước activation; PHP code/dataset chọn theo current release. Khi rollback về code cũ, relay loader phải từ chối capability không có hoặc route trả404; dữ liệu mới vẫn còn. Tab mới còn mở có unsigned fallback unknown đúng nghĩa. Không restore đè DB live hoặc down migration.

Gate bắt buộc: PHP lint và cross-runtime HMAC/cookie/body/privacy tests; unit/integration MySQL real; PHP+FE+BE browser local; main CI/check/build; paired restore trên verifier; live relay từ ít nhất hai nguồn khác nhau (Windows/external và hosting, hai mạng ngoài nếu có) bình thường/forwarded giả/tamper/body-cookie-Origin substitution/replay/oversize/timeouts. Đối chiếu IP kiểm soát ở từng nguồn bằng dữ liệu riêng, không log raw IP/token/cookie/key. Ghi rõ nguồn nào chưa đo, không coi request không tới ứng dụng là test pass.

Live UI phải thấy IP và quốc gia ngay sau batch được chấp nhận, không chờ log; kiểm tra IPv4/IPv6 theo khả năng mạng thực tế, no-record/private IP trảunknown; auth/profile/refresh vẫn chạy; product images và old tabs không hỏng. Rollback rồi forward phải giữ lịch sử/IP/country và tắt log importer/TTLcron đã retired. Không báo hoàn tất khi build/test/live verify còn fail. Nếu PHP source vẫn không cung cấp IP phù hợp trên host mới, dừng triển khai relay này và báo bằng chứng; không bật trust bất kỳ header cho xong.

## Nguồn

- Bằng chứng host: docs/superpowers/reports/2026-11-05-client-ip-php-spike.md; docs/superpowers/reports/2026-11-13-cpanel-client-ip-check.md.
- DB-IP: https://db-ip.com/db/download/ip-to-country-lite và https://db-ip.com/db/format/ip-to-country-lite/mmdb.html.
- PHP REMOTE_ADDR: https://www.php.net/manual/en/reserved.variables.server.php.
