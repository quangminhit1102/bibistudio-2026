# Hồ sơ admin: cấu hình, backup và rollback

Trạng thái: triển khai và kiểm chứng local; chưa cài receiver/config mới lên cPanel. Không suy ra production đã sẵn sàng từ test local.

## Local

Node24, Docker Desktop. Chạy lại `npm run db:setup:local` một lần để áp dụng migration hồ sơ riêng và tạo `.superpowers/local-profile-assets` ngoài webroot. Sau đó vẫn dùng `npm run dev`, `npm run check`, `npm run build`. Server/dev không tự migrate hoặc seed lúc khởi động. Không nhập secret hosting vào local.

Identity giữ schema4; profile có ledger/checksum riêng, phiên bản1. Migration chỉ thêm cột nullable `users.phone`, `users.avatar_id` và bảng metadata ảnh. Không down migration khi rollback code. Backend cũ không hiển thị các trường mới nhưng giữ dữ liệu qua các lệnh update cũ.

## Chuẩn bị cPanel trước một đợt phát hành được duyệt

1. Đo tài nguyên Node24 thực tế: bộ giải mã JPEG/PNG thuần JS chạy worker riêng. Local PNG16MP ghi nhận khoảng254MiB peak RSS khi chạy riêng và khoảng313–324MiB trong các bộ kiểm thử tổng, không phải cam kết bộ nhớ hosting. Worker heap128MiB không giới hạn cứng Buffer/native RSS. Nếu hosting thiếu headroom phải giảm giới hạn hoặc dừng phát hành.
2. Tạo `production/private/profile-assets` do đúng user Passenger sở hữu, mode0700, ngoài webroot/releases; file ảnh0600. Thêm cùng một giá trị tuyệt đối `PROFILE_ASSET_DIR=/.../production/private/profile-assets` vào cả `private/runtime.env` và `private/maintenance.env` (0600). Không đặt upload vào Git/artifact.
3. Nâng cấp receiver cùng bộ `ops/*.cjs` liên quan, bao gồm `profile-metadata.cjs`, `profile-lifecycle.cjs`, `release.cjs`, `database-lifecycle.cjs`, `deploy.cjs`, `receiver.cjs`. Receiver cũ từ chối manifest4; không được thử bỏ trường profiles để lách kiểm tra. Receiver mới vẫn nhận manifest1/2/3 theo các cổng identity/access-log hiện có.
4. Kiểm tra executable backup đã đo (`DB_BACKUP_FLAVOR`, `DB_DUMP_BIN`, `DB_CLIENT_BIN`, `DB_VERIFY_NAME`) và quyền verifier cô lập. Không restore lên DB ứng dụng.
5. Chỉ sau đó phát hành đúng artifact CI và kiểm chứng API/UI, upload thật, paired restore, rollback rồi forward trên hosting. Các bước này chưa được thực hiện trong đợt local.

Lệnh riêng của tool, chạy từ release đã xác minh:

```sh
NODE_ENV=production BIBI_PRIVATE_ENV_FILE=/.../production/private/maintenance.env node backend/dist/profile/cli.js status
NODE_ENV=production BIBI_PRIVATE_ENV_FILE=/.../production/private/maintenance.env node backend/dist/profile/cli.js migrate
NODE_ENV=production BIBI_MAINTENANCE_ENV_FILE=/.../production/private/maintenance.env node backend/dist/profile/backup-cli.js <SHA>-<CI_RUN_ID>
NODE_ENV=production BIBI_PRIVATE_ENV_FILE=/.../production/private/maintenance.env node backend/dist/profile/cli.js cleanup
```

Không cần chạy thêm lệnh hằng ngày cho developer. Cleanup production chưa được gắn cron.

## Paired backup và khôi phục

Receiver dùng tool có profile của release hiện tại hoặc ứng viên, kể cả rollback về release cũ. Khi đã có cấu hình/dữ liệu profile mà không còn tool có khả năng backup đôi, receiver từ chối chuyển release. Chỉ một bản lịch sử có tool trong kho chưa đủ: tool phải thuộc release đang chạy hoặc ứng viên. Giữ ít nhất một release có profile tool để chọn làm ứng viên forward; không prune thủ công release này khi còn dùng backend cũ.

Tool giữ advisory lock `bibi-profile-assets:<database hash>` trong suốt snapshot ảnh, native consistent DB dump, restore vào verifier riêng, đối chiếu checksum DB và đọc từng ảnh được DB restore tham chiếu. Lệnh sửa hồ sơ dùng cùng lock; không commit một phần trong thời gian backup. Không khóa toàn bộ DB cho các chức năng không sửa ảnh.

Mỗi thư mục `backups/profile-<uuid>` có SQL, `assets/<uuid>.<png|jpeg>`, manifest và SHA256 manifest. Manifest ghi hash/size SQL và hash/size từng ảnh. Chỉ trả receipt thành công khi restore/check hoàn tất. Thư mục0700/file0600; ảnh backup giữ nguyên UUID, không mã hóa lại. Các bản dở dang được giữ để điều tra và khiến cleanup fail closed; người vận hành kiểm tra trước khi xóa riêng bản lỗi. Không có tự động restore production; khi cần khôi phục dữ liệu phải dùng đúng DB dump và assets cùng bộ, thử verifier trước, dừng ghi, rồi khôi phục theo đợt riêng được duyệt. Rollback code thông thường chỉ đổi release, không restore DB cũ và không làm mất dữ liệu phát sinh sau backup.

## Retention

Ảnh bị thay/xóa chỉ nghỉ sử dụng, giữ ít nhất30ngày. Cleanup kiểm tra mọi `users.avatar_id`, metadata và mọi backup đang giữ; ảnh được backup pin thì không xóa. File UUID không có metadata chỉ được dọn sau24giờ. File lạ/.pending không bị xóa mù; cần kiểm tra thủ công sau lỗi hệ thống. Không sửa trực tiếp manifest để bỏ pin.

Chưa tự xóa backup. Chính sách vận hành khuyến nghị giữ tối thiểu30ngày và mọi mốc rollback còn được cam kết; chỉ xóa nguyên bộ backup hết hạn sau khi xác nhận mốc rollback không còn cần. Giữ các backup còn lại sẽ tiếp tục pin ảnh, đổi lại tăng dung lượng. Tool giới hạn10000ảnh/1GiB cho một snapshot và10000entry thư mục backup; vượt giới hạn dừng an toàn để người vận hành điều chỉnh kiến trúc/dung lượng.

Mỗi user tối đa128ảnh metadata lưu giữ/64MiB; upload tối đa10lần/15phút theo actor trong DB, một worker/process. Chạm quota cần chờ cleanup theo chính sách, không xóa ảnh đang dùng hoặc ảnh đang được backup pin để lấy chỗ. JPEG/PNG8bit không interlace; không nhận APNG/PNG16bit. Input2MiB/16MP, output512×512 tối đa; không giữ EXIF/metadata. Ảnh chỉ tải qua Bearer request rồi tạo ObjectURL, không có URL công khai hoặc token trong URL.
