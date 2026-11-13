# Visitor Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved visitor analytics UI with date-only filtering, durable history and full verified public IP on the existing cPanel stack.

**Architecture:** Retain React/Express/MariaDB and the cookie/session collector. Add an independent additive analytics schema, exact date-window/report services and an incremental session reader. Full client IP activation depends on measured Tino proxy configuration; removal of active cPanel-log functionality preserves old data/schema and rollback compatibility.

**Tech Stack:** Node24, TypeScript, Express5, mysql2/MariaDB, React19, TanStack Query/Table, existing Recharts/Radix, Vitest and real database/browser integration checks. No new service or dependency.

**Spec:** `docs/superpowers/specs/2026-11-13-visitor-analytics-design.md`, approved after the owner changed custom filtering to dates without time.

## Global Constraints

- Keep React + Express + MySQL/MariaDB on cPanel; no PHP/CDN/new-hosting fallback without another owner decision.
- Keep all real collected visitor/session/page/product history; no automatic 90-day/12-month pruning.
- Cookie validity remains 90 days, independently of storage retention. Expired release probes can still be removed; auth cleanup is unchanged.
- Use full public IP only from a verified hosting boundary. Unknown/legacy prefixes do not become invented full IPs; no frontend IP input or external GeoIP calls.
- Preserve `customer_access.view` backend enforcement, including existing User access; no public raw-IP endpoint or raw-IP logging.
- Date filters: rolling 1/6/12 calendar months or **Khoảng ngày**, default 1 month, Asia/Ho_Chi_Minh, date-only inputs, inclusive end date.
- Count sessions by `started_at` within the chosen interval; use the same selected-session cohort for all metrics, rows and products.
- Keep per-session 200-path/100-product bounds and honest `truncated` messaging; record distinct paths, not every click/reload.
- No destructive DDL/data purge, automatic reactivation of old retention cron, force push, production fixture failure injection or unsupported completion claims.
- Follow `docs/build-and-deploy.md`; deploy only a successful main-push CI artifact, with manual production gate and verified recovery.

## Review Focus

1. An older rollback backend plus a current-relative cron can silently resume deleting history: durable cron removal must precede activation and remain in effect through rollback (Task 7/8).
2. Same browser changes IP/OS, or two browsers share an IP: use session metadata and cookie identity, not IP grouping (Tasks 2/3).
3. A session crosses midnight/filter end: count it once at its start, retain all session URLs and make cohort semantics explicit (Tasks 1/4).
4. Changing a date range during an in-flight table/detail/report request must not mix previous results into new totals (Tasks 5/6).
5. Arbitrarily long history and long IPv6/product/URL labels must not cause unbounded payloads, hidden truncation or horizontal page overflow (Tasks 4/5/6/8).

## File Boundaries and Interfaces

| Area                | Files                                                                                                                                                  | Responsibility                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Date/DTO            | `backend/src/visitors/date-window.ts`, `backend/src/http/contracts.ts`                                                                                 | Canonical UTC window and shared response contracts                             |
| Durable schema      | `backend/visitor-migrations/001_history.sql`, `backend/src/visitors/schema.ts`, `backend/src/visitors/cli.ts`                                          | Independent feature ledger, additive DDL, explicit migration/status            |
| Source IP           | `backend/src/http/client-address.ts`, existing `config.ts`, `http/security.ts`                                                                         | Validate normalized IP and measured trusted source, never guess a proxy        |
| Collection          | existing `visitors/collector.ts`, `routes.ts`, `normalize.ts`, `cleanup.ts`, `db/cli.ts`                                                               | Session-level metadata, unchanged batching/dedup/cookies, probe-only deletion  |
| Reporting           | existing `visitors/service.ts`, `private-routes.ts`; new `report-query.ts`, `session-history.ts`                                                       | One cohort, distinct counts, series/ranking and cursor detail                  |
| FE API/model        | existing `analytics/http-api.ts`; new `visitor-date-filter.ts`                                                                                         | Abortable canonical filters and query keys                                     |
| FE view             | existing `analytics/server-visitors.tsx`, `pages/visitors.tsx`; new components `visitor-filters.tsx`, `visitor-charts.tsx`, `visitor-session-list.tsx` | Reviewed layout, charts and incremental detail                                 |
| Release             | new `ops/visitor-metadata.cjs`, `ops/visitor-lifecycle.cjs`; existing manifest/deploy/backup/local setup files                                         | Feature schema5 manifest, safe cron policy, compatibility and verified restore |
| Retired log surface | `analytics/server-access-logs.tsx`, log API adapter, backend route/runtime binding, importer cron                                                      | Remove active feature; preserve frozen data/migration/rollback support         |

