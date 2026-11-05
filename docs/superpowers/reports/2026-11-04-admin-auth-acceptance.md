# Admin Auth — biên bản kiểm chứng 04/11/2026

**Auth/RBAC đã phát hành production và diễn tập rollback/phát hành lại thành công ngày 05/11/2026. Acceptance toàn bộ còn thiếu IP khách thực do cấu hình proxy hosting.** Source được review: `04b415d..9c13d9215ea02241c6b1bf449c9b04ffa0531d5e`, các sửa review ở `e5fa407`. Không đánh dấu phần IP hoàn tất chỉ vì probe auth qua.

## Hosting thực tế 05/11/2026

- CI main [41852205705](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41852205705) success, SHA `e7257b4962d1afd7689234c70cb65fb176e828d3`; artifact `13336527044`, digest ZIP `sha256:bae45d1e4e8d1e158b3caa547337084a262464a401b9045803ffc3719abb44af`.
- Đã tạo hai DB/user đúng phạm vi được owner duyệt; kết nối MariaDB thực tế thành công. Runtime chỉ DML trên DB ứng dụng; maintenance chỉ DML+CREATE/ALTER/INDEX/REFERENCES trên ứng dụng và thêm DROP trên verifier. Hai DB ban đầu rỗng, đã đổi default sang utf8mb4_unicode_ci; UTC session hoạt động. Không đọc DB WordPress.
- Private runtime/maintenance env ở ngoài webroot, owner-only0600. Pool runtime3 + collector2; maintenance1. Host max_connections500; max_user_connections0; tài khoản hosting có giới hạn100 processes/40 entry processes và2GB RAM. Forwarded headers chưa được trust.
- Trusted tools và Passenger đã bootstrap đúng9 hash từ commit `e5fa407`; source tgz SHA-256 `1596ecf42e228f0447b8213096d57c9bba15cec85564b8f43a78862b990cd218`. Lần đầu check bị nested flock, đã tự phục hồi tools/app/config cũ; retry dùng internal `--locked` dưới outer flock đạt. Không mở rộng SSH grammar.
- [Deploy41964870276](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41964870276) success: release `e7257b4962d1afd7689234c70cb65fb176e828d3-41852205705`; previous `9eb48b8c4b51bec51bb9a20088e2179b04cbe2e1-41663925930`. Native backup/isolated restore-check, migrate/seed/status và probe auth/RBAC/analytics đã qua; runner kiểm tra FE/BE, ảnh sản phẩm và client cũ qua.
- Backup đầu1069 byte, verified true; SHA-256 `f0903d651035419b47cfde5afd53d6911fb01f362cd6d1aacf22dc74061567bf`.
- UI Edge thực tế: user01 đăng nhập chỉ thấy Khách truy cập; đăng xuất thành công; admin đăng nhập có đầy đủ menu; Master detail readonly; editor TinyMCE tự host tải toolbar/iframe. Ảnh thật `bibi-auth-production-user.jpg`, `bibi-auth-production-master.jpg`, `bibi-auth-production-editor.jpg` tại visualization workspace.
- [Rollback41965536213](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41965536213) success, đúng release pre-auth được duyệt; receipt `degradedAdmin:true`. [Phát hành lại41965738915](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41965738915) success, dùng lại chính artifact CI, không build lại. Current cuối cùng là `e7257b4962d1afd7689234c70cb65fb176e828d3-41852205705`.
- Evidence riêng0600 chỉ gồm trường không bí mật của3 users,2 revoked sessions và8 audit rows; tất cả phát sinh sau snapshot DB rỗng ban đầu. Đã đối chiếu từng bản ghi sau rollback và sau phát hành lại: nguyên vẹn cả3/2/8; audit cuối tăng12. Không down-migrate hoặc restore snapshot đè production. Ảnh `bibi-auth-production-rollback-data.jpg` và `bibi-auth-production-republished-data.jpg`.
- Backup lần phát hành lại verified,23309 byte, schemaVersion4. DB verifier đã trở về0 bảng. Probe cuối chạy lại sau maintenance vẫn auth/RBAC/analytics=true; seed idempotent qua sau khi xóa MASTER_ADMIN_PASSWORD/SEED_USER_PASSWORD khỏi maintenance.env. Không đổi mật khẩu đã hash hoặc secret ký hiện hành.
- Cron cài hai CLI cleanup mỗi10 phút, lệch nhau1 phút, lock chống chạy chồng; batch100. Đã quan sát cron thực sự chạy, log riêng0600 chỉ count; auth0session/0token và analytics0session/0visitor/0page/0product. Cron cũ được giữ nguyên và có backup riêng0600. App pre-auth không có CLI thì lịch tự bỏ qua.
- Reload UI sau rollback/phát hành lại khôi phục session Admin và TinyMCE qua refresh cookie; không phải fixture login.

### IP khách thực: chưa đạt

Đo request riêng trên mount `/api`: socket loopback; request bình thường không có X-Forwarded-For/X-Real-IP và không có secure `!~Passenger-Client-Address`. Header X-Forwarded-For giả từ client vẫn tới app. Đã thử hai cấu hình RequestHeader dùng REMOTE_ADDR (expression và rewrite environment) trong API .htaccess: hosting không ghi đè X-Forwarded-For; cả hai thử nghiệm đã phục hồi nguyên bản ngay. Hook quan sát tạm cũng đã gỡ, bootstrap và routing được đối chiếu byte; không ghi raw IP/UA.

