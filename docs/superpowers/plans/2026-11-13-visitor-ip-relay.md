# Visitor IP Relay and Country Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ghi IP công khai và quốc gia ước lượng vào phiên analytics ngay khi batch đi qua PHP relay, không chờ log hoặc cron.

**Architecture:** PHP ingress hẹp trên cùng domain giữ anonymous cookie hiện có và ký request chuyển tới Express. Express xác nhận envelope, collector ghi snapshot theo phiên và tra MMDB offline. Receiver/current chọn cả PHP, JS và dataset cùng release, giữ rollback tương thích.

**Tech Stack:** React/TypeScript hiện có; Express/Node24; MariaDB10.11; PHP8.4 CLI chính thức cho local/CI, source tương thích PHP>=8.1 và phải lint/test bằng version hosting đo được; maxmind5.0.9 (mmdb-lib3.0.3/tiny-lru13.1.1), DB-IP Country Lite11/2026. Không thêm frontend dependency.

**Spec:** `docs/superpowers/specs/2026-11-13-visitor-ip-relay-design.md` (owner approved).

## Global Constraints

- Giữ batch15giây, cookie identity, phiên30phút và giới hạn URL/sản phẩm hiện có.
- Cookie bibi_visitor đang HttpOnly/Secure/SameSite=Lax, Path=/api/analytics. Auth cookie/access token và refresh flow không thay đổi.
- Không chỉnh hoặc tái checksum visitor-migrations/001_history.sql đã phát hành.
- Không bật trust proxy toàn app. CLIENT_IP_SOURCE_VERIFIED giữ false; không dùng relay cho auth/rate limit auth.
- Một HMAC key ngẫu nhiên riêng, không tái sử dụng auth/analytics/deploy key, ở private config0600 ngoài webroot; frontend không có key.
- Quốc gia là ước lượng, không phải vị trí GPS hay định danh con người.
- Chỉ production, không cron enrichment. Không restore đè DB live hoặc down migration.
- Local vẫn npm run dev/check/build; không thêm lệnh PHP người dùng phải tự chạy. Giữ lịch sử thật không TTL, importer/TTLcron cũ không được bật lại.

## Review Focus

1. Child PHP override không hoạt động hoặc trả PHP source: Task1 phải chặn implementation rộng; Task7/8 đo lại đường thật.
2. Cookie path, duplicate cookies hoặc Set-Cookie bị đổi khi relay/bootstrap/retry: Task3/5/6 kiểm tra cookie thật và giữ identity.
3. Sai canonical body/UA/Origin/privacy/cookie hoặc replay giữa nhiều Node worker: Task3/4 kiểm tra cross-runtime và DB atomic receipt.
4. New frontend gặp old backend sau rollback, PHP upstream timeout hoặc dataset lỗi: Task5/7/8 fallback hữu hạn, unknown đúng nghĩa, không mất privacy/không forge IP.
5. IP/country update cũ trả muộn, IPv4-mapped/IPv6/no-record và tab cũ đồng thời: Task2/4/6 lưu snapshot đúng IP/thời điểm, không downgrade verified.

## File structure and shared decisions

- `backend/relay/collect.php`: ingress+HTTP forwarding; `backend/relay/context.php`: pure validation/canonical/HMAC helpers. Không DB/credential auth ở PHP.
- `backend/src/visitors/relay-context.ts`: xác nhận signed context; `country-lookup.ts`: MMDB/cache; `context-schema.ts`, `context-cli.ts`: feature migration riêng.
- `backend/visitor-context-migrations/001_context.sql`: additive session fields và receipt table/ledger. Auth4/visitor-history1 không sửa.
- `scripts/prepare-geoip.mjs`, `geoip-country.lock.json`: dataset asset ghim version/hash/license; `scripts/php-relay.mjs`: owned Docker lifecycle dùng chung dev/test/preview.
- `ops/visitor-context-metadata.cjs`, `visitor-context-lifecycle.cjs`, `ops/php/loader.php`, `ops/php/relay.htaccess`: manifest6 và loader hẹp.
- Sửa collector/routes/runtime/contracts và analytics UI; không sửa business/content modules.

Plan chọn feature `visitorContext` version1, ledger `visitor_context_schema_migrations`; manifest6 thêm metadata `{requiredMin:1,compatibleMax:1,migrationChecksums,relaySha256,geoip:{version,sha256}}`. Giữ manifest1–5 đọc được. SQL mới thêm nullable `ip_source`, `ip_observed_at`, `country_code`, `country_name`, `country_dataset`, `country_resolved_at` trên visitor_sessions và bảng `analytics_relay_receipts(request_id BINARY(16) PRIMARY KEY,expires_at DATETIME(3),INDEX(expires_at))`. Receipt chỉ state chống replay, xóa bounded100receipt hết hạn khi xử lý batch, không phải lịch sử click.

