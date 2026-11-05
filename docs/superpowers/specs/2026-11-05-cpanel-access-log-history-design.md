# Lịch sử truy cập từ cPanel — đồng bộ hằng ngày vào MySQL

Trạng thái: owner đã chọn đưa toàn bộ record còn có nguồn vào trang Khách truy cập, lưu độc lập khi cPanel xóa log gốc, cập nhật hằng ngày. Thiết kế chờ owner duyệt; chưa triển khai sản phẩm hoặc đổi production. Thiết kế PHP gateway trước đó tạm dừng.

## 1. Mục tiêu và ràng buộc

Giữ kiến trúc React + Express + MariaDB cPanel. Tận dụng Raw Access có sẵn, không lấy dữ liệu từ màn Visitors giới hạn1000 dòng và không scrape HTML cPanel. Thêm đúng một tác vụ Node.js chạy mỗi ngày; không PHP gateway, dịch vụ bên ngoài, token cPanel, DNS, cookie hoặc thay đổi luồng login.

Nhập mọi record log còn đọc được và giữ lịch sử đã nhập trong MySQL, không đặt giới hạn1000 dòng hoặc TTL90 ngày cho dataset mới. Phân trang để UI nhẹ. Không hứa phục hồi log đã bị hosting xóa trước khi importer có cơ hội đọc, hoặc ghi nhận điều hướng React không tạo HTTP request. Không dùng một request làm một khách/phiên duy nhất.

IP trong nguồn là giá trị webserver ghi nhận, chưa phải IP được xác thực chống giả mạo. Owner muốn ưu tiên Tino sửa nguồn IP; importer không che giấu hoặc tự sửa nguồn bằng IP đoán. Chức năng này không sửa network rate limit của login hiện tại.

## 2. Recon đã chạy05/11

- UI Raw Access: archive đang bật, chu kỳ xử lý thống kê24 giờ; tùy chọn xóa archive tháng trước đang được chọn. Chưa đổi setting nào.
- Node dưới tài khoản vhplasti đọc được /home/vhplasti/access-logs và /home/vhplasti/logs cho đúng domain BiBi. Current files: bibistudio.vn.vhplastic.com và bibistudio.vn.vhplastic.com-ssl_log. Domain alias này được Raw Access xác nhận linked domain bibistudio.vn; không tự áp dụng cho domain khác.
- Đọc bốn gzip archive có giới hạn giải nén, không in raw line/IP: HTTP Nov287, HTTP Oct1966, SSL Nov2382, SSL Oct3610; tổng8245 physical nonempty lines, tất cả có cấu trúc đầu dòng combined-log. Tổng giải nén khoảng1.74MB. Đây chưa phải số lượng event duy nhất hoặc số record đã import.
- Archive Nov bắt đầu từ một phần31/10, vì vậy không dùng tháng trong tên file để lọc loại record theo calendar date. Record có timezone +0700; phải parse offset, lưu UTC, hiển thị giờ Việt Nam.
- Visitors thực tế chứa cả IP fixture giả của spike. Nguồn log không tự trở nên đáng tin chỉ vì nằm trong cPanel.
- Bằng chứng screenshot: bibi-cpanel-archive-preflight.jpg tại visualization workspace; kết quả đọc thành công sau reconnect terminal, banner ABORTED cũ trong ảnh thuộc phiên trước. Chưa xác minh archive tháng hiện tại tăng theo prefix qua hai chu kỳ; đây là điều kiện test/preflight, không là giả định đã chứng minh.

## 3. Các phương án đã cân nhắc

| Phương án | Đặc điểm | Quyết định |
| --- | --- | --- |
| Express đọc log trực tiếp mỗi lần mở trang | Ít state, nhưng mất lịch sử khi cPanel xóa, có thể phải giải nén lại nhiều lần | Không đáp ứng yêu cầu giữ lịch sử |
| Đồng bộ archive hằng ngày vào MySQL | Một cron, đọc file nội bộ, UI truy vấn DB nhanh và độc lập nguồn | Owner chọn |
| Tail log đang ghi liên tục và đối chiếu archive khi rotate | Gần realtime nhưng thêm state, nhiều trường hợp duplicate/lost/truncate | Không cần vì owner chọn daily |

Daily dùng archive làm nguồn canonical, không đồng thời nhập current files. Như vậy tránh đếm hai lần giữa log đang ghi và bản archive. UI ghi rõ thời điểm record nguồn mới nhất và lần đồng bộ, không hứa dữ liệu đến đúng23:59 hôm trước nếu cPanel chưa archive đủ.

## 4. Nguồn và tác vụ đồng bộ

Allowlist duy nhất các archive gzip của bibistudio.vn.vhplastic.com HTTP/SSL trong thư mục logs đã kiểm chứng. Danh sách path được cấu hình một lần bởi deploy, ngoài webroot, không nhận path/domain từ HTTP. Không đọc WP, staging hoặc file khác trong cùng account. Không mở API đọc file tùy ý.

