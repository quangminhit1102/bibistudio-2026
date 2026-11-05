# IP khách thực qua PHP gateway trên cPanel

Trạng thái: TẠM DỪNG PHƯƠNG ÁN GATEWAY. Sau khi xem thiết kế, owner yêu cầu kiến trúc đơn giản, ít cấu hình/vận hành. Chưa duyệt tài liệu này; không lập plan hoặc triển khai gateway theo tài liệu này khi chưa chốt lại phương án đơn giản hơn. Kết quả spike vẫn là bằng chứng kỹ thuật, không phải yêu cầu phải giữ gateway.

## 1. Mục đích và bằng chứng

Trang Khách truy cập cần IP nguồn đáng tin cậy, và login/refresh cần giới hạn theo mạng khách thay vì gom tất cả vào loopback. Giữ React + Express + MariaDB, cPanel, ít lệnh local, production-only/manual workflow và rollback giữ dữ liệu.

[Spike05/11](../reports/2026-11-05-client-ip-php-spike.md) đã chạy PHP thật trên hosting từ hai mạng. PHP nhận IP ngoài; nhưng REMOTE_ADDR có thể bị X-Forwarded-For giả làm thay đổi đối với request từ hosting. Bộ chặn header đặt trước xử lý IP đã chặn20/20 request giả trên hai mạng;4 request bình thường có IP không loopback, ổn định trong từng mạng và khác nhau giữa hai mạng. PHP HMAC được Node xác minh. Probe/key đã gỡ; app đang live vẫn chưa có gateway.

Không suy rộng phép thử thành chứng nhận an toàn cho mọi cấu hình hosting. Production phải lặp kiểm tra nguồn IP/header trước phát hành và có probe định kỳ. Không tuyên bố xác định được người thật từ IP: NAT/VPN có thể dùng chung hoặc đổi IP; cookie vẫn định danh trình duyệt/phiên. Giữ chính sách IP đã che /24 IPv4, /48 IPv6, vị trí null.

## 2. Phạm vi

- Gateway PHP nhỏ, không Composer/framework/vendor mới; secret ngoài webroot. Express giữ auth, RBAC, collector và MySQL.
- Sáu POST đi qua gateway: auth/login, auth/refresh, auth/logout, auth/revoke, analytics/collect, analytics/opt-out.
- Các GET/profile/accounts/roles/permissions và API khác vẫn gọi Express như hiện tại, kiểm tra JWT/RBAC như cũ. Không chuyển catalogue/content/kinh doanh thành backend CRUD.
- Thay đổi frontend chỉ ở HTTP transport và tracker; không redesign UI, không thêm SDK IP hoặc gọi dịch vụ IP bên ngoài.
- Gateway không sửa DNS, không gửi dữ liệu sang dịch vụ mới, không đụng website/DB khác và không bật trust proxy rộng.

## 3. Các phương án

| Phương án | Đánh đổi | Quyết định |
| --- | --- | --- |
| Tino sửa LiteSpeed/Passenger chuyển IP tin cậy | Ít lớp nhất nhưng phụ thuộc quyền quản trị của Tino; .htaccess đã thử chưa xử lý được | Phương án thay thế nếu hosting hỗ trợ về sau |
| PHP gateway dùng REMOTE_ADDR, chặn header chuyển tiếp, ký server-to-server | Chủ động bằng quyền cPanel; thêm một PHP hop và cần bảo vệ/đóng gói cookie, chữ ký, replay | Owner đã chọn sau spike |
| Cloudflare Worker/gateway ngoài | Thêm dịch vụ, tài khoản và trust boundary, có thể thêm DNS/chi phí vận hành | Không chọn trong đợt này |

Chỉ ký REMOTE_ADDR mà không chặn header là phương án bị loại bởi spike.

## 4. URL và luồng request

Public entry cố định đề xuất `/bibi-gateway.php?route=<id>`. Route ID là enum, không phải URL/path người gọi được tự chọn:

| ID | Upstream cố định |
| --- | --- |
| auth.login | POST /api/auth/login |
| auth.refresh | POST /api/auth/refresh |
| auth.logout | POST /api/auth/logout |
| auth.revoke | POST /api/auth/revoke |
| analytics.collect | POST /api/analytics/collect |
| analytics.opt-out | POST /api/analytics/opt-out |