Env mới: `ANALYTICS_RELAY_SECRET`43ký tự base64url của32byte random; `ANALYTICS_RELAY_TARGET`URL cố định HTTPS /api/analytics/collect ở production (HTTP loopback/host.docker.internal chỉ local); `GEOIP_COUNTRY_FILE`đường MMDB private/candidate. Runtime đọc private env hiện có, PHP loader đọc config riêng0600 chỉ gồm secret/target/origin allowlist và current root. Không đưa secret vào Docker CLI args/logs; mount file0600 readonly.

## Task1: Prove narrow PHP routing and cookie preservation on hosting

**Files:** create `scripts/php-routing-spike.mjs`; report `docs/superpowers/reports/2026-11-13-visitor-relay-routing-spike.md`; ignored artifacts under this plan workspace.
**Interfaces:** produces measured routing decision for `/api/analytics/relay/collect.php`; no app implementation until result passes. Spike is throwaway, not production code.

- [ ] Step1: Capture /api version/readiness and existing routing hashes; define exact temporary paths under isolated node-test child, independent expiring bearer/HMAC, cleanup list, two-source request matrix. Never output raw keys/cookies/IP.
- [ ] Step2: Through cPanel create isolated child `PassengerEnabled off` and PHP probe under node-test, leaving parent config intact. Set/read a synthetic HttpOnly cookie at the corresponding analytics path; reject guessed URL overrides and forwarding headers. Probe returns signed tags only, expires30minutes.
- [ ] Step3: Check actual PHP execution/no source, anonymous cookie path, 16KiB body, normal/forged header from hosting and one external source, ordinary /api unaffected. Do not call reset/error-before-app a pass; record sources not reachable. Inspect feasibility of same child at /api without enabling real collector yet.
- [ ] Step4: Remove exact probe/key/files, verify endpoint unavailable and original hashes/ready/version unchanged. Expected: measured PASS sufficient to preserve /api/analytics cookie; otherwise STOP and bring routing alternatives back to owner. No speculative fallback broadens cookie to /.
- [ ] Step5: Commit evidence report and reusable local spike driver only; no probe secret or public debug endpoint in release.

## Task2: Pin offline country dataset and implement bounded lookup

**Files:** create `scripts/prepare-geoip.mjs`, `scripts/geoip-country.lock.json`, `scripts/prepare-geoip.test.mjs`, `backend/src/visitors/country-lookup.ts`, `backend/test/country-lookup.test.mjs`; modify backend package/lock and build asset preparation.
**Interfaces:** `openCountryLookup({file,sha256,version}): Promise<CountryLookup>`; `CountryLookup.lookup(ip:string): {code:string,name:string,dataset:string}|null`, `close():void`. Cache at most1024entries, key IP+dataset version; cache misses too.

- [ ] Step1: Write tests for missing/corrupt/wrong-hash MMDB rejection, found IPv4/mapped IPv4/IPv6, public no-record and private/reserved rejection; cache bound1024 and dataset replacement invalidation. Assertions use actual pinned MMDB for positive coverage and controlled fake reader for no-record.
- [ ] Step2: Run `node --test scripts/prepare-geoip.test.mjs backend/test/country-lookup.test.mjs`; expected RED missing module/behavior, not an unrelated fixture error.
- [ ] Step3: Install exact maxmind5.0.9 in backend. Download official `https://download.db-ip.com/free/dbip-country-lite-2026-11.mmdb.gz` once, check vendor SHA1 `09eea8433fe3eed71984fd6aac9d8ab3d9ca51f0` against the advertised download. If vendor digest applies decompressed data rather than transport, verify that explicitly and record which; never bypass mismatch. Measure SHA256 of both compressed/MMDB files into lock, record attribution URL and version. Subsequent builds require these hashes; no moving latest URL.
- [ ] Step4: Implement downloader with size/time caps32MiB compressed/64MiB expanded, no request-time network. Store generated MMDB in ignored backend/geoip and package later. Pure reader loaded once; lookup errors return null, startup integrity failure blocks candidate.
- [ ] Step5: Run targeted tests after backend compilation, expected GREEN; verify metadata IPv6 and real positive fixtures. Commit source/lock/package lock, not downloaded binary to Git.

## Task3: Implement PHP ↔ Node signed collector envelope

