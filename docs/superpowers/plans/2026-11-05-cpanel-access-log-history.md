# cPanel Access Log History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ toàn bộ archive log BiBi còn có nguồn vào MySQL mỗi ngày, giữ lịch sử độc lập cPanel và xem trong trang Khách truy cập.

**Architecture:** Một importer Node24 đọc snapshot gzip private, xác minh prefix/checkpoint rồi commit record theo batch vào bảng feature riêng. React truy vấn API RBAC hiện tại; tracker khách/sản phẩm giữ nguyên, không trộn vào log HTTP. Một cron daily; không thêm PHP, dịch vụ, cPanel token, cookie hoặc thay đổi login.

**Tech Stack:** React19/TanStack Query/Table, Express5/TypeScript, Node24 fs/zlib/crypto, mysql2/MariaDB10.11.19, node:test, Vitest, Playwright, cPanel cron.

**Spec:** `docs/superpowers/specs/2026-11-05-cpanel-access-log-history-design.md` — owner approved05/11 after choosing daily and persistent history. Execution preference: continue native/inline in the existing isolated worktree, one fresh whole-branch review at the end; no per-task implementer agents.

## Global Constraints

- Daily02:30 Asia/Ho_Chi_Minh, convert only after measuring server timezone. One cron; runtime DML pool1; total run budget120seconds; batch500.
- Archive-only, correct BiBi alias HTTP+SSL, never current files plus archives together. No1000record cap, no90day cleanup for new data, no automatic DB purge.
- Existing4 auth migrations/hashes stay unchanged. Feature DDL has separate ledger; rollback e725 must still pass actual auth readiness. No down migration or production snapshot restore in app rollback.
- Preserve duplicate identical lines at different source positions. Nonempty malformed lines get safe marker rows. Diverged prefix pauses the stream, never reset/dedup-by-content silently.
- No raw IP/UA/query/body/cookie in DB/UI/application logs; mask /24 IPv4,/48 IPv6; unknown fields null. Operational source checksums are not visitor identity. No invented visitors/sessions/location.
- Reuse existing admin components/RBAC customer_access.view. One page, two clearly named datasets. Source IP remains unverified until Tino fixes it; no trust-proxy change.
- No archive/private config in artifact; no auth/cPanel/deploy secret printed or placed in argv/frontend. Read logs only for BiBi, not WP/staging. No setting change to cPanel archive/prune.
- Inspect docs/build-and-deploy.md first for every deployment/rollback. Main CI artifact, protected manual production gate, tested backup/restore/rollback required; no force push/Lovable history rewrite.

## Review Focus

1. Identical requests, cross-calendar archive names and gzip member/recompression changes must retain physical request multiplicity — pinned Task1/3.
2. Source mutation/disappearance and crash between DB insert/checkpoint must neither double records nor claim coverage of unavailable bytes — pinned Task2/3.
3. Untrusted archive bytes/URLs/encoding can carry secrets, HTML, decompression bombs or odd log syntax — pinned Task1/3/6.
4. Reverting to e725 after feature DDL must preserve auth readiness and all newly imported records/revocations — pinned Task2/7/8/9.
5. Missing source, dirty feature schema, delayed cPanel statistics or exhausted quota must show stale/backlog/error, not empty-success or crash the public website — pinned Task4/5/6/7.

## File map

- `backend/src/access-logs/{types,parse,sources,snapshot,repository,importer,schema,read-service,routes,cli,probe-cli}.ts`: focused feature boundary; parser does not touch DB; HTTP never opens files.
- `backend/access-log-migrations/001_access_logs.sql`: separate4-table feature DDL/ledger, not auth migration005.
- `backend/test/access-log-{parse,schema,repository,snapshot,importer,http,cli,rollback}.test.mjs`, `backend/test/helpers/access-logs.mjs`: synthetic combined-log/gzip fixtures and real MariaDB tests; never commit real hosting records.
- Existing `backend/src/app.ts`, `runtime.ts`, `http/contracts.ts`; `src/features/admin/analytics/{http-api,server-visitors}.tsx/ts` and `pages/visitors.tsx`; new `server-access-logs.tsx`: wire feature into existing app/page.
- `ops/access-log-metadata.cjs`, `ops/access-log-cron.cjs`, existing `release.cjs`, `receiver.cjs`, `database-lifecycle.cjs`, `deploy.cjs`; existing `scripts/{build,preview,local-database,check,auth-ui-check}.mjs`, `.github/workflows/ci.yml`: packaging, lifecycle, one daily cron and acceptance.
- `tests/admin/access-log-page.test.tsx`, `tests/e2e/access-logs.spec.mjs`, `docs/access-log-operations.md`, build/deploy guide and a real acceptance report.