Cron đề xuất mỗi ngày02:30 Asia/Ho_Chi_Minh, quy đổi sau khi đo timezone server; giờ cụ thể là lựa chọn người viết cần owner duyệt. CLI dùng Node24, runtime DB DML user và private config hiện có, pool1, lock chống chạy chồng (cùng deploy lock ở bước chọn current; process dùng đường release bất biến đã chọn). Startup/request web không chạy sync/migration. Một cron do tooling cài, không thêm lệnh dev hằng ngày cho người dùng.

Mỗi lượt:

1. Kiểm tra nguồn, quyền, metadata/checkpoint, dung lượng và DB feature schema; phát hiện các file mới/thay đổi theo allowlist.
2. Chụp snapshot compressed riêng0700/0600 ngoài webroot trước nhập. So metadata và checksum trước/sau copy; file đang đổi thì bỏ qua có trạng thái retry, không nhập snapshot torn. Giới hạn copy/giải nén/time toàn lượt; dùng streaming để không load toàn archive vào RAM.
3. Xử lý archive theo source identity ổn định là basename+HTTP/SSL; order deterministic, không dựa vào timestamp riêng để bỏ qua dòng. Snapshot queue giữ đến khi import hoàn tất, để source bị cPanel xóa sau copy không làm mất phần đang chờ.
4. Batch500 row; insert record và tiến checkpoint trong cùng transaction. Giới hạn tổng120 giây mỗi lượt; hết budget giữ checkpoint/backlog, không ghi complete giả. Lần bootstrap được chạy CLI có chủ đích nhiều lượt cho đến hết8245 dòng và mọi archive còn có nguồn, không chờ nhiều ngày.
5. Hoàn tất file: lưu content hash/prefix checkpoint, số dòng/parse error, source time range và snapshot identity. Chỉ dọn snapshot do chính importer tạo sau khi toàn bộ dữ liệu của nó commit. Không sửa/xóa file của cPanel.
6. Cập nhật status/job receipt count-only, không log URL query, IP, UA hoặc credentials. Không lỗi web nếu importer lỗi; UI hiển thị last success/backlog/gap/source failure đúng thực tế.

Một cron mỗi ngày không đồng nghĩa cPanel đảm bảo log sẵn đúng giờ. File chưa thay đổi là no-op, có last source timestamp. Nếu nguồn không xuất hiện/đọc được hoặc backlog chưa hết, UI báo cảnh báo; không dùng số0 thay cho lỗi.

## 5. Checkpoint, retry và không mất multiplicity

Source basename là logical stream; archive tháng hiện tại có thể tăng/được gzip lại. Event ID dựa source_id+uncompressed line ordinal/byte offset, không dựa chỉ hash nội dung dòng. Hai dòng giống hệt nhau ở hai vị trí là hai request thật và đều phải giữ. HTTP và SSL là stream riêng, không merge chỉ vì dòng giống nhau.

Trước resume, kiểm tra toàn bộ prefix bytes đã commit bằng hash checkpoint. Prefix y hệt: tiếp tục phần append; file không đổi: no-op. Archive được recompress nhưng uncompressed prefix không đổi vẫn cùng stream. Prefix bị thay/thu nhỏ/reorder: đánh dấu source_diverged và dừng riêng stream, giữ snapshot/evidence và cảnh báo; không tự reset rồi insert double hoặc âm thầm bỏ dòng. Partial line chưa kết thúc phải được giữ pending, không advance qua phần chưa parse đầy đủ.

Đây là bảo đảm exactly-once theo stream/position đã xác minh; không giả định request có unique ID trong combined log. Test phải có nhiều gzip members, recompress/append, truncation, source disappearance, crash giữa batch/commit và các dòng giống hệt lặp lại. Production first import phải đối chiếu multiplicity/line counts và replay no-op. Nếu preflight thực tế cho thấy cPanel không duy trì prefix theo stream, không bật cron cho đến khi thiết kế reconciliation được owner duyệt; không thay bằng hash dedup đơn giản.

Canonical archive stream không chồng HTTP/current, nhưng nếu archive nguồn thực sự chứa bản ghi duplicate thì importer giữ theo nguồn và ghi provenance. Không tự đoán bỏ record chỉ từ IP+URL+second.

## 6. Dữ liệu và DB rollback

Feature additive riêng trong cùng DB hiện có: access_log_records, access_log_sources và access_log_import_runs; thêm ledger access_log_migrations cho DDL/checksum của riêng feature. Không thêm row thứ5 vào schema_migrations auth, không sửa SQL001–004 đã deploy, không đổi bảng visitors/session hiện tại. Lý do: readiness của release e725 yêu cầu đúng4 auth migrations; thêm bảng độc lập không phá readiness/rollback của app cũ. Đây là namespace migration rõ ràng cho log, không bỏ kiểm tra DDL hoặc tự stamp complete.