**Files:** create PHP files above, `backend/src/visitors/relay-context.ts`, `backend/test/relay-context.test.mjs`, `scripts/php-context.test.mjs`, `scripts/php-relay.mjs`, `scripts/php-relay.test.mjs`.
**Interfaces:** `RelayFields={version:1,timestamp:number,requestId:string,method:'POST',path:'/api/analytics/collect',bodySha256:string,ip:string,origin:string,cookieSha256:string,userAgent:string,dnt:boolean,gpc:boolean}`; `verifyRelayContext({context,signature,rawBody,cookie,origin,userAgent,dnt,gpc,now,secret}): RelayObservation` where observation `{ip,observedAt,requestId,source:'php_relay'}` or ApiError. Missing envelope is handled by routes as legacy, not by verifier.

- [ ] Step1: Write cross-runtime vectors and failures for body byte changes, cookie/Origin/UA/privacy substitution, duplicate headers, invalid/public-vs-private IP, timestamp older30seconds/future>5seconds, invalid signature, request ID not32lowercase hex. Canonical ASCII lines: `bibi-analytics-v1`, epochSeconds, requestId, POST, fixed path, raw-body SHA256, canonicalIP, base64url(origin), cookie SHA256, base64url(UA), DNT0/1,GPC0/1, trailing newline. HMAC-SHA256 hex; context header base64url of canonical bytes, signature separate. Reject noncanonical encodings/extra lines.
- [ ] Step2: Run PHP and Node vector tests using official `php:8.4-cli@sha256:d63e8b80cd4c6cfd01cfa7c910522e299cdc7ca1a2b6d6563db48df3c17e6c55` Linux image; expect RED before implementation. Docker helper starts owned loopback-port PHP server, mounts source/private config readonly, stops only owned container. No general command from HTTP.
- [ ] Step3: Implement same-origin POST/JSON16KiB ingress. Header forwarding denylist includes XFF/X-Real-IP/Forwarded/Client-IP/CF-Connecting-IP/True-Client-IP/X-Cluster-Client-IP and underscore variants; reject case-insensitive before REMOTE_ADDR use. Set input UA limit512bytes, origin fixed allowlist. Canonical cookie là đúng một giá trị bibi_visitor đã parse (bootstrap dùng chuỗi rỗng); duplicate anonymous cookies khác giá trị phải reject thay vì chọn ngẫu nhiên. Hash value này, không hash cả Cookie header hoặc auth cookie. Forward only anonymous bibi_visitor cookie, required analytics headers and signed envelope to fixed target; timeout5seconds, response max64KiB, no redirects, no Authorization/auth cookies. Set-Cookie allowlist only bibi_visitor with original flags/path; propagate204/202/error semantics, no-store.
- [ ] Step4: Implement verifier constant-time signature, recompute body/cookie/other fields against actual forwarded request, canonical public address. PHP source never becomes Express trust proxy. Raw IP is not returned to frontend by relay.
- [ ] Step5: Run vectors plus actual PHP→HTTP fake upstream tests for cookie/timeout/body/error/privacy, expected GREEN; commit. Local source needs ability to use a private test-only fixed HTTP upstream, production HTTPS only.

## Task4: Add context schema, atomic receipts and collector metadata

**Files:** create migration/schema/CLI above and `backend/test/visitor-context-schema.test.mjs`, `visitor-context-collector.test.mjs`; modify `backend/src/visitors/{collector,routes,service,session-history,report-query}.ts`, `backend/src/{runtime,app}.ts`, `backend/src/http/{security,contracts}.ts`.
**Interfaces:** `visitorContextSchemaStatus(pool,directory)`, `migrateVisitorContext(pool,directory)` mirror feature ledger conventions; CLI migrate/status. `CollectorContext` adds optional `relayObservation`, `countryLookup`; shared `VisitorIpStatus` adds `observed`; visitor/session DTO optional source/countryCode/countryDataset/observedAt fields for incremental compatibility.

