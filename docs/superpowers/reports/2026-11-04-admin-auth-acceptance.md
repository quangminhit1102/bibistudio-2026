# Admin Auth — biên bản kiểm chứng 04/11/2026

**Chưa hoàn tất acceptance production.** Không suy ra deploy thành công từ kết quả local. Source được review: `04b415d..9c13d9215ea02241c6b1bf449c9b04ffa0531d5e`. Chưa push auth feature.

## Đã đo và đã chạy

- Edge/cPanel: MariaDB `10.11.19-MariaDB-cll-lve`, Node24.22.2, native dump/client có sẵn. Chỉ quan sát DB/user hiện có; không dùng DB WordPress của website khác.
- Database test riêng: MariaDB10.11.19, image pin trong CI. Local development DB cũ MySQL8.4 giữ nguyên; setup mới tạo MariaDB. Runtime DML-only thực tế bị từ chối CREATE TABLE.
- Full check checkpoint `1c66458`: admin217/217, backend/tooling129passed +1 POSIX skip trên Windows, watcher1/1, actual browser1/1 (79 giây). Tổng check exit0. Ảnh Master desktop/User mobile được xem lại; không dùng mockup làm bằng chứng.
- Test bổ sung probe/backup/rollback:16passed +1 POSIX skip. Dùng native MariaDB dump/restore/redump thật; lỗi probe sau activation khôi phục pointer app và giữ display-name, logout/revocation/audit được ghi sau backup. Không restore đè DB nguồn.
- Full check sau commit probe `9c13d92`: exit0, admin217, backend/tooling133passed +1 POSIX skip, watcher1, actual browser1 (74.7 giây).
- Review độc lập đã phát hiện5 lỗi: Passenger truyền sai tham số runtime, password reset vượt quyền đích, form revision cũ sau đổi role, thiếu auth cleanup và pending migration bị nhận nhầm dirty. Từng lỗi đã tái hiện bằng test trước sửa; test riêng sau sửa qua (backend/tooling8, form4). Factory Passenger thật với MariaDB trả readiness200/account401. Password reset kiểm tra quyền đích trong transaction/RBAC lock, không cho account hạn chế chiếm tài khoản Admin thường.
- Full check sau sửa: lần đầu admin218/backend/tooling/watcher qua, browser dừng do selector test ảnh mới dùng text thay accessible name. Selector đã sửa, browser chạy lại qua (68.8 giây). Lần fullcheck cuối exit0: admin218, backend/tooling138passed +1 POSIX skip, watcher1 (5.1 giây), browser1 (69 giây), gồm đổi vai trò→lưu profile và chi tiết sản phẩm quan tâm. Ảnh desktop/mobile đã xem lại.
- Build source `e5fa407da9a6452f50ef9d5ed391246af757cf2a` exit0; local artifact SHA-256 `a8d4ae7f334acd50faa9415faf52c1a027dd8c64620795bb0a70aa5f63790e3c`. Public bundle budget qua: tăng8677 byte JS gzip/285 byte CSS gzip, giới hạn10240/2048; không lẫn admin vào initial graph public. Đây là artifact local, không thay artifact CI production.
- Trusted tools package từ git blob đúng commit trên có SHA-256 `1596ecf42e228f0447b8213096d57c9bba15cec85564b8f43a78862b990cd218`;9 file gồm dependencies lockfile và stable Passenger, không có env/secret.
- Ảnh thật đã xuất vào visualization workspace với tên `bibi-auth-admin.png`, `bibi-auth-user-mobile.png`, `bibi-auth-accounts.png`, `bibi-auth-visitor-interest.png`, `bibi-auth-master-protected.png`. Live acceptance còn chờ.

## Các thay đổi chính