## Shared interfaces (names are binding across tasks)

`AccessLogRecord`: `{id:string,sourceId:string,ordinal:number,occurredAt:string|null,method:string|null,pathname:string|null,status:number|null,bytes:number|null,ipPrefix:string|null,deviceType:string|null,operatingSystem:string|null,browser:string|null,resourceKind:'page'|'asset'|'api'|'other',isBot:boolean,referrer:string|null,parseStatus:'parsed'|'error',errorCode:string|null}`. Numeric database ordinals/offsets must stay within Number safe integers or expose strings consistently; reject unsafe input rather than round positions.

`AccessLogCheckpoint`: `{sourceId:string,basename:string,transport:'http'|'https',committedBytes:number,committedLines:number,recordCount:number,blankCount:number,prefixSha256:string}`. Bytes/lines cover exact original bytes including newline; recordCount excludes blanks but includes error markers.

`AccessLogSyncReceipt`: `{state:'complete'|'pending'|'error',inserted:number,parseErrors:number,pendingSources:number,divergedSources:number,missingSources:number,sourceThrough:string|null,startedAt:string,finishedAt:string}`. No raw rows, paths outside trusted source identities, secrets or UA.

### Task 1: Parser and sanitized record contract

**Files:** Create `backend/src/access-logs/types.ts`, `parse.ts`, `backend/test/access-log-parse.test.mjs`, `backend/test/helpers/access-logs.mjs`; modify `backend/src/http/contracts.ts`.
**Interfaces:** Produce `parseAccessLogLine(bytes:Buffer, sourceId:string, ordinal:number):AccessLogRecord|null` (null only blank line), plus the shared types. Reuse `networkPrefix` and controlled `deviceLabels`; no file/DB imports in parser.

- [ ] Write node:test fixtures/assertions: quoted/escaped combined format, IPv4/IPv6/mapped and invalid IP; +0700 date→UTC; bytes '-'→null; malformed UTF8/date/field count→safe error row; query/fragment/raw UA absent; two identical lines at ordinals1/2 produce distinct IDs; October timestamp in November source retained; HTML is inert data.

  Core assertions with the same valid fixture `line`: `assert.notEqual(parseAccessLogLine(line,'s',1).id, parseAccessLogLine(line,'s',2).id)`; `assert.equal(parseAccessLogLine(Buffer.from('broken'),'s',3).parseStatus,'error')`; `assert.equal(parseAccessLogLine(Buffer.from(''),'s',4),null)`.
- [ ] Run `node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.build.json` then `node --test backend/test/access-log-parse.test.mjs`. Expected RED missing parser/exports; do not accept test setup/database failure as reproduction.
- [ ] Implement exact parser contract. Deterministic ID hashes sourceId+ordinal, not raw line/IP. Decode safely; parse escaped quotes without regex greediness; strip query/fragment and bound output field lengths. Resource classification is deterministic, bot label heuristic only; never fetch target/referrer.
- [ ] Same commands → GREEN, all named inputs asserted, parser never logs raw data. Existing visitor normalization tests remain green.
- [ ] Commit parser/contracts/fixtures: `feat: parse and sanitize cPanel access records`.

### Task 2: Feature schema, transactional checkpoint and read repository

**Files:** Create SQL migration, `schema.ts`, `repository.ts`, `backend/test/access-log-schema.test.mjs`, `access-log-repository.test.mjs`; use existing DB helpers/transaction, do not modify SQL001–004.
**Interfaces:** Consume Task1 types. Produce `migrateAccessLogs(pool:Pool,directory:string):Promise<void>`, `readAccessLogSchema(pool:Pool,directory:string):Promise<{state:'empty'|'complete'|'dirty';version:number;checksums:Record<string,string>}>`, `getOrCreateSource(pool,basename,transport):Promise<AccessLogCheckpoint>`, `commitAccessLogBatch(connection,expectedCheckpoint,nextCheckpoint,records):Promise<void>` within caller transaction.

