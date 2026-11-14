# Visitor IP relay — production và rollback đã kiểm chứng

Ngày 14/11/2026. Production đang chạy release `032ec991fe11673b8a00298c0276fbcad59fa83b-43563390060`, source `032ec991fe11673b8a00298c0276fbcad59fa83b`. Đã kiểm tra trực tiếp sau deploy, rollback về v5 rồi khôi phục cùng artifact v6. IP được ghi là **observed / Chưa xác minh**; quốc gia là **Ước lượng**. `CLIENT_IP_SOURCE_VERIFIED=false` được giữ nguyên.

## Source, artifact và workflow

| Bước                                                                                                  | Kết quả                                                                                |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Main CI 43563390060](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43563390060)    | Success, push/main, đúng source; check/build/compiled browser acceptance               |
| [Production 43566445860](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43566445860) | Success; FE/BE, browser ảnh, API test, tab cũ tải 2 assets không cache                 |
| [Rollback 43567948441](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43567948441)   | Success về `ee12307cf68f45484d59c3b77c2f6f7f83a07f47-43382604855`; degradedAdmin=false |
| [Khôi phục 43568216450](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43568216450)  | Success; promote lại đúng artifact v6, không build lại                                 |

Artifact ID `14101850882`, ZIP 199028239 byte, ZIP digest `sha256:442fee41a88b8bc3fb27a07d526ed609c2857780673e3103db686017239cb9dd`; không nhầm ZIP digest với checksum tgz. Ops và stable Passenger đã bootstrap từ source này, đối chiếu SHA256 từng file. Bản sao công cụ/config trước bootstrap nằm ngoài webroot. Khóa relay tạo riêng sau xác nhận của chủ website; không in khóa, không đổi quyền SSH/RBAC.

## Kết quả chạy thật

- Windows/external: cả `bibistudio.vn` và `www.bibistudio.vn` trả cookie bootstrap202 rồi batch hợp lệ204; Secure/HttpOnly/SameSite=Lax và Path=/api/analytics. Hai khách thử nghiệm mới có IP observed, source php_relay và quốc gia VN ngay sau batch, không đợi log/cron.
- Nguồn hosting độc lập: hai hostname cũng202→204. IP PHP lưu trong DB khớp địa chỉ nguồn do curl lấy từ hệ điều hành trên chính kết nối HTTPS, không dùng header do client khai. Chỉ đối chiếu trong bộ nhớ; không đưa raw IP vào report.
- Mỗi hostname chặn10 loại header forwarding/envelope giả mạo, body quá16KiB trả413 và origin sai trả403. HMAC backend thật: hợp lệ204, phát lại cùng request409; sửa body/cookie/origin/User-Agent/privacy/signature hoặc thời gian quá hạn/tương lai đều403. Kết quả xác minh lại với JSON error code của ứng dụng, không tính một403 của lớp ngoài là pass.
- Collector Node không ký vẫn ghi số liệu với IP chưa xác định, không lấy8.8.8.8 từ XFF. Envelope giả bị từ chối. DNT và GPC trả204, không cấp cookie theo dõi mới.
- Login/refresh/profile/logout, readiness200 và analytics thiếu token401 đạt trước và sau rollback. Sản phẩm deep link, ảnh, FE/BE version và old-client assets đạt.
- Khi chạy v5, cookie đã có vẫn gửi batch204 và đọc được lịch sử. Sau forward v6, cùng 2 khách còn nguyên IP/source/thời điểm/quốc gia/dataset/số phiên/số trang. Hash snapshot trước/sau cùng `523f8c04ca0bd7f9c5e309735c5a4747967e3824ad94cedee7bd1bb91c5408af`. Không down migration hoặc restore đè DB live.
- UI production đăng nhập bằng HTTP thật: chi tiết khách hiển thị Chưa xác minh, Việt Nam và Ước lượng; desktop/mobile390px không tràn ngang, ảnh sản phẩm decode được. Screenshot riêng đã che IP; không commit dữ liệu khách hoặc screenshot quản trị vào repo.

## Hosting, backup và cấu hình

PHP8.3.36, Node24; MMDB 8515063 byte, DB-IP Country Lite11/2026. Context ledgerversion1 complete/checksum đúng; auth4/profile1/history1 được giữ. Paired backup native trước activation gồm DB 3861614 byte và 2 avatar, manifest/SQL checksum khớp; activation chỉ chạy sau verifier restore thành công. Lần forward tiếp tục dùng cùng gate paired restore.

Private runtime.env, maintenance.env và analytics-relay.json ở0600, ngoài webroot; relay secret tách identity/JWT/probe. Hash cấu hình được đối chiếu sau rollback/forward. Giữ nguyên /api/.htaccess, /node-test và các website khác. Importer cPanel và analytics:cleanup đã retired vẫn không có trong crontab; lịch sử thật không TTL. Disk/quota được kiểm tra bởi receiver, không tăng giới hạn hoặc dọn dữ liệu để phát hành.

## Phạm vi bằng chứng và điểm còn giới hạn

Đây là IP do PHP quan sát sau bộ chặn ingress, chưa chứng minh toàn bộ topology proxy/CDN của Tino; không bật trust header và không ghi nhãn verified. Quốc gia là ước lượng offline, không phải GPS; không gọi API định vị bên ngoài. Hai nguồn live đã đo là máy Windows bên ngoài và hosting, chưa có mạng ngoài thứ hai hoặc IPv6 live. Lookup-miss/private/IPv6 dataset và lỗi timeout/upstream được kiểm thử local/CI; không gây hỏng upstream production để diễn tập timeout. Các giới hạn này không được tính là kết quả live đã đo.

