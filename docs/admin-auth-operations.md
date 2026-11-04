# Vận hành Admin Auth

## Trạng thái kiểm chứng

Ngày04/11/2026: cPanel trên Edge xác nhận server **10.11.19-MariaDB-cll-lve**, Node24.22.2, client/dump MariaDB10.11.19 tại `/bin/mysql`, `/bin/mysqldump`, `/bin/mariadb`, `/bin/mariadb-dump`. Bộ60 test backend đã qua trên container MariaDB10.11.19; trước đó cũng qua MySQL8.4.13. Runtime DML-only/login/refresh/account UI/analytics đã chạy Chromium riêng trên DB test; kiểm tra tổng thể/UI với engine MariaDB đang được chạy lại. Chưa deploy auth lên production; grants, proxy và backup/restore hosting vẫn cần acceptance. Không đọc credential của DB WordPress có sẵn.

Artifact auth dùng manifest schemaVersion2 với range schema DB và hash migration/catalogue. Receiver cũ chỉ hiểu schemaVersion1 sẽ từ chối artifact này. Không cập nhật receiver/Passenger hoặc phát hành trước khi backup, restore-check, migration, probe và rollback mới đã được kiểm chứng. Các bước hosting bên dưới là yêu cầu acceptance, chưa phải biên bản đã thực hiện.

## Local ít lệnh

Node24 và Docker Desktop phải sẵn sàng. Sau `npm ci`, chạy một lần:

```sh
npm run db:setup:local
```

Lệnh tạo container/volume có nhãn riêng `bibi-local-mysql`/`bibi-local-mysql-data`, chỉ bind127.0.0.1:33385. Setup mới dùng image MariaDB10.11.19 đúng hosting. Container develop MySQL8.4 đã tạo trước đó vẫn được giữ nguyên, không tự chuyển đổi/xóa dữ liệu. DB `bibi_local`; runtime user có SELECT/INSERT/UPDATE/DELETE, migration user chỉ có thêm DDL trên DB local đó. Tự chạy migrate/seed có chủ đích trong lần setup; chạy lại không reset account hoặc quyền đã sửa. Không dùng credential production.

File ignored `.env.local` giữ runtime DB/JWT/analytics config. `.env.migration.local` giữ migration config và password bootstrap local của `admin`/`user01`; xem file trên máy để đăng nhập, không gửi nội dung file vào log/chat. Nếu muốn chỉ định password ban đầu, cung cấp các biến bootstrap trước lần seed đầu tiên. `.superpowers/local-db-root.env` chỉ phục vụ container local.

Sau đó dùng:

```sh
npm run dev
npm run check
npm run build
```

Dev chạy FE/BE cùng một lệnh, kiểm tra `/api/ready`, tự mở lại container local đã khởi tạo nếu đang dừng; không tự migrate/seed. FE mặc định localhost:5173/admin; inspector BE127.0.0.1:9230. Dev từ chối DB ngoài đúng target local. Khởi động server bình thường không sửa schema/account. Chỉ API health không đủ chứng minh DB/auth sẵn sàng.

Check khởi động/reuse đúng container MariaDB test có nhãn tại127.0.0.1:33384, tách khỏi DB develop. Image đã đo/pin là `mariadb@sha256:d769e37960821dfdcf096954f6e7ac89f747e116c1bba98e48edd265dfc7deae`. Mỗi test tạo/drop schema `bibi_test_<random>`; CI dùng BIBI_TEST_DB_* trên loopback. Container MySQL test cũ được giữ/dừng. Không đọc DB_* của application để chọn test DB. UI test dùng Chromium riêng, không điều khiển Edge đã đăng nhập. Lần đầu cài browser bằng `node node_modules/playwright/cli.js install chromium`. Check không skip test integration/UI khi thiếu DB/browser.

Build không kết nối DB và không seed. Artifact có frontend, compiled backend, lockfile, SQL và manifest catalogue với checksum. Không có env, private key hoặc node_modules. Preview artifact dùng `node scripts/preview.mjs <bundle-dir>`; CLI đọc `.env.local`. Chọn allowed origin đúng port preview. Shortcut build --preview còn cần kiểm chứng riêng; dùng hai lệnh build rồi preview.