- [ ] Write real MariaDB RED tests for ledger/checksums/idempotent DDL, dirty/unknown version refusal before DDL, DML-only runtime, unique(source,ordinal), null parsed fields, count/blank reconciliation, concurrent stale checkpoint rejection. Inject failure after insert before checkpoint, assert rollback removes both; retry commits once.

  Assert `authStatus.version === 4`, `logStatus.version === 1`; after injected rollback `recordCount === 0 && committedLines === 0`; after one retry with two identical physical lines `recordCount === 2 && committedLines === 2`.
- [ ] Compile then `node --test backend/test/access-log-schema.test.mjs backend/test/access-log-repository.test.mjs` → RED missing feature; DB must be actual labelled isolated test DB from `scripts/test-database.mjs`.
- [ ] Implement independent ledger/table DDL, checksummed dirty migration handling and indices from spec. Run hash/readiness regression proving auth ledger still4; add feature tables to actual e725 Passenger fixture and check ready200/auth401 before any log APIs.
- [ ] Rerun feature tests plus `backend/test/migrations.test.mjs backend/test/passenger-runtime.test.mjs` → GREEN. No reset of auth/account data, no feature DDL in repository/runtime startup.
- [ ] Commit: `feat: persist access log batches with independent schema`.

### Task 3: Stable snapshots and resumable archive importer

**Files:** Create `sources.ts`, `snapshot.ts`, `importer.ts`, `backend/test/access-log-snapshot.test.mjs`, `access-log-importer.test.mjs`.
**Interfaces:** Consume Task1/2. Produce `discoverAccessLogArchives(config:AccessLogConfig):Promise<ArchiveSource[]>`, `snapshotArchive(source:ArchiveSource,config:AccessLogConfig,signal:AbortSignal):Promise<ArchiveSnapshot>`, `syncAccessLogArchives({pool,config,clock,signal}):Promise<AccessLogSyncReceipt>`. Define/export `AccessLogConfig` in types: `{archiveDirectory:string,domainAlias:string,workDirectory:string,limits:{compressedBytes:number,expandedBytes:number,workBytes:number,lineBytes:number,batchRows:number,runMs:number}}`. `ArchiveSource={basename:string,path:string,transport:'http'|'https'}`; `ArchiveSnapshot={basename:string,path:string,transport:'http'|'https',compressedSha256:string}` with path owned/private, not HTTP input.

- [ ] RED tests use generated gzip: normal replay no-op; append/new gzip members; recompress same content; identical duplicate lines preserved; HTTP/SSL distinct; commit crash/resume; source removed after snapshot; partial newline pending; prefix changed/truncated/reordered→diverged and no new rows; archive calendar boundary; no current-file import. Snapshot mutation during copy never ingested.

  For source `[A,A]`, assert first receipt inserted2, replay inserted0; append one `A` then inserted1/total3. Change already-committed first line to `B`: assert divergedSources1 and total remains3, not4 or0.
- [ ] Compile + `node --test backend/test/access-log-snapshot.test.mjs backend/test/access-log-importer.test.mjs` → RED missing snapshot/importer. No real log in fixtures.
- [ ] Implement bounded streaming and exact byte-prefix hashing before resume; compressed snapshots0600/work0700; source allowlist for measured alias only. Defaults: max64MiB compressed/file,256MiB expanded/file,512MiB work queue,64KiB line,500record transaction,120s total deadline. Limits pause/error with receipt, never drop input or auto-delete unfinished snapshot. Oversized physical line creates safe marker while consuming bounded chunks through its newline.
- [ ] Extend tests: corrupt/truncated gzip, bomb, unsafe file/symlink/filename, permission loss, overlong line/query/UA, deadline mid-batch, work quota, snapshot-prefix mismatch. GREEN all feature tests; records persisted after fixture source deletion.
- [ ] Commit: `feat: import cPanel archives with resumable checkpoints`.

### Task 4: CLI, private configuration and local lifecycle