DDL chỉ chạy explicit bằng maintenance account dưới lock, không chạy mỗi job hoặc lúc web startup. Auth schema4 và log feature schema1 đều có status/checksum/readiness/probe riêng. Native backup/restore-check phải bao gồm mọi bảng cùng DB, cả ledger/checkpoint/records mới. Tests phải chạy Passenger factory/status/rollback của release e725 thật với bảng log thêm vào, không chỉ suy luận tương thích từ SQL.

Records gồm source_id, ordinal/offset, row_id ổn định, thời gian UTC, method, pathname, status, bytes, IP prefix đã che, device/OS/browser nhãn chuẩn hóa, referrer đã làm sạch, parse_status. Unique(source_id, ordinal) và index(time,id), source/ordinal, IP prefix/time, pathname/time phù hợp query. Không lưu raw IP, raw UA, cookie, body, query/fragment hoặc toàn raw line vào DB/UI. Chỉ giữ checksum operational cho source integrity, không dùng raw-line hash làm định danh khách. Script/HTML trong field phải được render text, không tự fetch URL hoặc cho browser thực thi.

Record sai format vẫn có một row marker cùng source/ordinal, parse_status/error code và thông tin an toàn có thể đọc; không drop im lặng hoặc lưu raw line có secret. Tổng imported rows + pending/error counts được reconcile với physical input lines, blank lines có counter riêng. Không tuyên bố mọi field parse đúng chỉ từ combined-like prefix đã đo.

Không tự xóa dữ liệu DB theo90 ngày như tracker; không chạy cleanup visitor trên bảng log mới. File nguồn bị xóa sau successful import không xóa row đã nhập. Lưu lâu dài phụ thuộc quota: cảnh báo trước khi DB/disk/backup vượt ngưỡng; dừng import có cảnh báo khi hết headroom, không purge record hoặc làm website chết. Native backup hiện giới hạn128MiB; phải theo dõi dung lượng snapshot và verifier headroom, không tự nới/tắt backup verification để deploy. Mở rộng storage/backup là thao tác vận hành riêng khi thực sự cần.

## 7. Một trang Khách truy cập, hai nguồn rõ ràng

Giữ một mục menu và một route hiện tại. Thêm chế độ “Nhật ký cPanel” trong chính trang, mặc định khi vào trang theo đề xuất người viết; chế độ “Khách và sản phẩm” giữ tracker hiện tại. Không thêm3 trang analytics hoặc nối cứng các record bằng IP+UA. Cùng customer_access.view/RBAC hiện tại; User vẫn chỉ xem trang được cấp, không được đọc file/config hoặc sửa/import qua API.

Nhật ký hiển thị một dòng/request với ID bản ghi, thời gian, IP đã che, URL pathname, method, HTTP status, device/OS, browser; thông tin bytes/source/referrer ở xem chi tiết. Không gán session ID, vị trí hay danh tính khách khi log không có; không gọi request count là visitor count. Có lọc ngày, IP, URL, nhóm trang/ảnh/API/bot (bot chỉ là nhãn ước lượng từ UA), status; mặc định không loại record nhóm nào. Phân trang server20/50/100, tổng record và toàn bộ lịch sử khả dụng, không tải all records vào một response hoặc cap1000. Count và list áp dụng cùng filter.

Hiển thị “Đồng bộ hằng ngày”, lần sync thành công, “Dữ liệu đến…”, tổng record, backlog và lỗi nguồn nếu có. Hệ thống không nhận nút UI tải file/path tùy ý hoặc trigger job không giới hạn. Có thể filter/toàn lịch sử, không mặc định cutoff90 ngày của tracker. Bảng responsive dùng components hiện tại, không thêm chart library hoặc framework mới.

Nguồn cPanel không có cookie/opt-out/DNT/GPC trong combined log nên không thể áp dụng ngược lựa chọn tracker cho từng dòng lịch sử. Dataset được ghi rõ là nhật ký request máy chủ, tách khỏi phân tích khách/sản phẩm; không dùng nó để tạo lại visitor identity hay lách privacy opt-out của tracker. Tracker vẫn giữ DNT/GPC/opt-out và TTL90 ngày. Phần giới thiệu dữ liệu cần diễn đạt minh bạch hai nguồn; không tuyên bố server logs có cùng phạm vi opt-out như tracker hoặc đạt một tiêu chuẩn pháp lý chưa đánh giá.

## 8. Artifact, dev, vận hành và rollback