URL upstream duy nhất lấy từ cấu hình private đã kiểm tra, mặc định HTTPS bibistudio.vn:443. Không nhận Host/URL/port/path đích từ query hoặc header client. Không follow redirect, không tắt TLS verification, không dùng proxy từ environment. Không forward một URL tùy ý.

Browser → PHP kiểm tra ingress → ký request → HTTPS tới route Express cố định → Express xác minh và chống replay → nghiệp vụ cũ. Response được relay với whitelist header/cookie. Không đưa chữ ký chứa IP hoặc secret về frontend.

Public bootstrap PHP ổn định ở document root, ngoài thư mục release; chỉ đọc current/manifest và require module PHP của đúng release ngoài webroot. Root .htaccess cần exemption rõ cho đúng một entry này; áp dụng cả khi rollback. Không đặt gateway production trong .well-known như probe. Không thay mount /api hoặc app Passenger khác.

Bootstrap lấy release bằng readlink/kiểm tra đường dẫn current thuộc production/releases; không dùng input HTTP làm file path. Loại symlink/file bất thường và path vượt root. Xóa realpath/stat cache cần thiết trước resolve; require bằng đường dẫn release bất biến để tránh opcode/realpath cache dùng code cũ. Có acceptance chuyển nhanh/rollback kiểm tra đúng release PHP và Node. Không chỉ giả định PHP cache cập nhật sau đổi symlink.

## 5. PHP: ingress và nguồn IP

- Chỉ POST; enum route đúng; JSON content-type; X-Bibi-Request=1; Origin đúng một trong hai origin HTTPS đã cấu hình. Không wildcard CORS hoặc sửa Origin thành giá trị hợp lệ thay người gọi.
- Trước dùng REMOTE_ADDR, từ chối request có X-Forwarded-For, X-Real-IP, Forwarded, Client-IP, CF-Connecting-IP, True-Client-IP, X-Cluster-Client-IP; kiểm tra cả tên chuẩn hóa underscore/case như spike. Từ chối header X-Bibi-Gateway-* từ client, không cho ghi đè metadata nội bộ.
- REMOTE_ADDR phải là IP hợp lệ, chuẩn hóa IPv4-mapped IPv6; production không chấp nhận loopback/private/reserved/malformed làm địa chỉ khách. Không fallback sang header hay IP frontend khai; nguồn không hợp lệ trả503 và không ghi analytics IP sai.
- Mã ứng dụng không lưu raw IP vào file/log/DB. IP đầy đủ chỉ ở memory và trong envelope server-to-server HTTPS; Express mask trước persistence/hashing theo quy tắc hiện tại. Access log do hosting quản lý là phạm vi riêng, không hứa rằng gateway xóa hoặc thay được log của LiteSpeed.
- Đọc body tối đa16384 byte bằng bounded stream; tính hash trên đúng raw bytes, không decode/encode JSON trước forward. Có giới hạn header tổng và độ dài UA/Authorization/Cookie; UA chỉ được forward giới hạn512 byte, không log.
- Forward whitelist: Content-Type, Origin, X-Bibi-Request, UA, DNT, Sec-GPC, Authorization khi route cần, cookie đúng tên của route, X-Bibi-Probe phục vụ release probe hiện tại. Không forward Host, Connection, Transfer-Encoding, các header proxy hoặc cookie khác của domain.
- Chưa support CDN/proxy hợp lệ chèn các header bị cấm. Nếu thêm Cloudflare/CDN sau này phải đổi thiết kế trust boundary và kiểm thử lại; không âm thầm bỏ bộ chặn.

## 6. Envelope và xác minh tại Express

Protocol1: PHP tạo nonce128bit bằng random_bytes, issued-at epoch milliseconds, kid, releaseId, method, upstream pathname chính xác, body SHA256, client IP và bản chụp các security header đã whitelist. Bind cả Origin, Content-Type, UA, DNT/GPC, X-Bibi-Request, probe marker, hash raw Cookie và hash Authorization được forward. Trường thiếu có biểu diễn rỗng cố định. Không cho parser nhận thêm trường mơ hồ.