Shared DTO additions in `backend/src/http/contracts.ts`:

- `VisitorWindowDto { fromDate: string; toDate: string; startUtc: string; endUtcExclusive: string; asOf: string }` — dates are `YYYY-MM-DD`, UTC timestamps are ISO, `asOf` is fixed for a load.
- `VisitorScopeInput { from: string; to: string; deviceType?: "mobile"|"tablet"|"desktop"; browser?: string; search?: string }` — from/to are validated dates, search is trimmed text/max100.
- `VisitorIpStatus = "verified" | "legacy" | "unavailable"`; extend visitor/session DTOs with `ipStatus`, normalized `ipAddress` (empty when unavailable), and session device/OS/browser. Keep existing IDs and old DTO keys for old tabs.
- `VisitorReportDto` retains `totalVisitors`, `totalSessions`, `products`; adds `totalInterestedVisitors`, `totalProducts`, `window`, `bucketUnit`, `series: { startUtc:string; label:string; sessions:number }[]`.
- `VisitorSessionHistoryDto { items: VisitorSessionDto[]; nextCursor: string|null; window: VisitorWindowDto }`; keep old paginated `/sessions` endpoint as a read-only compatibility adapter during the old-client window, but new UI uses `/session-history`.
- `VisitorProductPageDto { items: { slug:string; name:string; interestedVisitors:number }[]; total:number; page:number; pageSize:number; window:VisitorWindowDto }` for the chart's **Xem tất cả** drill-down.

No task uses a contract that is not defined here. Services consume explicit normalized windows rather than independently reading the current clock. Existing public collector request shape remains unchanged.

## Task 1: Date-only windows and report contracts

**Files:** Create `backend/src/visitors/date-window.ts`, `backend/test/visitor-date-window.test.mjs`; modify `backend/src/http/contracts.ts`.

**Consumes:** approved filter semantics and existing Clock.
**Produces:** `resolveVisitorWindow(input: { preset?: "1m"|"6m"|"1y"; from?:string; to?:string }, now:Date): VisitorWindowDto`; `selectVisitorBucket(window): "hour"|"day"|"week"|"month"|"year"`; DTOs above.

- [ ] Write failing tests: custom `2026-11-01` through `2026-11-13` resolves to `2026-10-31T17:00:00.000Z` inclusive / `2026-11-13T17:00:00.000Z` exclusive. Same-day filter includes the entire local day. Reject `2026-02-30`, missing half of a custom interval, reversed dates and mixed preset/custom fields.
- [ ] Test calendar clamp/leap behavior explicitly. For day-only presets, compute tomorrow 00:00 Vietnam as exclusive end, then subtract 1/6/12 calendar months from that boundary (clamp last day). At `2026-11-13T03:00Z`, 1m is 14/10–13/11 inclusive. At `2024-03-30T12:00Z`, 1m begins 29/02. Months never mean fixed 30-day periods.
- [ ] Run `node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.build.json` and `node --test backend/test/visitor-date-window.test.mjs`. Expected RED before module exists.
- [ ] Implement the pure resolver, limiting date years to 1970–9999 and producing serializable ISO values without machine timezone dependence. A custom end later than today is valid but has no future events; do not silently change selected dates. Fix `asOf` from the supplied clock.
- [ ] Choose buckets: <=2 local days hour, <=90 day, <=730 week (Monday start), <=7305 month, otherwise year. Emit partial first/last buckets clipped by the exact query interval. Unit-test empty buckets and boundary membership.
- [ ] Repeat focused commands; expected all tests pass. Commit `feat: define date-only visitor analysis windows`.

## Task 2: Independent durable-history schema and source-address seam