**Files:** Create `backend/src/access-logs/cli.ts`, `backend/test/access-log-cli.test.mjs`; modify `backend/src/runtime.ts`, `scripts/local-database.mjs`, `.env.example`, local/check tests as required; create `docs/access-log-operations.md`.
**Interfaces:** CLI fixed enum `migrate|status|sync`; private env only; exit0 complete/no-op,2 pending,1 failure. `sync` emits only shared receipt. Runtime app option provides log read service only after schema check; neither startup nor HTTP triggers sync/migrate.

- [ ] RED tests for CLI commands, invalid/path injection input, missing/bad private config, owner0600 checks, count-only errors, runtime DML pool1 and shutdown, dirty schema503 without auth/public failure; local setup explicitly creates feature schema using synthetic archives.

  Assert pending receipt yields exit2, failed config exit1, complete/no-op exit0; `stdout.includes(fixturePassword) === false` and same for stderr/raw fixture line. CLI rejects `sync /etc/passwd` rather than reading any extra argv.
- [ ] Compile + `node --test backend/test/access-log-cli.test.mjs scripts/local-database.test.mjs` → expected missing CLI/config wiring.
- [ ] Implement `ACCESS_LOG_ARCHIVE_DIR`, `ACCESS_LOG_DOMAIN_ALIAS`, `ACCESS_LOG_WORK_DIR` as3 private nonsecret settings agent configures once; no token/key. CLI uses `BIBI_PRIVATE_ENV_FILE` as existing convention. Maintenance env only for migrate; runtime env for status/sync. Trusted test fixtures isolated; normal dev still npm run dev.
- [ ] Rerun → GREEN, no live reads in local/CI. Document defaults, scope, parse/source errors, daily/stale semantics and manual recovery command without granting HTTP file access.
- [ ] Commit: `feat: add explicit access log lifecycle commands`.

### Task 5: Private record/status API

**Files:** Create `read-service.ts`, `routes.ts`, `backend/test/access-log-http.test.mjs`; modify `backend/src/app.ts`, runtime/contracts.
**Interfaces:** `createAccessLogReadService(pool,clock)` provides list/detail/status. Register `/api/customer-access/access-logs`, `/api/customer-access/access-logs/status`, `/api/customer-access/access-logs/:id` before visitor `/:id`; GET only. Reuse JWT + customer_access.view. No import/file endpoint.

- [ ] RED test real SQL with >1200 rows:401 missing JWT,403 no permission, User/Admin200; pages20/50/100 preserve entire total without cap1000; identical count/list filters; date UTC boundaries, search wildcard escaping, IP/path/status/resource/bot filters; malformed/unsafe pagination400; missing/dirty schema503; parse errors visible and total includes them. Assert source errors not empty-success and no source private paths/raw data returned.

  For1205 synthetic records and pageSize100: assert total1205, page1 items100, page13 items5; unauthenticated401 and restricted-probe403. Error marker row remains reachable by ID even when occurredAt is null.
- [ ] Compile + `node --test backend/test/access-log-http.test.mjs` → RED404/missing service.
- [ ] Implement prepared SQL with deterministic ordering occurred_at/id, null date error rows consistently ordered, shared WHERE for count/list. Filters never default90day cutoff. Limit100 per response; no arbitrary max total/page that makes later historical rows unreachable. Validate offset safety or implement cursor if required; API contract/page UI consistent.
- [ ] GREEN new HTTP tests plus visitor-read/RBAC/auth tests; old visitor static/detail routes still resolve and tracker reports unchanged.
- [ ] Commit: `feat: expose protected cPanel history queries`.

### Task 6: One visitor page with cPanel records and existing tracker

**Files:** Create `src/features/admin/analytics/server-access-logs.tsx`, `tests/admin/access-log-page.test.tsx`; modify `src/features/admin/analytics/http-api.ts`, `src/features/admin/analytics/server-visitors.tsx`, `src/features/admin/analytics/pages/visitors.tsx`; no new sidebar item or chart dependency.
**Interfaces:** `createAccessLogApi(http)` wraps Task5 list/detail/status using existing memory-token client. Page search `view=logs|visitors`, default logs for new visits; preserve deep link `visitor=<id>` by selecting visitors mode when no explicit view supplied. Query keys include actual account/session and filters; abort on account changes.