Thao tác DB có chủ đích từ thư mục backend sau khi compile:

```sh
npm run db:status
npm run db:migrate
npm run db:seed
npm run analytics:cleanup
```

Migrate/seed đọc `.env.migration.local`, status/cleanup dùng runtime `.env.local`. Cleanup tối đa100 session/candidate mỗi lượt; chạy lặp theo lịch để xử lý backlog. Chỉ dọn analytics/counter hết hạn; không phục hồi hoặc reset auth/audit. Với production phải dùng private env/cron của hosting đã duyệt, không copy file local sang hosting.

## Environment

| Biến | Phạm vi |
| --- | --- |
| DB_HOST/PORT/NAME/USER/PASSWORD | Runtime DML trên đúng DB; migration CLI nhận bộ cấu hình riêng |
| DB_POOL_LIMIT | Pool chính1–10, mặc định5; collector riêng2, cần xác nhận tổng quota hosting |
| DB_SOCKET | Tùy chọn socket hosting đã kiểm chứng |
| AUTH_JWT_SECRET | Random ít nhất32 byte, backend only |
| AUTH_JWT_ISSUER/AUDIENCE | Mặc định bibistudio-api / bibistudio-admin |
| AUTH_ALLOWED_ORIGINS | Danh sách origin chính xác, phân tách bằng dấu phẩy; production chỉ HTTPS |
| ANALYTICS_ID_SECRET | Secret riêng cho cookie/identity analytics, ít nhất32 byte |
| RELEASE_PROBE_SECRET | Secret riêng ký probe, bắt buộc khi runtime NODE_ENV=production |
| TRUSTED_PROXY_CIDRS | Để trống trước khi đo proxy; không trust tất cả forwarded headers |
| BIBI_PRIVATE_ENV_FILE | File private tuyệt đối ngoài webroot/releases cho runtime/CLI |
| BIBI_MAINTENANCE_ENV_FILE | Chỉ backup CLI; deployment tự chọn `private/maintenance.env`, không nhận đường dẫn qua SSH |
| DB_VERIFY_NAME | Database riêng, rỗng, khác database production để restore-check; cần quyền DDL chỉ trên DB này |
| DB_BACKUP_FLAVOR | `mariadb` hoặc `mysql`, chọn theo engine đã đo |
| DB_DUMP_BIN / DB_CLIENT_BIN | Binary native được cho phép dưới `/bin` hoặc `/usr/bin`; cPanel này dùng `/bin/mariadb-dump` và `/bin/mariadb` |
| MASTER_ADMIN_PASSWORD/SEED_USER_PASSWORD | Chỉ cần khi explicit seed tạo identity còn thiếu; không ghi đè identity cũ |
| BIBI_TEST_DB_HOST/PORT/PASSWORD | Bộ test riêng, bắt buộc loopback và khai báo đủ ba biến khi dùng CI service |

Không dùng prefix VITE_ cho bất kỳ secret nào. Production Secure cookie tự bật theo NODE_ENV. Cookie analytics và auth có path khác nhau. Access token chỉ memory; refresh token DB chỉ hash. Mất refresh response hoặc reuse có thể yêu cầu login lại theo chủ đích; không nới rotation để che lỗi mạng.

## Checklist acceptance hosting còn phải làm