Manifest schemaVersion3 cho release có feature accessLogs, gồm hash SQL/feature schema range1..1 và capability; DB auth metadata vẫn4..4. Tool mới đọc1/2/3 đúng cấu trúc, tool cũ từ chối3. Archive vẫn chỉ manifest/frontend/backend; log migration/CLI nằm backend, không mở archive root tùy ý hoặc đưa log/private env vào bundle. Feature migration assets checksummed riêng, readiness không đòi log schema ở release trước feature.

Local vẫn npm ci, npm run dev, npm run check/build. Fixtures gzip synthetic nằm test, local không đọc log hosting hoặc cần token/PHP. Dev DB setup explicit tạo feature schema; không migrate tự động. Check chạy importer/SQL/API/UI + bộ tests hiện có; generated frontend catalogue/public bundle không được kéo parser Node vào graph.

Production: CI artifact đúng SHA → upgrade trusted tools theo hash → verified DB backup/restore-check → explicit feature migration/status → bootstrap import theo batch → activate app → API/UI probe → cron daily và verify một lượt job thật. Cron config một lần do agent/tooling chuẩn bị, lấy private runtime env và release path cố định sau lock; không yêu cầu người dùng nhập nhiều setting hoặc lệnh thường xuyên. Không tự thay settings archive/prune của cPanel trong đợt này; ghi rõ rằng chưa imported trước khi cPanel xóa thì không phục hồi được. Theo dõi gap/backlog trước lịch prune, không hứa100% historical coverage khi không còn source.

Rollback app giữ toàn bộ bảng log/checkpoint/data mới; không down-migrate hoặc restore đè DB. Cron kiểm tra current support CLI rồi skip nếu rollback về e725; job đang chạy giữ deploy lock đủ để không bị prune release đang thực thi. App e725 dùng bảng tracker cũ và không có chế độ log; sau phát hành lại feature, importer tiếp tục từ checkpoint, không nhân đôi. Thực hiện drill quay về e725 rồi phát hành lại với record mới và auth revocations đã ghi sau backup còn nguyên.

## 9. Acceptance và bàn giao

- Initial import tất cả archive hiện còn đọc được; đối chiếu mỗi file counts/positions và lỗi parse, không dùng8245 làm hằng số khi source đã thay đổi. Re-run no-op; duplicate identical lines không mất multiplicity. Xóa bản sao source fixture sau import, DB vẫn xem được.
- Crash/commit/lock/concurrency/recompress/append/rotation/divergence/partial/corrupt gzip/permission/path traversal/resource limits; dùng MariaDB thật. CPanel live preflight phải chứng minh append/prefix behavior hoặc dừng chưa phát hành.
- API JWT/RBAC User/Admin, filter/count/pagination >1000 records và last source status. UI desktop/mobile cùng components, không lộ IP raw/query/token/UA; không fake session hoặc nhập vào product-interest reports.
- CPanel settings/DB/source/backups không bị xóa ngoài scope; cron daily đọc đúngdomain; app/public images/TinyMCE/auth/refresh/visitor tracker vẫn qua. Feature/main checks/build và real UI phải green.
- Production native backup/restore-check bao gồm feature tables; rollback/re-release giữ log mới, checkpoint và account/audit/revoked sessions; actual screenshot/receipt/run IDs, docs cập nhật. Không báo hoàn tất nếu nhập đủ source, daily job, UI hoặc rollback còn thất bại.

## 10. Các đề xuất cần owner duyệt

Owner đã chốt daily + giữ lịch sử độc lập cPanel. Người viết đề xuất thêm: daily02:30 giờ VN; archive-only (không realtime current log); không auto xóa DB; giữ IP che và bỏ query/raw UA; một trang có2chế độ nguồn, mặc định Nhật ký cPanel; feature tables/ledger riêng để không phá auth rollback. Bảng log là server request records, không phải danh sách người/phiên xác định.

Builder tự chọn tên file/helper/test harness và chi tiết parser chuẩn escape/encoding, SQL types/indices sau đo query, cách snapshot/checkpoint streaming trong các ràng buộc trên. Không tự bỏ record parse lỗi, reset source diverged, hạ bảo vệ quyền hoặc nới backup để có kết quả green. Nếu giới hạn hosting làm không đạt, báo bằng chứng và điều chỉnh thiết kế trước implementation tiếp.

## 11. Builder check

Review độc lập05/11 đã đối chiếu source/thiết kế và kết luận không còn câu hỏi quan trọng buộc builder phải đoán để lập plan. Review xác nhận các điều kiện cần chứng minh: prefix archive, multiplicity theo vị trí, retry/checkpoint/gzip, migration feature riêng giữ auth4, rollback thực tế, không trộn request với người/phiên và không gọi IP log là trusted. Đây là review thiết kế, không phải kết quả importer/API/UI đã được triển khai. Chờ owner duyệt tài liệu trước khi viết implementation plan.