Do đó giữ TRUSTED_PROXY_CIDRS rỗng. Request spoof không làm thay đổi IP được collector dùng, nhưng IP đang chỉ phản ánh loopback; network rate limit cũng dùng chung prefix đó. Không mở trust loopback khi chưa có nguồn IP được webserver ghi đè chắc chắn. Vị trí vẫn null như thiết kế.

Việc còn lại ở quyền quản trị hosting: tại LiteSpeed/Passenger, xóa header IP do client gửi và chèn địa chỉ client từ kết nối thực, hoặc cung cấp secure Passenger client-address; kiểm chứng từ client bên ngoài với header giả trước khi cấu hình CIDR tin cậy của app. Tham chiếu [Passenger secure headers](https://www.phusionpassenger.com/docs/advanced_guides/in_depth/node/secure_http_headers.html), [Apache RequestHeader](https://httpd.apache.org/docs/2.4/mod/mod_headers.html), [LiteSpeed visitor IP](https://docs.litespeedtech.com/lsws/visitorip/). Không coi chỉ sửa .env là đã khắc phục.

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
- GitHub CI nhánh `codex/admin-dashboard` tại `b247198bc024af7499ba24f6ba88e239c5418ae5` đã success: [run41851055577](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41851055577). Nhánh feature không upload artifact production; cần CI main riêng.
- Bổ sung regression cho DB ứng dụng hoàn toàn rỗng trước lần migrate đầu: native dump/restore-check qua, cả source/verifier vẫn rỗng. Bộ backup4/4 qua; không sửa runtime sau lần fullcheck ở trên.
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

## Cấu hình hosting đã áp dụng 05/11/2026

Phạm vi chỉ `/home/vhplasti/bibi-deploy/production`, website `bibistudio.vn`; không thay DB/user/app khác.

| Tài nguyên | Thực tế |
| --- | --- |
| DB ứng dụng | `vhplasti_bibi_prod`, utf8mb4/InnoDB |
| DB restore-check | `vhplasti_bibi_verify`, riêng và rỗng; chỉ chứa snapshot trong lúc kiểm thử |
| Runtime DB user | `vhplasti_bibiapp`: SELECT, INSERT, UPDATE, DELETE chỉ trên DB ứng dụng |
| Maintenance DB user | `vhplasti_bibimig`: DML + CREATE/ALTER/INDEX/REFERENCES trên DB ứng dụng; thêm DROP chỉ trên DB verifier; không GRANT/SUPER/FILE/global privileges |
| Runtime config | `production/private/runtime.env`, owner-only0600, ngoài webroot/releases |
| Maintenance config | `production/private/maintenance.env`, owner-only0600; không đưa vào GitHub/frontend/artifact |
| Backup | `production/backups`,0700, SQL/receipt0600; không auto data-restore khi rollback app |
| Runtime pools | Chính3 + collector2/mỗi process; maintenance1 |
| Proxy | Đã đo: socket loopback, forwarded IP không được sanitize; giữ trust=false |

Tên DB/user phải đối chiếu giới hạn và trạng thái cPanel tại thời điểm tạo. Mật khẩu tạo qua bước owner nhập riêng; không chép password vào source, lệnh argv, biên bản hoặc chat. Environment cần cấu hình xem `docs/admin-auth-operations.md`; seed Admin/user01 chỉ lấy bootstrap env khi identity chưa có. `bibi_release_probe` không có role/quyền, mật khẩu riêng.

Trusted host tools phải bootstrap đúng source/checksum: `database-metadata.cjs`, `database-lifecycle.cjs`, `deploy.cjs`, `receiver.cjs`, `release.cjs` và stable `app/app.cjs`. Giữ receiver grammar check/upload/deploy/rollback. Giữ npm thực `/opt/alt/alt-nodejs24/root/usr/bin/npm`. Bản pre-auth được phép rollback phải là đúng release ID đã xác minh; receipt báo admin không có auth service. Không tự coi rollback pre-auth là auth vẫn hoạt động.

## Trạng thái acceptance cuối

1. Đạt: fullcheck/build/budget, review và sửa5 findings có regression.
2. Đạt: DB/grants/config được owner duyệt, charset/timezone/quota, native backup/restore-check thật. Chưa đạt: IP khách thực qua proxy.
3. Đạt: main CI artifact đúng SHA, trusted tools, protected workflow production.
4. Đạt: probe DB/auth/RBAC/analytics, FE/BE, ảnh, TinyMCE, client cũ và UI login thật.
5. Đạt: rollback rồi phát hành lại, dữ liệu sau backup/revocation/audit giữ nguyên; không restore DB production.

Các module catalogue/content/media/kinh doanh vẫn lưu local của trình duyệt; đợt này không triển khai CRUD backend cho các module đó. Vị trí khách chưa xác định giữ null, IP bị che, không lưu raw click timeline. Không báo các giới hạn này thành chức năng backend đã hoàn tất.