Serialize JSON theo hợp đồng cố định, encode base64url; HMAC-SHA256 trên đúng payload bytes. PHP và Node dùng cùng cách decode secret32byte từ cấu hình; không nhầm hex text với bytes. Header metadata giới hạn kích thước và encoding canonical. Kid chỉ chọn key đã cấu hình, không làm đường dẫn.

Express giữ trust proxy=false. Middleware chỉ gắn trustedClientIp sau khi toàn bộ điều kiện đạt: schema/encoding, constant-time MAC, releaseId hiện tại, method/path/body hash/header binding, IP normalization, issued-at không quá30 giây và không hơn5 giây trong tương lai, nonce chưa dùng. Dùng raw body từ verify hook của express.json với limit cũ; không ký lại object JSON. Mọi lỗi thiếu/sai proof trên6 route production đều fail closed, không fallback về req.ip.

Không đổi req.ip toàn ứng dụng. Collector và throttle login/refresh dùng resolver trustedClientIp; JWT/RBAC vẫn độc lập với IP. API/readiness/probe không vô tình mở đường bỏ qua xác minh. DB hoặc key thiếu trả503; sai proof403; replay409; lỗi đều có response/error chung an toàn.

### Replay không thêm schema mới

MySQL hiện có rate_limit_counters với unique bucket hash và expiry. Dùng namespace gateway riêng, hash kid+nonce. Trong transaction, upsert row hits=0 không reset row cũ, lock row, chỉ nhận khi hits=0 rồi set hits=1/expiry ít nhất60 giây. Duplicate, kể cả các Passenger process đồng thời, bị từ chối. Verify MAC/timestamp trước DB write. Nonce đã nhận vẫn bị tiêu thụ nếu nghiệp vụ phía sau lỗi; PHP không tự retry upstream. Browser retry tạo một request PHP mới với nonce mới.

Không tái dùng một nonce đã expired nhưng còn row; không reset hit để nhận lại proof cũ. Cleanup chỉ xóa counter đã hết hạn, sau cửa sổ chấp nhận chữ ký. Không đổi migrations001–004, không thêm migration005; giữ schema4 để rollback về auth release hiện tại vẫn tương thích.

Thêm maintenance CLI riêng cho expired counters, bounded tối đa1000 row mỗi lượt, cron mỗi phút, lock chống chồng. Dùng runtime DML, log count-only0600; kiểm thử không xóa counter chưa hết hạn. Schedule bỏ qua khi current không có CLI mới; giữ cron analytics/auth cũ. Đo backlog/quota trong acceptance, không khẳng định bound throughput chỉ từ sample probe.

## 7. Cookie, refresh và lỗi

Đường dẫn cookie public mới: `/bibi-gateway.php` cho bibi_refresh và bibi_visitor. Tên cookie, HttpOnly, Secure production, SameSite=Lax, TTL/rotation/logout giữ nguyên. Gateway forward duy nhất bibi_refresh cho auth, bibi_visitor cho analytics; upstream Express giữ cookie contract /api/auth hoặc /api/analytics và gateway rewrite Path ở response sang public entry. Không forward cookie trùng tên/mơ hồ; không split Set-Cookie bằng dấu phẩy; chỉ rewrite đúng cookie/path đã biết, chặn Set-Cookie/Domain ngoài whitelist.

Tất cả6 route đi qua cùng gateway entry; auth/profile GET vẫn dùng memory bearer, không phụ thuộc refresh-cookie path. Giữ credentials:include, single-flight/Web Locks/epoch; PHP không cache response hoặc token. DNT/GPC/opt-out vẫn hoạt động qua transport mới.

Lựa chọn của người viết cần owner duyệt: chuyển lần đầu yêu cầu đăng nhập lại một lần. Cookie cũ ở /api/auth và /api/analytics không tới entry PHP; response thích hợp xóa cookie cũ tại đúng2 path, không di chuyển refresh token ra JavaScript. Không reset mật khẩu, role, account hoặc revoke toàn bộ session chỉ để đổi đường cookie. Visitor cookie có thể tạo identity trình duyệt mới một lần; dữ liệu lịch sử không bị xóa.