- [ ] Step1: Write real DB tests for additive schema resumable DDL/checksum drift/read-only status; unchanged visitor001/auth4 fingerprints; paired schema objects. Collector tests pin observed IP+country same transaction, first/next session, legacy unsigned batch unknown, verified not downgraded, older observations not overwriting newer, IP change clears old country if miss, DNT/GPC zero association writes.
- [ ] Step2: Write replay test with two simultaneous transactions using same requestId: at most one accepted batch/receipt; duplicate returns409 without new rows/counters. Receipt expires60seconds after observed timestamp; bounded delete100 expired receipts on accepted batches, no real history deletion. Bootstrap202 creates no visitor/session and no IP; replay bootstrap cannot create rows.
- [ ] Step3: Run backend targeted tests; observe RED. Implement raw-body capture only for analytics collector before JSON parser, without touching avatar envelope or other auth parsing. Verify headers before treating relay IP as observation. Consume receipt inside existing collector transaction for identity-bearing batches; same transaction records session changes. Keep unsigned collector compatible, signed-invalid never downgrades.
- [ ] Step4: Update projections/search to expose observed or verified public IP; legacy prefix never claimed full IP. Snapshot country/name corresponds to selected session; old visitor country remains fallback only for legacy rows. Analytics network throttle may use validated relay IP, auth still original context. Update runtime/readiness for capability/config/dataset.
- [ ] Step5: Run targeted DB tests and FE/BE typechecks, GREEN; commit. Preserve rollback-readable old columns and do not modify retired log feature.

## Task5: Route frontend analytics through relay and show source/estimated country

**Files:** modify `src/lib/visitor-runtime.ts`, analytics server API/session list, shared contracts; create `tests/admin/visitor-relay-transport.test.ts`, `visitor-context-display.test.tsx` and backend route compatibility tests.
**Interfaces:** `sendVisitorBatch(batch,options):Promise<{status:number}>` uses PHP fixed URL, sends no client IP or secret; fallback to existing Node URL at most once for network/404/502/503/504, never for validation403/409/413/429. Existing tracker controls subsequent retry count and15second batch interval.

- [ ] Step1: Write RED tests for PHP target/credentials/keepalive/cookie bootstrap, one bounded unsigned fallback after availability error, no fallback on tamper/replay/rate/privacy responses, old tab transport still accepted, opted-out tracker never sends relay. UI observed IP shows `Chưa xác minh`, country `Ước lượng`, unknown when no match; IPv6 no truncation, signed source not labeled verified.
- [ ] Step2: Implement small transport seam, preserve tracker queues/bootstrapLock/privacy logic and avoid per-click requests. Add source/estimate copy to existing table and session popup plus DB-IP attribution link; maintain selected-date contract and existing chart layout. No log source menu.
- [ ] Step3: Run `npm run test:admin -- <new files>` and relevant tracker tests plus backend route tests, expected GREEN; check responsive rendering locally once Task6 makes real PHP available; commit.

## Task6: Preserve one-command local/preview and add real browser acceptance

**Files:** modify `scripts/{dev,preview,local-database,check}.mjs`, `vite.local.config.ts`, `.github/workflows/ci.yml` (upload relay browser evidence); create `scripts/visitor-relay-ui-check.mjs`; reuse `scripts/php-relay.mjs`; update dev/watcher/preview tests and `.env.example`.
**Interfaces:** PHP helper `startPhpRelay({port,targetUrl,configFile,sourceDirectory,signal}):Promise<{url,close}>`; Node/FE own lifecycle closes relay too. Dedicated readiness verifies configured PHP relay separately from Node /api/ready.

- [ ] Step1: Write RED tests for npm dev starting3surfaces without manual PHP command, fixed proxy routing only PHP collector, backend inspector unchanged, shutdown/port release/partial-start failure cleanup, no secret passed as command-line args or printed. Generate separate local/test relay key in ignored0600 files during explicit local setup; do not use production secrets.
- [ ] Step2: Start loopback PHP Docker helper automatically when actual app backendEntry used, support host.docker.internal on Windows and measured Linux host gateway; do not change synthetic watcher fixtures. Enable /api/analytics/relay proxy before generic /api only in dev/preview. PHP implementation runs as PHP, not JS imitation.
- [ ] Step3: Browser test FE→PHP→Express→real MySQL with eligible public test peer injected only by isolated test router, server private config and deterministic clock. Assert cookie identity survives202→204, country in UI, header forgery rejected, new session metadata/order correct, no extra visit per reload within30minutes, one unavailable lookup doesn't lose interests. Test body/privacy/cookie substitutions, replay concurrency, oversize, PHP upstream failure bounded fallback, DNT/GPC and opt-out. Capture desktop/mobile/screenshots and no console errors.
- [ ] Step4: Run lifecycle tests and real browser suite GREEN, then full `npm run check` with real DB/PHP. Clearly separate synthetic peer tests from live source measurement. Commit and document daily commands unchanged.

## Task7: Package manifest6, stable PHP loader and compatible rollback