| Phần | Nguồn |
| --- | --- |
| Schema/seed/dirty ledger/native backup/restore/probe | `backend/migrations`, `backend/src/db`, `backend/src/runtime.ts` |
| Login/refresh/revoke, JWT15 phút, cookie/hash/rotation | `backend/src/auth`, `backend/src/http`, `backend/src/config.ts` |
| Multi-role RBAC/account CRUD/immutable Master/audit | `backend/src/authorization`, `backend/src/accounts`, `backend/src/roles`, `backend/src/audit` |
| Collector giới hạn batch/dedup/retention/probe và API private | `backend/src/visitors` |
| Memory token/single-flight/Web Locks/server authority/UI | `src/lib/admin-http.ts`, `src/features/admin` |
| Public tracker/privacy và code split | `src/lib/visitor-*`, `src/components/visitor-tracking.tsx`, `src/components/analytics-privacy-control.tsx` |
| Artifact2/checksums/fixed host hooks/Passenger | `ops`, `scripts/build.mjs`, `scripts/preview.mjs`, `scripts/smoke.mjs` |
| Local DB/dev/check/CI và browser acceptance | `scripts/local-database.mjs`, `scripts/dev.mjs`, `scripts/check.mjs`, `.github/workflows/ci.yml`, `backend/test`, `tests/admin`, `tests/e2e/auth.spec.mjs` |

## Cấu hình hosting dự kiến — chưa áp dụng

Phạm vi chỉ `/home/vhplasti/bibi-deploy/production`, website `bibistudio.vn`; không thay DB/user/app khác.

| Tài nguyên | Dự kiến |
| --- | --- |
| DB ứng dụng | `vhplasti_bibi_prod`, utf8mb4/InnoDB |
| DB restore-check | `vhplasti_bibi_verify`, riêng và rỗng; chỉ chứa snapshot trong lúc kiểm thử |
| Runtime DB user | `vhplasti_bibiapp`: SELECT, INSERT, UPDATE, DELETE chỉ trên DB ứng dụng |
| Maintenance DB user | `vhplasti_bibimig`: DML + CREATE/ALTER/INDEX/REFERENCES trên DB ứng dụng; thêm DROP chỉ trên DB verifier; không GRANT/SUPER/FILE/global privileges |
| Runtime config | `production/private/runtime.env`, owner-only0600, ngoài webroot/releases |
| Maintenance config | `production/private/maintenance.env`, owner-only0600; không đưa vào GitHub/frontend/artifact |
| Backup | `production/backups`,0700, SQL/receipt0600; không auto data-restore khi rollback app |
| Runtime pools | Chính5 + collector2/mỗi process; phải đo quota/số process trước activation |
| Proxy | Chưa trust forwarded IP; chỉ cấu hình CIDR sau khi đo |

Tên DB/user phải đối chiếu giới hạn và trạng thái cPanel tại thời điểm tạo. Mật khẩu tạo qua bước owner nhập riêng; không chép password vào source, lệnh argv, biên bản hoặc chat. Environment cần cấu hình xem `docs/admin-auth-operations.md`; seed Admin/user01 chỉ lấy bootstrap env khi identity chưa có. `bibi_release_probe` không có role/quyền, mật khẩu riêng.

Trusted host tools phải bootstrap đúng source/checksum: `database-metadata.cjs`, `database-lifecycle.cjs`, `deploy.cjs`, `receiver.cjs`, `release.cjs` và stable `app/app.cjs`. Giữ receiver grammar check/upload/deploy/rollback. Giữ npm thực `/opt/alt/alt-nodejs24/root/usr/bin/npm`. Bản pre-auth được phép rollback phải là đúng release ID đã xác minh; receipt báo admin không có auth service. Không tự coi rollback pre-auth là auth vẫn hoạt động.

## Còn phải đạt trước khi kết luận hoàn tất

1. Fullcheck/build/budget và review bảo mật không còn lỗi quan trọng.
2. Cấp quyền DB/config được owner duyệt cụ thể tại bước thực hiện; đo grants/charset/timezone/quota/proxy; native backup/restore-check thật trên hosting.
3. Push/CI artifact đúng SHA; bootstrap trusted tools; Run workflow production có gate duyệt.
4. Probe DB/auth/RBAC/analytics, FE/BE version, ảnh, TinyMCE và tab client cũ trên production.
5. Rollback app rồi phát hành lại, ghi release hiện tại/trước đó, backup hash và bằng chứng dữ liệu mới/revocation vẫn còn. Không down-migrate hoặc restore snapshot production cho diễn tập.

Các module catalogue/content/media/kinh doanh vẫn lưu local của trình duyệt; đợt này không triển khai CRUD backend cho các module đó. Vị trí khách chưa xác định giữ null, IP bị che, không lưu raw click timeline. Không báo các giới hạn này thành chức năng backend đã hoàn tất.