**Files:** Create `backend/visitor-migrations/001_history.sql`, `backend/src/visitors/schema.ts`, `cli.ts`, `backend/src/http/client-address.ts`, `backend/test/visitor-history-schema.test.mjs`, `visitor-client-address.test.mjs`. Modify `.gitattributes`, `backend/src/config.ts`, `.env.example`, `scripts/local-database.mjs` and its test.

**Consumes:** DTO IP status; existing private-env, mysql pool and profile feature-migration conventions.
**Produces:** `migrateVisitorHistory(pool,directory)`, `visitorHistorySchemaStatus(pool,directory)` with `{version,state,migrationChecksums}`; CLI `migrate|status`; `resolveClientAddress({peer,ip,sourceVerified,trustedCidrs}): {address:string|null;status:"verified"|"unavailable"}`.

- [ ] Write real isolated-DB tests for empty→complete schema, idempotence, interrupted additive DDL resume, checksum/DDL drift rejection and preserving existing rows. Existing `schema_migrations` stays exactly versions1–4.
- [ ] Migration uses separate `visitor_history_schema_migrations`. Add nullable `client_ip VARCHAR(45)`, `ip_status VARCHAR(20) NOT NULL DEFAULT 'legacy'`, `device_type`, `operating_system`, `browser` to sessions, with old visitor metadata available as a fallback for legacy session display. Preserve existing `ip_prefix` and all columns/tables. Add `(started_at,visitor_id,id)` and `(visitor_id,started_at,id)` indexes; index full client_ip only if EXPLAIN of the chosen search needs it. New fields get no fabricated backfill.
- [ ] Write pure address tests for valid public IPv4/IPv6, mapped IPv6, malformed/loopback/private/reserved and unknown peer. A non-empty forwarded value without a verified source and trusted peer must return unavailable. Keep raw addresses out of thrown messages/logs.
- [ ] Implement feature schema/CLI with private-env guards and dirty-state handling like profile schema; LF SQL checksums via `.gitattributes`. `readAuthConfig` adds `CLIENT_IP_SOURCE_VERIFIED` (default false); true requires nonempty exact trusted CIDRs. False keeps full-IP resolver unavailable, without disabling existing auth or visitor tracking.
- [ ] Resolver consumes Express `req.ip` only after the trusted boundary is activated; it does not parse leftmost arbitrary XFF. Reuse existing ipaddr.js; no new dependency. If Tino supplies secure Passenger headers instead, replace only the source adapter after measuring it and add binding/spoof tests before enabling; never fabricate support.
- [ ] Integrate explicit local migration after base/profile migrations. No schema writes at runtime startup, HMR or HTTP requests.
- [ ] Run `tsc` then the two new backend test files and local-database tooling test; expected RED→GREEN. Commit `feat: add durable visitor history metadata`.

## Task 3: Retain real history and record per-session metadata

**Files:** Modify `backend/src/visitors/collector.ts`, `routes.ts`, `normalize.ts`, `cleanup.ts`, `backend/src/db/cli.ts`; create `backend/test/visitor-history-retention.test.mjs`; update existing collector/cleanup tests where their old retention assumptions intentionally change.

**Consumes:** Task2 source resolver/session columns; existing signed cookie and collector transaction.
**Produces:** unchanged `collectVisitor` public batch shape, enriched session snapshots, probe-only `cleanupAnalytics` behavior.

- [ ] Write a regression fixture with real visitor/session/pages/products older than 90 days and an expired is_probe visitor. Run cleanup and assert all real historical rows survive while only expired probe-linked rows are removed; auth cleanup still expires auth sessions normally.
- [ ] Test cookie 90-day expiry unchanged and independent from retained data: new cookie creates a new visitor without deleting/linking old history. Two cookies with the same IP remain separate visitors; one cookie with a later session/new IP retains both old and new IP snapshots.
- [ ] Add exact 30-minute and 30-minute+1ms boundary tests, concurrent two-tab batches and duplicate product/URL batches; counts and unique links stay correct. Preserve DNT/GPC/opt-out, 15-second batching and rate limits. At 201 distinct URLs or 101 products, expose `truncated`, do not silently claim a complete click history.
- [ ] Rename the cookie-only constant to `VISITOR_COOKIE_TTL_MS` and remove TTL from real-history cleanup. Keep compatibility export only if required by old test clients, but production cleanup must not derive a deletion cutoff from it. `analytics:cleanup` becomes probe-only and returns separate safe counts.
- [ ] Populate metadata at session creation and update it consistently on received activity; latest IP for a selected visitor comes from that selected session's last verified observation. Unknown requests never overwrite a previous verified IP with loopback. Never group by IP. Keep networkPrefix for throttle buckets separately.
- [ ] Run focused retention/collector/cleanup/privacy tests on real test DB; verify all RED→GREEN cases. Commit `feat: retain all real visitor sessions and page interests`.