PHP không retry login/refresh/collector tự động khi upstream timeout hoặc mất response; giữ semantics rotation hiện có. Timeout tổng ban đầu8 giây/connect2 giây, response tối đa64KiB. Có response503 JSON chung khi PHP busy/upstream lỗi; không trả curl error, stack, body hay header chứa credential. Chỉ relay response status/JSON và header whitelist cần thiết, giữ nhiều Set-Cookie riêng.

Giới hạn concurrency ở PHP bằng private slot files/flock không chặn:2 slot auth,2 slot analytics, giữ tới khi đọc xong upstream, finally release; hết slot503. Precreate file0600/dir0700 ngoài webroot, không nhận filename từ client. Ngăn PHP chiếm tất cả40 entry processes trong lúc mỗi request còn cần một Node upstream. Đây là mức khởi đầu cần đo, không phải hứa chịu tải cao. Node collector vẫn giới hạn2 và pool hiện tại3+2.

## 8. Secret, local và artifact

Secret gateway độc lập, không lấy JWT/analytics/probe key. Lưu key-ring nhỏ cùng kid hiện hành ở private config0600 ngoài webroot; PHP/Node dùng cùng cấu hình trusted. Không có secret trong VITE, GitHub artifact, log hoặc browser. Rotation có kid cũ trong cửa sổ ngắn, đổi config dưới deploy lock rồi restart Node; chỉ retire key cũ sau mọi process cập nhật/cửa sổ proof hết. Không làm rotation trong đợt này trừ bootstrap key đầu được owner cấp quyền cụ thể.

Dev bình thường vẫn npm run dev với FE+BE direct localhost; không buộc người dùng cài/chạy PHP để sửa UI. Production bắt buộc gateway cho6 route; dev/test direct mode chỉ từ trusted startup config không phải header/query, không thể bật bằng env thiếu khi NODE_ENV=production. Test tích hợp PHP thật chạy trong môi trường riêng do npm run check điều phối, không cần thêm lệnh tay hoặc secret hosting.

Artifact gateway có directory gateway ngoài frontend/backend và PHP bootstrap riêng có checksum. Manifest mới schemaVersion3 gồm DB metadata không đổi và gateway protocol/files checksums/bootstrap hash. Receiver cũ phải từ chối version3; receiver mới nhận1/2/3 đúng cấu trúc, verify allowlist/archive/PHP files trước install. Trusted host tool bootstrap theo source/hash như đợt auth; app archive không tự thay tools. Không để deploy tool cũ nhận nhầm artifact gateway mà bỏ qua kiểm tra.

PHP module release và bootstrap được lint; production preflight đo web PHP version đang được support, curl/hash/random_bytes/flock, TLS CA, quyền private và khả năng HTTPS self-call. Đề xuất PHP8.3+ nếu domain có sẵn; không thay PHP của domain khác. CLI PHP và web PHP phải được đối chiếu, không lấy CLI lint làm bằng chứng web extension đã có. Không đạt preflight thì dừng trước activation.

## 9. Deploy và rollback

1. Main CI kiểm tra PHP + Node + MariaDB + browser, build một artifact có FE/BE/PHP/hash đúng release. Không rebuild khi promote.
2. Qua cPanel cấp key/config gateway đầu và slot files đúng scope, backup stable bootstrap/routing/config dưới lock. Entry giữ private code ngoài webroot. Bước cấp secret lâu dài phải có owner xác nhận cụ thể trước thực hiện.
3. Install trusted tools mới, vẫn xử lý được release1/2 hiện có. Chuẩn bị artifact3, native DB backup/restore-check và status schema4 như hiện tại.
4. Đổi current và routing dưới lock, restart Passenger; stable PHP đọc module từ current. Preactivation không bật public proof requirement trên backend cũ.
5. Probe public gateway:2mạng, header giả, signed PHP→Node, login/profile/403s/rotation/logout, collect/dedup/probe exclusions/privacy. Direct6route không proof phải bị từ chối. Readiness khai báo transport/protocol nhưng không lộ key/IP. FE/BE/PHP release phải khớp và thử tab cũ.
6. Nếu probe không đạt, tự phục hồi pointer/routing/bootstrap cần thiết, restart và verify app cũ; giữ DB mới ghi, không restore snapshot DB.