1. Đo MySQL/MariaDB version, InnoDB/charset/timezone, proxy/IP thực, connection quota và quyền của từng DB account. Giữ npm thực `/opt/alt/alt-nodejs24/root/usr/bin/npm` đã sửa trong đợt trước; không quay lại wrapper CloudLinux lỗi lock path.
2. Tạo DB riêng, runtime DML account, maintenance account và DB restore-verification riêng. File private ngoài webroot/releases, quyền0600; không dùng user DB không giới hạn của hosting. Việc cấp quyền mới phải được review cụ thể trước khi thực hiện.
3. Chuẩn bị backup nhất quán ngoài webroot, hash và phục hồi thử vào DB disposable. Chỉ so canonical dump với bản đã restore, không so live row count trong lúc có ghi mới. Nếu backup/restore-check lỗi thì dừng trước migration/activation.
4. Dưới deploy lock: xác minh artifact schemaVersion2/checksum, backup/verify, migrate có advisory lock, seed idempotent và readiness. MySQL DDL có implicit commit: gặp dirty/checksum lạ phải dừng. Explicit resume chỉ được phép sau khi xác minh DDL đã hoàn thành; không tự stamp complete.
5. Passenger ổn định phải nạp runtime private config và đóng pool ở shutdown. Chỉ switch release sau các bước chuẩn bị đạt. Kiểm chứng login/profile/RBAC bằng account probe giới hạn riêng; không đổi password/status/role của Master hoặc user01 để test.
6. Probe analytics ký đúng release, không lẫn báo cáo thật; host verifier chỉ in assertions/count/hash. Kiểm tra sản phẩm public, ảnh/TinyMCE, API-test FE/BE khớp và client đang mở từ bản trước. Browser smoke thông thường gửi DNT.
7. Rollback app chỉ chọn bản có schema range tương thích; không down-migrate hoặc restore snapshot DB tự động. Account/audit/revocation ghi sau backup phải còn nguyên. Lần rollback đầu về release pre-auth chỉ có public site, admin/API auth sẽ suy giảm/không sẵn sàng; receipt phải ghi rõ điều đó.

Emergency data restore là thao tác bảo trì riêng: dừng ghi, chọn snapshot và xác định khoảng dữ liệu có thể mất, owner duyệt cụ thể rồi mới làm. Không dùng snapshot restore làm diễn tập app rollback.

### Backup và chuyển release trong source hiện tại

Host hook chỉ chạy các CLI cố định của release qua Node, không mở thêm shell command hoặc SQL trong receiver. Bản có auth phải qua kiểm tra SQL/catalogue checksum, schema sạch, backup, restore-check, migrate, seed và kiểm tra schema lần nữa trước khi đổi pointer. Các bước này mới được kiểm thử local, chưa được acceptance trên hosting.

Backup dùng snapshot InnoDB nhất quán; bản restore được dump lại và đối chiếu SHA-256 với snapshot ban đầu. Database verifier phải rỗng; cleanup chỉ xóa đúng các bảng trong snapshot đã xác định. File SQL/receipt nằm dưới `production/backups`, credential file tạm quyền0600 và được dọn sau lệnh. Giữ backup nếu restore-check lỗi để điều tra; không tự phục hồi đè production. Giới hạn mặc định128MiB cho mỗi dump và120 giây cho mỗi native client; vượt giới hạn làm deploy thất bại.

Passenger của release auth đọc đúng `production/private/runtime.env`, ép `NODE_ENV=production`, không lấy secret từ manifest/frontend và không migrate lúc startup. `maintenance.env` tách khỏi runtime. File private phải tuyệt đối, regular, owned0600 trên Linux và không qua symlink. Hướng dẫn native snapshot/option file: [MySQL mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html), [option files](https://dev.mysql.com/doc/refman/8.4/en/option-files.html); flags MariaDB đã được chạy thực tế trên container10.11.19.

## Giới hạn dữ liệu

Account, role, permission, audit và visitor dùng MySQL. Các chức năng kinh doanh/catalogue/content/media hiện có vẫn lưu local trong trình duyệt; đổi port/hostname có thể mở kho khác. Không suy luận các module này đã có backend CRUD chỉ vì login đã được thay.

Analytics là số trình duyệt ẩn danh và sản phẩm quan tâm gần đúng. Cookie bị chặn/xóa, DNT/GPC hoặc thiếu Web Locks có thể giảm/đổi số liệu. Không có raw IP/UA, click timeline, thời gian ở trang hoặc định vị chính xác. Vị trí chưa được xác định, giữ null. Retention/probe phải có lịch cleanup được acceptance trên hosting trước khi coi vận hành production hoàn tất.