## Task 4: Filtered aggregate APIs and incremental session history

**Files:** Modify `backend/src/visitors/service.ts`, `private-routes.ts`, `backend/src/app.ts`; create `report-query.ts`, `session-history.ts`, `backend/test/visitor-report-window.test.mjs`, `visitor-session-history.test.mjs`.

**Consumes:** Task1 window/contracts and Task2 session metadata. **Produces:** `createVisitorService` methods `list`, `get`, `report`, `productReport`, `sessionHistory`, and legacy `sessions` compatibility method, all normalized around the same `VisitorScopeInput`.

- [ ] Seed a deterministic real DB fixture: visitorA has two selected sessions plus one outside, visitorB shares its IP but has one selected session, both view productP repeatedly; another selected session crosses end midnight and has a product/URL after the boundary. Assert selected session count, distinct visitor/product counts and complete cross-boundary details match the approved start-cohort semantics; series sum equals totalSessions exactly. Old data >90 days is queryable by custom dates.
- [ ] Add HTTP tests for missing auth401, no permission403, permitted User/Admin200, invalid/reversed dates400, empty windows200 with zero buckets and no rows. Visitor existing outside the selected interval returns metadata plus zero selected counts; missing UUID404. No raw IP in public collector responses or unauthorized error bodies.
- [ ] Implement parameterized cohort SQL anchored by `s.started_at >= start AND s.started_at < end`, join is_probe=0, apply device/browser/IP filters to session snapshots with legacy metadata fallback. Preserve database read indexes and return only page-sized raw rows. Search raw verified IP or legacy prefix explicitly; UI never renders legacy as a full public IP.
- [ ] Every list/report/session response returns the effective window. Last-seen/IP/device values come from selected sessions, not globally newest rows outside scope. Series includes zeros in local timezone and uses COUNT of selected sessions, not COUNT of page/product join rows.
- [ ] `GET /api/customer-access/report` returns Top10 products and totalProducts. `GET /api/customer-access/report/products` supports page1/pageSize20 (max100), ranking by distinct visitors then slug, for **Xem tất cả**. Remove product filter from new validation/options; retain old request compatibility only where needed to give existing tabs a controlled reload/error rather than crash.
- [ ] `GET /api/customer-access/:id/session-history` accepts window/device/browser/search plus opaque cursor, limit20. Cursor binds filter-window fingerprint and `(last_received_at,id)` descending; reject malformed/mismatched cursor400. Use stable keyset predicates, no arbitrary client SQL. Return `nextCursor=null` at end; path/product links remain bounded per session. Legacy `/sessions?page...` remains bounded/read-only for old tabs, with default window and unchanged old response keys.
- [ ] Test 45 sessions across three loads: no duplicates at equal timestamps, no missing stable rows, correct empty/end/retry behavior, filter-changing cursor rejection. Test 100 products in ranking without dropping the tail; Top10 and paged totals agree.
- [ ] Run `tsc` and focused real-DB/API tests, inspect EXPLAIN on 10000 synthetic sessions; no frontend full-history dump or N+1 per visitor page. Commit `feat: add windowed visitor reports and cursor session detail`.

## Task 5: Date filter and reviewed overview UI

**Files:** Modify `src/features/admin/analytics/http-api.ts`, `server-visitors.tsx`, `pages/visitors.tsx`, `admin.css`; create `visitor-date-filter.ts`, `components/visitor-filters.tsx`, `visitor-charts.tsx`; tests `tests/admin/visitor-date-filter.test.ts`, `visitor-overview.test.tsx`, update `visitor-http.test.tsx`.