- [ ] RED UI tests: >1000total/next pages, default logs, 2modes in same page, old visitor link, filters/date/page-size, keyboard/touch usability; missing source/dirty schema/error/empty distinct; stale and pending labels; error marker details; escaped malicious HTML; no guessed location/session/unique visitor counts. No local fixture fallback for server log API.

  Assert loaded logs show “Đồng bộ hằng ngày” and1205 total, clicking next sends page2 with identical filters; source503 renders ErrorState rather than “Chưa có dữ liệu”. `<script>` in a fixture pathname must appear as text with no executable element.
- [ ] `node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin/access-log-page.test.tsx` → RED missing view/API.
- [ ] Reuse DataTable/primitives. Columns from spec, labels Vietnamese, IP masked; count is “request/bản ghi”. Show sync/source timestamps/status. Operational log explanation separate from tracker privacy/90days/product interests; no IP+UA joining.
- [ ] GREEN new UI plus `tests/admin/visitor-http.test.tsx tests/admin/visitors-page.test.tsx`; typecheck/lint. New parser/mysql/fs imports absent from frontend graph. No source path or credentials in browser.
- [ ] Commit: `feat: show complete cPanel history in visitor page`.

### Task 7: Artifact3, fixed host lifecycle and daily cron

**Files:** Create `ops/access-log-metadata.cjs`, `ops/access-log-cron.cjs`, `backend/src/access-logs/probe-cli.ts`; modify manifest/build/preview/receiver/deploy/database-lifecycle and existing release/deploy tests; new `scripts/access-log-release.test.mjs`, `access-log-cron.test.mjs`, `backend/test/access-log-rollback.test.mjs`.
**Interfaces:** Manifest3 adds `accessLogs:{requiredMin:1,compatibleMax:1,migrationChecksums:Record<string,string>}`; auth database metadata stays4..4. Versions1/2 exact old shapes remain accepted. Fixed host commands `access-log-migrate|access-log-status|access-log-sync|access-log-probe` invoke exact compiled CLI/probe paths, never caller SQL/path. Feature metadata hashes separate migration directory.

- [ ] RED tests: old receiver rejects3; new receiver validates1/2/3 and all assets, rejects missing/tampered feature/hash/private/symlink; backup covers new tables/checkpoints; dirty feature state blocks activation; probe failure restores old pointer/schema4 readiness and preserves log records/auth revocations. Cron backs up and preserves existing jobs, single marker, fixed paths/runtime env, no secrets; skips old current without CLI, holds deployment lock through sync and prevents prune race.

  Assert `validateManifest(v3).accessLogs.requiredMin === 1`; tampered SQL rejects before install/activation. With a post-backup record and revoked session, force probe failure: current returns e725, auth ready200, that record/revocation still exists. After cron install twice: exactly one own marker and original unrelated cron bytes unchanged.
- [ ] Compile + `node --test scripts/access-log-release.test.mjs scripts/access-log-cron.test.mjs backend/test/access-log-rollback.test.mjs` → RED missing feature support.
- [ ] Implement backup→feature migrate/status→bounded bootstrap sync before activation; pending sync/backlog must be reported, bootstrap completion required for first live acceptance. Backend probe signs in restricted probe, asserts403 as before, checks schema/status/counts privately; no public path/raw data. Stable cron helper outside releases selects immutable current under flock, runs daily sync using runtime config; full120s deadline includes I/O. Install exactly one daily entry converted from measured serverTZ; no cPanel API credentials or other cron changes.
- [ ] GREEN new + `scripts/release-manifest.test.mjs scripts/auth-release.test.mjs scripts/auth-deploy.test.mjs scripts/deploy.test.mjs backend/test/backup.test.mjs`; test actual e725 factory/status with feature tables, not a permissive mock. Source/archive/prune settings unchanged.
- [ ] Commit: `feat: deploy and schedule daily access log history safely`.

### Task 8: Full local/CI/browser acceptance and operations docs