**Files:** create ops metadata/lifecycle/PHP files above; modify `ops/{release,receiver,deploy,database-lifecycle}.cjs`, `scripts/{build,release-manifest,smoke,deploy-client}.mjs`, backend release/readiness; tests `scripts/visitor-context-{release,rollback}.test.mjs` plus build/receiver/manifest suites.
**Interfaces:** `visitorContext` metadata defined above; host tool `context-status|context-migrate` fixed allowlist. `prepareVisitorContext(config,current,candidate,{backupReceipt,run})` validates integrity, requires paired native backup, migrates/status before activation, no log/cron side effect. Stable loader uses known root/current/manifest and feature check, never request-derived path.

- [ ] Step1: RED tests for v6 requiring PHP+MMDB+SQL checksums, bad/missing assets rejected, manifest1–5 still accepted, native backup/restore includes new fields/receipts/ledger, migration failure leaves current old, routing change scoped only child path, PHP source never served.
- [ ] Step2: Implement v6 builder assets backend/relay, backend/geoip, visitor-context-migrations; cache dataset by pinned hash, include attribution. Keep max archive budget256MiB; measure resulting size, do not silently raise quota. Receiver bootstrap old loader backup before replace, private config0600, local routing gate Task1 applies.
- [ ] Step3: RED→GREEN actual pinned v5 backend after context DDL: auth/profile/readiness work and all original visitor data/observed fields remain; active v6→v5 disables PHP capability safely and frontend availability fallback writes unknown, no loss of history or secret leak. Forward restores v6/data, no new importer/TTLcron. Never select compatible tools solely from a random retained release; use current/candidate as existing lifecycle conventions.
- [ ] Step4: Run build/receiver/manifest/lifecycle/rollback targeted suites GREEN. Document loader/config bootstrap exact checksums and preserved old root routing. Commit.

## Task8: Final acceptance, production release and handover

**Files:** update `docs/{build-and-deploy,visitor-analytics-operations}.md`; create local/live acceptance report under `docs/superpowers/reports/`; ignored evidence under this plan workspace.

- [ ] Step1: Run complete check/build and actual compiled preview on exact committed source. Verify no secret/binary DB enters FE assets; IP/country remain permission-protected. One fresh whole-change reviewer per inline execution workflow, one fix pass for actionable findings with RED→GREEN and green suite; record all rulings.
- [ ] Step2: On hosting verify PHP version/extensions and source/control traffic (two sources minimum), HMAC/IP guard, cookie flags/path, both hostnames, IPv6 if network available; log raw IP only to private temporary fixture if indispensable, never chat/repo. Independent controlled request correlates to source evidence; no false claim from same mocked backend. Retest actual routing candidate and /api unchanged.
- [ ] Step3: Measure quotas/archive/MMDB and native paired backup/restore on verifier, bootstrap exact receiver/loader/config from committed checksum. Keys generated via existing approved private-secret procedure; if a new security-sensitive credential approval is required, prepare all reviewable files and ask only at final provisioning step.
- [ ] Step4: Push normal history to branch/main only after release authorization in session; successful main CI artifact, Run workflow/manual approval. Verify live batch204 records observed publicIP and estimated country without log wait; verify direct unsigned stays unknown, forged envelope rejected, auth/profile/refresh/product images/old tabs work. Do not declare pass on probes that never reach app.
- [ ] Step5: With authorized rollback drill, rollback to pinned v5 release and forward same successful v6 artifact; preserve all original keys/new fields and privacy flags, no schema down/restore overwrite. Leave final v6 live only after HTTP/browser smoke and UI verification pass. If approval absent, complete local/CI-ready deliverable and ask for release; don't infer permission to widen hosting access.
- [ ] Step6: Commit report listing changed files, commands/results/screenshots/release IDs, configured env names and unmeasured sources/IPv6/country misses; state explicitly which IP assurance remains deferred. Keep pending gates pending, not marked complete merely because build passed.

## Self-review and execution handoff

Spec coverage: Tasks1/3 routing+privacy+envelope;2dataset;4schema/collector;5UI/fallback;6one-command local+real PHP;7release/rollback;8review/live evidence. Review Focus entries each have explicit tests above. All cross-task names use RelayObservation/CountryLookup/visitorContext; no product code is written by this plan. PHP port/image placement, script internals and UI spacing are builder choices within the pinned constraints.

Owner previously selected inline/native execution for this workspace; preserve it. After owner reviews this plan, use executing-plans, a new plan-owned ledger and existing isolated worktree (verify before mutation), TDD task commits and one final reviewer. This plan is separate from the earlier analytics history plan; do not reuse/delete that plan's ledger or claim its pending IP gate complete prematurely.