CI cuối:301test frontend,323Node/PHP/MySQL (0skip),2dev và5browser, cùng build/compiled acceptance đạt. Một fresh review toàn thay đổi không có Critical; đã sửa country snapshot/probe-secret guard/Passenger readiness/PHP realpath cache bằng hồi quy RED→GREEN rồi CI cuối xanh. Chi tiết quyết định triển khai nằm trong ledger của kế hoạch. Không có thay đổi product code sau CI này.

Trong lần tiếp tục, helper kiểm chứng cũ kỳ vọng204 cho request mang header giả; source PHP quy định403. Đã tách request giả403 và request hợp lệ204, không sửa product để nới guard. Query thử nghiệm hosting ban đầu nhầm identity_hash với visitor UUID; sửa JOIN theo schema rồi đạt. Hai lỗi helper này không được tính là lỗi runtime hay pass giả.

Bằng chứng riêng: checkout gốc `.superpowers/recovered-relay/` chứa summary JSON, workflow logs và screenshot đã che IP; hosting `private/relay-live-audit.json` chứa summary không có khóa/rawIP. Cookie và snapshot dùng so sánh chỉ ở file private bị Git bỏ qua. Lệnh hằng ngày vẫn npm run dev / check / build; xem [vận hành](../../visitor-analytics-operations.md) và [phát hành](../../build-and-deploy.md).

## Danh sách file implementation

Diff `ee12307cf68f45484d59c3b77c2f6f7f83a07f47..032ec991fe11673b8a00298c0276fbcad59fa83b` gồm 89file; report này là tài liệu bổ sung.

<details>
<summary>Toàn bộ file</summary>

- `.env.example`
- `.github/workflows/ci.yml`
- `.gitignore`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/relay/collect.php`
- `backend/relay/context.php`
- `backend/src/app.ts`
- `backend/src/http/contracts.ts`
- `backend/src/http/security.ts`
- `backend/src/release.ts`
- `backend/src/runtime.ts`
- `backend/src/visitors/collector.ts`
- `backend/src/visitors/context-cli.ts`
- `backend/src/visitors/context-dto.ts`
- `backend/src/visitors/context-schema.ts`
- `backend/src/visitors/context-write.ts`
- `backend/src/visitors/country-lookup.ts`
- `backend/src/visitors/relay-context.ts`
- `backend/src/visitors/report-query.ts`
- `backend/src/visitors/routes.ts`
- `backend/src/visitors/service.ts`
- `backend/src/visitors/session-history.ts`
- `backend/test/country-lookup.test.mjs`
- `backend/test/helpers/legacy-context-backend.mjs`
- `backend/test/passenger-runtime.test.mjs`
- `backend/test/relay-context.test.mjs`
- `backend/test/visitor-context-collector.test.mjs`
- `backend/test/visitor-context-runtime.test.mjs`
- `backend/test/visitor-context-schema.test.mjs`
- `backend/test/visitor-context-write.test.mjs`
- `backend/test/visitor-relay-http.test.mjs`
- `backend/visitor-context-migrations/001_context.sql`
- `docs/build-and-deploy.md`
- `docs/superpowers/plans/2026-11-13-visitor-ip-relay.md`
- `docs/superpowers/reports/2026-11-13-visitor-analytics-acceptance.md`
- `docs/superpowers/reports/2026-11-13-visitor-analytics-production-release.md`
- `docs/superpowers/reports/2026-11-13-visitor-relay-routing-spike.md`
- `docs/superpowers/specs/2026-11-13-visitor-ip-relay-design.md`
- `docs/visitor-analytics-operations.md`
- `ops/database-lifecycle.cjs`
- `ops/deploy.cjs`
- `ops/passenger/app.cjs`
- `ops/php/loader.php`
- `ops/php/relay.htaccess`
- `ops/receiver.cjs`
- `ops/release.cjs`
- `ops/visitor-context-lifecycle.cjs`
- `ops/visitor-context-metadata.cjs`
- `ops/visitor-context-routing.cjs`
- `scripts/build.mjs`
- `scripts/check.mjs`
- `scripts/deploy-client.mjs`
- `scripts/dev-relay.test.mjs`
- `scripts/dev.mjs`
- `scripts/geoip-country.lock.json`
- `scripts/local-analytics-relay.mjs`
- `scripts/local-analytics-relay.test.mjs`
- `scripts/local-database.mjs`
- `scripts/local-database.test.mjs`
- `scripts/php-context.test.mjs`
- `scripts/php-relay-router.php`
- `scripts/php-relay.mjs`
- `scripts/php-relay.test.mjs`
- `scripts/php-routing-spike.mjs`
- `scripts/prepare-geoip.mjs`
- `scripts/prepare-geoip.test.mjs`
- `scripts/preview.mjs`
- `scripts/relay-preview.test.mjs`
- `scripts/smoke.mjs`
- `scripts/smoke.test.mjs`
- `scripts/visitor-context-bundle-check.mjs`
- `scripts/visitor-context-release.test.mjs`
- `scripts/visitor-context-rollback.test.mjs`
- `scripts/visitor-relay-ui-check.mjs`
- `src/components/analytics-privacy-control.tsx`
- `src/features/admin/admin.css`
- `src/features/admin/analytics/components/visitor-context.tsx`
- `src/features/admin/analytics/components/visitor-session-list.tsx`
- `src/features/admin/analytics/server-visitors.tsx`
- `src/lib/visitor-runtime.ts`
- `src/lib/visitor-transport.ts`
- `tests/admin/visitor-context-display.test.tsx`
- `tests/admin/visitor-relay-transport.test.ts`
- `tests/admin/visitor-tracking.test.tsx`
- `tests/e2e/auth.spec.mjs`
- `tests/e2e/visitor-context-bundle.spec.mjs`
- `tests/e2e/visitor-relay.spec.mjs`
- `vite.local.config.ts`

</details>