Rollback về e725 auth/schema4 không bị migration mới chặn. UI của release cũ dùng direct /api như trước; IP lại suy giảm về loopback và receipt phải ghi rõ. Stable gateway entry khi current không support trả409 GATEWAY_NOT_SUPPORTED, không relay unsigned vào backend cũ. Frontend mới còn mở hiển thị yêu cầu tải lại/đăng nhập lại khi gặp version mismatch, không retry vô hạn hoặc âm thầm bypass gateway. Tab cũ trước cutover có thể phải tải lại khi direct refresh/collect bị chặn; dữ liệu collector chưa gửi không được hứa giữ qua chuyển version.

Từ release gateway trở đi, rollback giữa các release cùng protocol giữ nguyên entry/cookie path/key. Diễn tập quay về e725 rồi phát hành lại, xác minh dữ liệu account/audit/revocation và visitor mới còn nguyên. Không tuyên bố IP còn đúng trong khoảng đang chạy bản trước gateway. Schema4/native backup/rollback hiện có được giữ.

## 10. Điều kiện nghiệm thu

- Real PHP normal traffic từ hai mạng nhận IP không loopback và tag khác nhau; spoof7headers, combined, underscore, multi-IP đều bị chặn. HTTP/web PHP cURL→Express chạy thật, không chỉ unit.
- Unit/integration: canonical payload, IPv4/IPv6/mapped, malformed/oversized headers/body, wrong key/kid/route/body/cookie/auth/UA/privacy/probe binding; expired/future/reused signatures và replay đồng thời nhiều process; missing key/DB fail closed.
- Browser thật: Admin/User đúng RBAC; login, reload restore,401 đồng thời chỉ1refresh, logout/revoke, expired cookie, lỗi upstream. Cookie flags/path/multi Set-Cookie/old cookie cleanup được kiểm chứng.
- Collector thật: batch/dedup/DNT/GPC/opt-out, quan tâm sản phẩm và masked source IP; probe không lẫn report. Thử trực tiếp Node không có proof phải fail.
- Bounded concurrency/lỗi slot/cleanup, nonce counters không tăng vô hạn sau TTL, quota và PHP self-call timeout; production smoke nhỏ có kiểm soát, không load-test phá hosting.
- Main CI/check/build tất cả qua; release checksum/FE/BE/PHP khớp; website ảnh/TinyMCE/old client không lỗi. Production rollback/re-release với dữ liệu và revoked sessions giữ nguyên; screenshot thật và biên bản. Không báo hoàn tất nếu IP thật hoặc các bước này chưa qua.

## 11. Các lựa chọn người viết đề xuất

Owner đã chọn phương án gateway sau spike, chưa mặc định đã duyệt mọi chi tiết dưới đây: entry URL và enum6route; giữ schema4/reuse counter table;2+2PHP slot;8s timeout; đổi cookie path và chấp nhận đăng nhập/visitor identity mới một lần; giới hạn direct-traffic không CDN; manifest3 và version-mismatch yêu cầu reload. Những lựa chọn này tối ưu quyền cPanel hiện có, code nhỏ và rollback thực dụng.

Builder được chọn tên module/file cụ thể, cấu trúc helper sâu, fixture/test harness PHP riêng (không ship test adapter), pinned official PHP image đã xác minh và thông báo tiếng Việt ngắn. Không được tự đổi các trust/rollback/cookie semantics hoặc giảm bài test để tránh hạn chế hosting. Nếu cURL, routing hay opcode cache không vượt preflight, phải báo bằng chứng và quay lại chọn phương án; không mở trust proxy hoặc bỏ signature để chạy được.

## 12. Builder check

Review độc lập05/11 đã đối chiếu thiết kế với spike, cookie, routing/deploy và schema4 hiện có; kết quả: không còn câu hỏi quan trọng buộc builder phải đoán để lập plan. Đây là review thiết kế, không phải bằng chứng code/gateway production đã hoàn tất. Chờ owner duyệt tài liệu rồi mới viết implementation plan.