**Consumes:** Task1/4 DTOs/API. **Produces:** `VisitorFilterState`, `resolveFilterDates(state,now)` with strings reused in all query keys/API requests, reviewed overview.

- [ ] Write tests that default is 1 tháng and buttons are exactly 1 tháng/6 tháng/1 năm/Khoảng ngày. Clicking Khoảng ngày reveals two `type=date` inputs, no time fields. Invalid calendar/reversed range blocks Apply; inclusive end date stays correct across browser timezone differences.
- [ ] Test all API requests share from/to/device/browser/search, reset table page on filter Apply, and stale in-flight responses are not shown under the new range. Pass AbortSignal through existing HTTP client; do not retain placeholder data from an old filter as current.
- [ ] Implement canonical filters (URL state may retain from/to for sharing); default preset dates are resolved once per load/Apply. **Tải lại** refreshes report/list/options using the same chosen date values, not importer jobs. Explain preset and cohort semantics in unobtrusive helper text.
- [ ] Render hierarchy: title/filter → 3 KPI → sessions line chart → visitor table → product bar chart. Remove ID column; keep UUID internally, use STT based on current table offset and explicit Chi tiết. Preserve table paging. Format full IPv4/IPv6; legacy/unavailable displays Chưa xác định with source status, not `127.0.0.0/24` presented as actual customer IP.
- [ ] Use existing Recharts with line/area sessions chart and horizontal Top10 products. Long labels have aligned fixed axes and full tooltip; numerical values and a text/table alternative remain available. **Xem tất cả** opens bounded product report table from Task4. Device/browser remain; product filter/log-source switch disappear. Preserve light/dark/reduced-motion/keyboard behavior.
- [ ] Test zero/loading/error/retry states for independent sections, IPv6/long product names and mobile viewport without page-level horizontal overflow. Run focused Vitest and TypeScript; expected RED→GREEN. Commit `feat: refresh visitor overview with shared date-only filters`.

## Task 6: Compact session detail and full recorded URL lists

**Files:** Create `src/features/admin/analytics/components/visitor-session-list.tsx`; modify `ServerVisitorDetail` and `http-api.ts`; test `tests/admin/visitor-session-list.test.tsx`.

**Consumes:** selected visitor/scope and Task4 sessionHistory cursor API. **Produces:** compact popup with incremental history, no numeric session pagination.

- [ ] Write tests for date/time header, products, count and expandable URL rows with first-received time; newest session open by default. No Phiên trước/Phiên sau/Trang N controls appear. URLs are safe public path links; no admin/API/query/hash injection or unescaped HTML.
- [ ] Test Xem thêm requests the returned cursor, appends unique session IDs, retains open panels/focus/scroll and hides at `nextCursor=null`. Failed load preserves already loaded rows and offers retry; filter or visitor switch cancels previous work and resets the cursor/list; stale old responses cannot append.
- [ ] Implement summary and accordion matching the approved prototype with existing Modal/Radix patterns. Display session-level device/IP when changed, complete recorded URLs including cross-midnight continuation and explicit truncated notice for limits. Browser 90-day cookie caveat goes in help, not a distracting identity ID column.
- [ ] Run focused interaction tests, then manual authenticated local desktop/mobile check using synthetic IPs. Save screenshots of overview, custom date filters and long detail; no mutation of user business data. Commit `feat: show compact expandable visitor session history`.

## Task 7: Retire active cPanel logs and make deployment retention-safe

**Files:** Modify `backend/src/app.ts`, `runtime.ts`, `release.ts`, `ops/release.cjs`, `deploy.cjs`, `database-lifecycle.cjs`, `receiver.cjs`, `scripts/build.mjs`, `scripts/release-manifest.mjs`, `deploy-client.mjs`, `local-database.mjs`, backend backup/restore verification modules and related release tests. Create `ops/visitor-metadata.cjs`, `visitor-lifecycle.cjs`, `visitor-cron-policy.cjs`, `scripts/visitor-release.test.mjs`, `visitor-rollback.test.mjs`, `visitor-cron-policy.test.mjs`. Remove log-only FE surface/adapters/runtime routes; retain frozen legacy schema/backup support explicitly.

