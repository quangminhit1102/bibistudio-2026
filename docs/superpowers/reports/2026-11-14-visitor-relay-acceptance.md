# Visitor IP relay — kiểm chứng local/CI, chờ production

Ngày 14/11/2026. **Chưa deploy relay lên production.** Source đã push `main` và `codex/admin-dashboard`: `032ec991fe11673b8a00298c0276fbcad59fa83b`. [CI main 43563390060](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43563390060) đã Success, event push/main và đúng source SHA. Không lấy kết quả local/CI làm bằng chứng IP thật đã hoạt động trên hosting.

## Artifact sẵn sàng

- Release ID: `032ec991fe11673b8a00298c0276fbcad59fa83b-43563390060`.
- GitHub artifact ID: `14101850882`; tên `release-032ec991fe11673b8a00298c0276fbcad59fa83b-43563390060`; chưa hết hạn, lưu đến14/12/2026.
- Kích thước artifact GitHub ZIP:199028239byte (~189.8MiB), dưới ngân sách archive256MiB được builder kiểm tra.
- Digest của **artifact ZIP**, không phải checksum `.tgz`: `sha256:442fee41a88b8bc3fb27a07d526ed609c2857780673e3103db686017239cb9dd`.
- Gói cập nhật22file ops từ đúng Git object (không lấy working tree): `.superpowers/sdd/2026-11-13-visitor-ip-relay/relay-host-tools-032ec99.zip`,31565byte; SHA256 `9f6687a40fe5d1b5dfea6c8139365d10ce8cc3bce3477b52d6ddf3b99ea851b8`. Manifest bên trong ghi hash từng file. Chưa upload/cài lên hosting.

## Kết quả đã đo

| Kiểm tra trên final CI Linux | Kết quả |
| --- | --- |
| TypeScript FE/BE, lint, ảnh catalogue | Đạt; lint0error,10warning hiện có |
| Frontend Vitest |108file,301test đạt |
| Backend/tooling/PHP/MySQL |323test đạt,0skip |
| Watcher phục hồi lỗi và dev FE/BE/PHP |2test đạt |
| Browser auth, analytics, usability, profile, relay |5luồng đạt |
| Build manifest6 và compiled bundle browser/PHP/MySQL |Đạt trên chính release ID phía trên |

Compiled acceptance kiểm tra cookie202→204/HttpOnly/path, readiness, API dữ liệu từ chối thiếu token, User chỉ thấy menu được phép, không đưa khóa runtime/MMDB vào frontend, screenshot desktop/mobile và không tràn ngang. Browser evidence ở artifact `browser-evidence-032ec991fe11673b8a00298c0276fbcad59fa83b-43563390060` (ID14101835881, lưu7ngày). IP công khai trong fixture là dữ liệu thử nghiệm riêng, không phải bằng chứng nguồn IP hosting.

Local trước final CI cũng đã chạy toàn bộ check, build và compiled preview thật. Bản local exact `16ac152` có buildExit0/previewExit0; thay đổi sau đó chỉ ở loader ops/cache và fixture, được final CI `032ec991fe11673b8a00298c0276fbcad59fa83b` kiểm chứng lại đầy đủ. Lệnh hằng ngày vẫn `npm run dev`, `npm run check`, `npm run build`; setup một lần `npm run db:setup:local` khi nâng feature schema.

## Review và lỗi đã tái hiện rồi sửa

Một review toàn bộ thay đổi bằng fresh context (gpt-6-astra), không có Critical. Đã xử lý trong một fix pass:

- Cùng IP đã có quốc gia: không tra lại/xóa snapshot khi lookup lỗi; giữ thời điểm resolve. Đổi IP mà lookup miss vẫn xóa quốc gia cũ; chưa resolve thì được thử lại. Unit RED→GREEN, MySQL và browser thật.
- Kiểm tra khóa riêng phải so với `RELEASE_PROBE_SECRET`, không chỉ password probe. Config regression RED→GREEN.
- Stable Passenger chuyển `schemaVersion` vào app; test DB từng trảready200 khi thiếu context của manifest6, sau sửa trả503đúng. Startup/auth cũ vẫn đạt.
- CI đầu phát hiện PHP opcode cache giữ router fixture cũ. Đã đo cache bật/revalidate2giây; fixture hiện đọc IP từ JSON riêng, source PHP bất biến, không tắt cache hay thêm override production.
- Đổi symlink `current` từ Node ngoài PHP worker có thể bị realpath cache giữ release cũ. Persistent PHP test từng trả405sai khi đã rollback vềv5; loader `clearstatcache(true)` rồi đạt405→404→405 trên cùng worker.

Pinned backend productionv5 `ee12307cf68f45484d59c3b77c2f6f7f83a07f47` đã chạy thật sau DDL context trong DB local riêng: auth/profile/readiness vẫn đạt, IP/country/history còn nguyên; forward phục hồi ý nghĩa observed. Native MariaDB backup đã restore và xác minh ledger, snapshot, receipt còn hạn trong verifier riêng, không restore đè DB nguồn. **Chưa diễn tập rollback v6 trên production.**

## Trạng thái production và phần còn chờ

Baseline HTTP/SSH đã đo: production vẫn `ee12307cf68f45484d59c3b77c2f6f7f83a07f47-43382604855`; `/api/ready`200, profile thiếu token401, ảnh catalogue200. Receiver check qua SSH key hiện có trảok, Nodev24.22.3. Không thay đổi current, DB, cron, receiver hay private key/config production trong đợt relay này.

Công cụ hiện báo không truy cập được browser của chat, nên chưa thể thao tác cPanel. Cần khôi phục kết nối Edge/cPanel để:

1. Đo quota, PHP SAPI/version, routing/nguồn từ hai phía và hai hostname; giữ kết quả IPv6 chưa đo là pending nếu mạng không có.
2. Backup rồi cài đúng ops và stable `production/app/app.cjs`; tạo khóa HMAC riêng/private config0600, giữ `CLIENT_IP_SOURCE_VERIFIED=false`. Chi tiết [vận hành](../../visitor-analytics-operations.md).
3. Kiểm tra native paired backup/verifier, chạy workflow production thủ công với đúng artifact, xác minh PHP thực và IP/quốc gia mới trong UI; kiểm tra auth/profile/ảnh/tab cũ.
4. Rollback vềv5 rồi forward cùng artifact khi được phép; không down migration, không restore đè DB live, không bật importer/TTLcron đã retired.

Chỉ ghi nhận IP là **observed/chưa xác minh**. Quốc gia là ước lượng offline DB-IP Country Lite11/2026, CC-BY-4.0; không phải GPS. Không gửi IP đến API định vị bên ngoài. Không cron enrichment; batch15giây và phiên30phút giữ nguyên; lịch sử thật không TTL. Bản cũ đã che IP không thể khôi phục IP đầy đủ bằng migration này.

Environment mới: `ANALYTICS_RELAY_SECRET`, `GEOIP_COUNTRY_FILE`; PHP private JSON có environment/secret/targetUrl/origins. Không có key trong source/frontend/report. Hostnames/origins, key separation và quyền đọc dữ liệu vẫn phải qua kiểm tra backend.

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