**Files:** Create `tests/e2e/access-logs.spec.mjs`; extend `scripts/auth-ui-check.mjs`, `scripts/check.mjs`, CI as needed; update operations/build docs and create `docs/superpowers/reports/2026-11-05-cpanel-access-log-acceptance.md` with explicit local/live status.
**Interfaces:** Real labelled MariaDB fixture+generated gzip, actual compiled importer+Express+React. No hosting secrets/records in CI; no synthetic production claim.

- [ ] Write actual browser RED flow before final acceptance wiring: import1205+ rows including identical lines/error row; log in User default log view, paginate/filter/source status/detail at desktop and390px; tracker switch retains product interest; Admin unchanged; reload refresh works; source fixture deletion leaves records; screenshots wait for loaded data.
- [ ] `node --test tests/e2e/access-logs.spec.mjs` → meaningful RED at missing combined behavior; finish integration without timeout relaxation/fixture fallbacks. Add to standard check so it is not optional hand-run only.
- [ ] Run `npm run check`, `npm run build` via Node24 (explicit cached executable/npm-cli if shell uses another version). Expected exit0 full suites, actual browser screenshots inspected, public budget unchanged within existing threshold, SQL/parser not in public bundle; inspect all failed outputs before fixing.
- [ ] Fresh whole-branch review using requesting-code-review, once. Fix important findings RED→GREEN with targeted regressions then full suite; ledger minor/deferred/rulings. No per-task review agent loops. Update docs with exact commands/counts/source artifact, mark live remaining.
- [ ] Commit: `test: verify cPanel history and document operations`; normal push/main CI only when checks green and session authorization applies. Do not infer deploy from build.

### Task 9: Hosting acceptance, production and rollback evidence

**Files:** Final report/operations/build docs; ignored receipts/screenshots/SSH helpers under this plan workspace only. No new product code without test/fix loop.
**Interfaces:** Consume exact main CI artifact, trusted tools hashes, private existing DB accounts, approved daily config and actual cPanel archive snapshots.

- [ ] Capture source receipt prefix/offset/checksum now and after actual cPanel statistics archive update. Verify uncompressed prefix remains identical (recompression alone okay). This may require the next daily archive cycle; code/local tests continue while waiting, no fake cycle or completion claim. If behavior diverges, stop first release/cron and return to design with evidence.
- [ ] Verify domain-only source permissions, runtime vs maintenance grants, TZ, work/snapshot quota, backup128MiB/verifier headroom and source prune state. Prepare complete tool/config/cron changes for review before requesting any newly required security-sensitive access. Existing approved DB permissions need no redundant request; no new credentials needed by design.
- [ ] Normal main CI→exact artifact→trusted tools bootstrap→protected manual production release. Native backup/isolated restore-check before feature DDL. Bootstrap archive import until all present snapshots complete, reconcile each stream live counts/parse markers/positions, re-run no-op, source data never edited. Do not hardcode8245 if archives changed.
- [ ] Verify User/Admin real UI, >1000dataset pagination, old visitor links/tracker unchanged, API/FE/BE identity, public images/TinyMCE and old open client. Install daily cron02:30VN after TZ conversion, preserve others. Observe actual cron execution of the fixed helper (temporary one-shot schedule may verify the same command, then remove only its marker); distinguish that from first recurring daily execution in report.
- [ ] Real app rollback to exact e725 release approved in this session scope, verify auth ready, new imported records/checkpoint/revocations retained; re-release same verified artifact, sync retry no duplicates. No down migration/data restore. Capture screenshot/receipts/backup hashes/current and previous releases.
- [ ] Commit/push truthful final docs; mark complete only after all required live checks, archive-prefix gate, daily helper and rollback pass. If source gap/prune has already removed history, show measured coverage and unavailable period rather than fabricate “all history”. Preserve worktree/ledger while acceptance pending.

## Plan self-review

Coverage: spec1–3→constraints/Task5–6;4–5→Task2–4/9;6→Task1–2/7–9;7→Task5–6/8;8→Task4/7–9;9→Task8–9; owner choices10→constraints/Task6–7/9. Shared interface names/fields above are used across parser, repository, importer, API and UI; no undeclared schema5 or gateway dependency. All5 Review Focus conditions have explicit owning tests. Every implementation task has a meaningful RED run, exact code interface, GREEN run and commit. Task9 is external acceptance, not a code implementation/test shortcut.