**Consumes:** new feature schema status and existing profile/access-log compatibility tooling. **Produces:** manifest schemaVersion5 with `visitorAnalytics:{requiredMin:1,compatibleMax:1,migrationChecksums:{"001_history.sql":sha256}}`; receiver that accepts existing manifests1–4 plus5; durable cron policy receipt.

- [ ] Write tests that v5 feature metadata/checksums are required, auth schema remains4, old v4 release still verifies after analytics DDL and rollback never restores or deletes historical data. Unknown/dirty/checksum mismatch blocks activation. Include new feature migration and metadata tables in native backup/restore verification.
- [ ] Write cron tests with unrelated jobs and old analytics/log marker lines: remove only the precise BIBI log-importer and real-history cleanup entries, preserve all other bytes/auth cleanup, save private backup/receipt, idempotent re-run. Inspect the actual old analytics cleanup line before matching; never broad-match/delete all Node cron jobs.
- [ ] Implement stable cron removal outside `current` before any production activation; rollback to v4 must not reinstall it. New probe cleanup may be scheduled only against a retention-safe stable tool or kept in explicit release probe cleanup; no fallback to current-relative real-history cleanup.
- [ ] Add metadata/schema checks and explicit maintenance migration commands to fixed receiver allowlist; no generic remote SQL/shell operation. Stage1 ops bootstrap updates the receiver/tool files only after tests/checksums and observed host capability. Backups precede additive DDL, runtime retains DML-only rights.
- [ ] Gate access-log migrate/sync/probe behavior on manifests<=4. For v5, verify frozen old schema/checksum only when backup/compatibility needs it; do not call importer or require source log directory readiness. Remove active HTTP routes and runtime log-source/env binding, so log endpoints return JSON404 and new app starts without active log source config. Remove current/archive UI and active importer invocation. Retain old SQL/schema status/backup code/data needed by old releases; no archive/drop/purge.
- [ ] Preserve original public `/api/health`, `/api/version`, readiness auth/profile guarantees, HttpOnly cookies and current production manual gate. For manifest5 add visitor schema status to readiness/probes; `readRelease()` must not silently drop version5. Build includes analytics feature migration assets, but no env, private paths, raw logs or secrets.
- [ ] Test deploy/probe failure triggers code rollback without restarting removed cron. Verify fixture history older than90 days survives forward → old v4 app → new app, and old v4 auth/profile readiness stays200. Existing old app UI may show its old90-day slice; DB remains intact. Verify retained log data and avatar pointers survive paired restore checks.
- [ ] Run focused tooling/backend tests plus full check/build. Commit `feat: retire cPanel log collection and preserve history across rollback`.

## Task 8: Hosting IP acceptance, integrated verification and production handover

**Files:** Add `docs/visitor-analytics-operations.md`, `docs/superpowers/reports/2026-11-13-visitor-analytics-acceptance.md`, `tests/e2e/visitor-analytics.spec.mjs`; modify `scripts/auth-ui-check.mjs`, existing relevant fixtures and `docs/build-and-deploy.md`, `admin-auth-operations.md`. Prepare Tino ticket text from the reviewed ignored draft; no automatic message sending.

**Consumes:** Tasks1–7, measured Tino response, existing local test DB and fixed deploy workflow. **Produces:** actual receipts/screenshots and a tested release or a precise unmet gate, never inferred acceptance.

- [ ] Before production changes, obtain Tino's response: verified source mechanism, proxy chain and exact CIDRs; request evidence for normal requests and spoof header overwrite. Owner sends ticket or explicitly authorizes sending; user credentials/permissions are not silently expanded. No PHP/CDN alternative is introduced if support declines.
- [ ] Measure current hosting with a temporary authenticated/bounded diagnostic, no phpinfo/env/raw-IP logging/public diagnostic leak. Compare the normalized IP privately against the external network's known public egress from two networks. Send fake XFF/X-Real-IP/Forwarded/multi-hop/underscore variants; they cannot select a fake address. Include IPv6 when supported and record any IPv6 support limitation. Remove diagnostics and verify routing/version afterward.
- [ ] Only after measurement enable exact `TRUSTED_PROXY_CIDRS` and `CLIENT_IP_SOURCE_VERIFIED=true`; verify login, refresh, logout, throttling, DNT/GPC/opt-out and public collection. Record only safe acceptance receipts/synthetic examples in repo; real client IP telemetry stays private. If secure Passenger instead of XFF is supplied, test the approved source adapter before enabling it.
- [ ] Add a real DB/browser acceptance test: >90-day history visible through custom date filters, fixed same-cohort counts/charts, User only sees visitor page, Admin full menu, full synthetic IPv4/IPv6, no log switch/routes, compact detail incremental loads, new date-only controls and stale-request cancellation. Use an isolated database and labelled synthetic clients, no production analytics fixture flooding.
- [ ] Run `npm run check` using Node24 and isolated test DB; stop manually opened local dev server before the auth E2E portion to avoid port5173 collision. Expected all suites pass, only platform-specific skips documented. Run `npm run build`, expect archive/checksum and exit0. Inspect local compiled UI through CUA on desktop/mobile and save screenshots; don't use dev build as proof of production behavior.
- [ ] Run one final independent whole-change review before merge. Resolve important findings with regression tests and suite evidence. Commit all source/docs, push normally, merge origin/main without rewriting history, and wait for successful main CI. Read exact artifact source SHA/run/ID/checksum, not latest-main assumptions.
- [ ] Live preflight: native verified paired backup/restore to separate verifier, DB/file sizes and quota/headroom with room for migration, release extraction and growth; verify analytics retention cron/log importer disabled durably and receiver supports schema5. Baseline rollback source must remain available. If 128MiB backup bound/headroom is insufficient, stop and resolve with measured capacity; never prune history or skip backup to proceed.
- [ ] Deploy exact successful artifact via manual production workflow/reviewer gate. Source-IP gate is mandatory before calling the whole feature complete or releasing it as a verified full-IP solution. If Tino is pending, Tasks1–7 can be completed and previewed locally, and this step remains explicitly pending rather than inventing results.
- [ ] Verify live FE/BE/version/ready, public product images, actual non-loopback public IP and spoof rejection, all date-only presets/custom inclusive boundaries, charts/table totals, preserved historical rows, removed log API/UI and untouched auth/profile/slip printing. Verify old tab asset loading. Exercise compatible code rollback and forward only within owner-authorized production scope; retain all newly collected rows and disabled deletion cron. Record run IDs, receipts, observations, limits and rollback target.
- [ ] Update operations/admin/build docs, mark prototype superseded only when actual application UI is verified. Handover lists real test results/changed files/environment names and any unpassed Tino/IPv6/capacity checks; do not report completion while a required gate is unpassed. Commit `docs: record visitor analytics production acceptance` only with actual evidence.

## Dependency and Execution Order

Tasks1→2→3→4→5→6→7→8 are executed inline with commits and per-task RED/GREEN records. Task2 schema work and Task3 source seam do not require live hosting credentials; full-IP flags stay false locally unless using a synthetic trusted test proxy. Contacting/measuring Tino can proceed before other local tasks, but lack of hosting response does not justify stopping independent local work. Receiver bootstrap, live trust configuration and deployment wait for Task8's explicit gates.

## Self-Review Record

- Spec1–3: header/constraints, contracts and task boundaries.
- Spec4 IP/identity: Tasks2/3/8; raw-IP permission and no false legacy conversion included.
- Spec5 windows/cohort: Tasks1/4, shared filter key Task5; custom date-only/inclusive end and cross-midnight session fixture included.
- Spec6 retention/bounds: Tasks2/3/4/7/8; persisted history separate from cookie and bounded HTTP payloads.
- Spec7 UI: Tasks5/6; independent states, charts, product tail, responsive/keyboard and no session paging buttons.
- Spec8 retirement/rollback: Task7, plus live durable cron and paired restore in Task8.
- Spec9 verification/release: Task8; no production/full-IP claims before evidence.
- Interfaces checked: `VisitorScopeInput` → date window → service/report/session history → HTTP client/filter/query key; `visitorHistorySchemaStatus` → metadata/lifecycle/readiness/backup; cron policy operates independently of current release.
- Five Review Focus items each map to explicit tests in the owning tasks above. No extra dependency, service or new public tracking payload is planned.
