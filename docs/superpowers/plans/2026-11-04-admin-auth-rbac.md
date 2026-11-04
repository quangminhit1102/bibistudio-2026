# Admin authentication, RBAC and real visitor collection — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixture admin login/account permissions with verified Express/MySQL authentication and account APIs, collect real visitor/product interests efficiently, and support one cPanel production environment with verified rollback.

**Architecture:** Keep the synchronous Express factory and React/TanStack shell. Add focused SQL services and typed HTTP adapters; browser-local content/sales modules retain their storage behind server-derived UI permissions. Immutable artifacts include compatible additive migrations; trusted host deploy performs backup/restore-check/migration/readiness before activation and restores the previous compatible app on smoke failure.

**Tech Stack:** Node24, TypeScript/CommonJS Express, mysql2/promise, bcryptjs, jsonwebtoken, cookie-parser, Helmet, Zod, ipaddr.js, React/TanStack Query/Router, existing Vitest/node:test/Playwright and GitHub Actions. Pin versions/lockfiles after official compatibility checks in Task0. No ORM, Redis or third-party tracking SDK.

**Spec:** `docs/superpowers/specs/2026-11-04-admin-auth-rbac-design.md` — approved after owner confirmed real traffic collection.

## Global constraints

- One production on cPanel; no staging. Local/CI databases are isolated developer/test infrastructure, never production test targets.
- JWT15min; session idle7days from successful activity; absolute30days; strict rotation and family revocation on reuse. HttpOnly refresh cookie, Secure production, SameSite=Lax, Path=/api/auth; memory-only FE access token.
- Many roles/user, resource.action permission union, immutable master and protected built-in Admin full access including future resources. No fixture fallback or IndexedDB permission authority in HTTP mode.
- Owner passwords only in ignored/private environment configuration, never source/SQL/docs/logs. Independent disposable-test credentials. bcrypt cost12, password maximum72 UTF-8 bytes.
- Analytics: separate anonymous cookie; masked IP only; no external IP API; nullable verified location;90-day retention;30-minute inactivity sessions; unique session/product and session/page rows, no per-click event table.
- Dirty-only flush at most every15sec;16KiB/50path/50product batch; cap200pages/100products per session;10batches/min per visitor,120/min per network-prefix bucket and configurable global cap. Respect DNT/GPC/opt-out.
- Preserve npm run dev/check/build. Explicit setup/migrate/seed commands; no hidden startup schema mutation.
- Protected manual Run workflow, exact successful-main CI artifact, existing approval and SSH pinning remain. No automatic down migration/data restore on app rollback.
- Preserve Lovable history. Existing isolated worktree is codex/admin-dashboard; verify clean/isolation before execution, never force push or rewrite published commits.
- Docker CLI exists; daemon, hosting DB engine/grants/proxy/backup tools remain unverified. Browser control was disabled on last inspection. Do not replace required live verification with mocks/skips.

## Review focus

1. Delayed refresh/login must not resurrect identity after logout/account switch — Task6 epoch/multi-tab tests.
2. Partial MySQL DDL is not undone by ordinary transaction rollback — Tasks1/10 dirty-ledger/recovery tests.
3. Cookie-blocked or first-ever parallel visits must not create endless visitor rows — Tasks8/9 bootstrap bounds tests.
4. DTOs/logs must not leak passwords/tokens/raw IP/query PII or trust spoofed proxy headers — Tasks2–4/8 redaction/smuggling tests.
5. An already-open client and migrated DB must survive app rollback without restoring revoked access — Tasks10/12 stale-client/schema/data acceptance.

## File structure and order

Backend: focused config/http/db/auth/authorization/accounts/roles/visitors/audit modules under backend/src; SQL under backend/migrations. Use cookie-parser for cookie parsing and ipaddr.js for IPv4/IPv6 normalization, not ad-hoc parsers; keep these backend-only. Keep handlers thin, SQL parameterized, repositories distinct from services. No generic ORM framework.

Frontend: memory HTTP client; HTTP auth/account/role/visitor adapters inside current features; focused multi-role account form, lightweight tracker/privacy control. Reuse existing DataTable/Modal/Button/error/draft primitives. Preserve unrelated business/content behavior.

Wire DTOs live in backend/src/http/contracts.ts (types only, no Node/runtime imports), imported type-only by FE. Backend tests import compiled modules as backend/test/api.test.mjs does. Test helpers own DB/server lifecycles and cannot read production configuration. Before every backend test re-run after edits, compile with `npm --prefix backend run build`; then execute the listed node --test command. Run backend types with `npm --prefix backend run check`. Record RED and GREEN against the actual compiled code.

Tasks0–5 backend;6–7 identity/UI;8–9 analytics;10–11 deploy/tooling;12 acceptance. This is one integrated release; do not expose a partially authenticated production admin.

---

### Task0: Confirm engine/tooling and execution boundary

**Files:** read docs/build-and-deploy.md, approved spec, backend/build/test conventions and ops/deploy-config.example.json; create ignored .superpowers/auth-preflight.json; update deployment guide with measured prerequisites.
**Interfaces:** non-secret preflight record contains Node/npm path/version, DB engine/version, Docker daemon availability, DB/backup/restore capabilities, proxy topology and current release. No credential values.

- [ ] Verify Git/worktree isolation and baseline; read spec/guide and actual live API/version.
- [ ] Check Docker server availability, official dependency Node24/CommonJS compatibility and compatible DB engine image. Record pinned versions for implementation, not guesses.
- [ ] Inspect cPanel DB/grants/backup tools via authorized session, without printing secrets or creating credentials. If browser disabled request connection; continue local-independent work, never claim hosting verified. Do not open remote MySQL or widen forced SSH to a shell/tunnel.
- [ ] Record dedicated DB/runtime-DML versus migration/backup needs. Provisioning is a later concrete hosting action; no production migration now.
- [ ] Commit factual documentation only if changed: `docs: record auth database preflight`.

### Task1: Schema, resumable migrations, seed and DB test harness

**Files:** create backend/src/config.ts, db/pool.ts, db/transaction.ts, db/migrate.ts, db/seed.ts, db/cli.ts, http/contracts.ts,auth/password.ts; backend/migrations/001_identity.sql,002_sessions_audit.sql,003_visitors.sql,004_throttles_probe.sql; backend/test/helpers/database.mjs,http.mjs and migrations.test.mjs; scripts/test-database.mjs,local-database.mjs. Modify backend package/lock, root scripts, .env.example.
**Interfaces:** createDbPool(config:DbConfig):Pool; withTransaction<T>(pool,work:(connection:PoolConnection)=>Promise<T>):Promise<T>; migrate(pool,directory):Promise<MigrationStatus>; seedIdentity(pool,secrets:SeedSecrets):Promise<void>; CLI migrate/seed/status. Clock has now():Date. TestClock adds set(Date)/advance(ms). createDatabaseFixture(t) returns {pool,config,clock,close}, allocating its own guarded bibi_test_* schema and independent secrets.

contracts.ts defines Page<T> {items,total,page,pageSize}, PrincipalDto {id,username,displayName,email,roleIds,roles,permissions,fullAccess,isMaster,revision}, AccountDto (safe account fields), RoleDto, PermissionDto, AuditDto, VisitorDto, VisitorSessionDto, VisitorReportDto and CollectBatch according to spec. All wire dates are ISO strings, IDs strings. AuthPrincipal combines principal, sid and authVersion for internal services; never serialize internal hashes/cookies.

- [ ] Write failing real-DB tests: empty migration builds spec tables/indexes/FKs;2roles/user; repeat migration no-op; checksum mismatch and unknown dirty DDL abort; known partial step verified before completion. Target guard rejects production hosts/names and cleanup cannot drop non-owned schema.
- [ ] Run `node --test backend/test/migrations.test.mjs` with disposable engine; observe missing-module/schema failures, not connection failure mistaken for regression evidence.
- [ ] Implement bounded UTC pool, parameterized DML transactions and advisory-locked/checksummed narrow DDL steps. Include spent-token history, unique visitor page/product associations, throttle/probe tables. Never pretend multiple DDL statements are one rollbackable transaction.
- [ ] Implement the small hashPassword/verifyPassword helper in auth/password.ts with bcrypt12 and72-byte UTF-8 guard; test hash-only seed storage and unchanged hash on re-seed. Implement explicit idempotent bootstrap; unique master username/seed lock, no resets of existing password/status/roles. Never seed fake production visitors. Add db:migrate/db:seed/db:status/db:setup:local scripts; local setup targets only isolated local DB. Runtime DML credentials differ from migration/backup credentials.
- [ ] Verify tests/backend types and owned cleanup. Local development volume may persist; test schemas are disposable. No secret logs.
- [ ] Commit `feat(api): add MySQL migrations and explicit identity bootstrap`.

### Task2: HTTP security, safe errors, audit and throttling

**Files:** create backend/src/http/errors.ts,validation.ts,security.ts,express.d.ts; audit/repository.ts; auth/throttle.ts; modify app.ts. Test backend/test/http-security.test.mjs.
**Interfaces:** createApp(release:ReleaseInfo,options?:AppOptions):Express remains synchronous; options inject config/db/clock. ApiError(status,code,message,details?); writeAudit(conn,event:AuditInput):Promise<void>; consumeRateLimit(pool,key,policy,now):Promise<RateDecision>; requireBrowserOrigin(config):RequestHandler.

- [ ] Write failing tests preserving existing health/version/demo, safe envelopes/request IDs, origin/custom-header/CORS guards, JSON/payload bounds, missing Origin on cookie mutations, spoofed IP headers, cross-worker throttle persistence and safe logger/error serialization.
- [ ] Run `node --test backend/test/http-security.test.mjs`, observe behavioral failures before middleware edits.
- [ ] Add Helmet, validation, measured trust-proxy config, safe400/401/403/404/409/429/503 and DB TTL counters. /api/ready checks private config/DB/schema/bootstrap; absent config never enables fixture auth. Public health/version contract remains compatible.
- [ ] Audit writes share caller transactions; metadata allowlist excludes passwords/tokens/cookies/SQL creds/full query URLs. No stack leakage.
- [ ] Run new and existing backend/test/api.test.mjs tests; commit `feat(api): add guarded HTTP errors audit and persistent throttling`.

### Task3: Password login and rotating refresh families

**Files:** create backend/src/auth/tokens.ts,repository.ts,service.ts,routes.ts; extend auth/password.ts from Task1; modify app/config/contracts. Tests backend/test/auth.test.mjs,refresh-concurrency.test.mjs.
**Interfaces:** createAuthService({pool,clock,config}):AuthService with login(credentials,meta):Promise<AuthGrant>, refresh(rawCookie,meta):Promise<AuthGrant>, logout(rawCookie,meta):Promise<void>, revoke(actor:AuthPrincipal,command):Promise<void>. AuthGrant internal includes replacement cookie; public grant is accessToken/expiresAt/profile. signAccess({sub,sid,authVersion},clock):string; verifyAccess(token,clock):AccessClaims; hashRefresh(raw):string. Auth repository checkAndTouchSession(conn,claims,now):Promise<SessionState> rejects idle/absolute expiry/auth_version mismatch and extends idle expiry only to the absolute cap; Task4 middleware consumes it.

- [ ] Test both seeded logins, generic missing/wrong/inactive/deleted failure, dummy comparison,72-byte limit, JWT900sec/algorithm/issuer/audience, cookie attrs and hash-only DB. Logger receives no credential values.
- [ ] Test real concurrent refresh: consumed-token reuse commits family revoke before401, no two usable descendants, unknown token cannot revoke another family, no grant/cookie sent before commit.
- [ ] Test injectable time at7-day idle/30-day absolute bounds, activity extension capped, no expired-session revival, idempotent logout and own/all-own revoke. Other-user revoke is denied until Task4 installs scoped authority; master session management protections still apply.
- [ ] Observe failures, implement user→session→token locks, random256-bit refresh, SHA256 history, bcrypt12, pinned JWT and audited revocation. Do not roll back reuse revocation by throwing inside transaction.
- [ ] Run both test files/types; commit `feat(auth): implement password login and replay-safe sessions`.

### Task4: Server permissions and protected account CRUD

**Files:** create backend/src/authorization/permissions.ts,middleware.ts; accounts/repository.ts,service.ts,routes.ts; modify auth profile/revoke routes/contracts. Tests backend/test/authorization.test.mjs,accounts.test.mjs,master-protection.test.mjs.
**Interfaces:** authenticate(deps):RequestHandler supplies req.auth:AuthPrincipal; requirePermission(code:string):RequestHandler; resolvePrincipal(conn,userId,sid):Promise<PrincipalDto>. AccountService list(query):Promise<Page<AccountDto>>,get(id),create(input,actor),update(id,input,revision,actor),setActive(id,active,revision,actor),setRoles(id,roleIds,revision,actor),remove(id,revision,actor). Other-user revoke uses account.revoke_session, rejects a master target.

- [ ] Test missing/expired token401, User management API403, multi-role union, Admin future-resource access, live DB overriding stale token/local claims, pagination/search bounds and projection/redaction.
- [ ] Test every master mutation with full-access actors, including self/password/status/role smuggling:403/400 and unchanged rows/hashes/mappings. Ordinary account CRUD/actions succeed; stale revision409; normalized username uniqueness; no invented required seed email.
- [ ] Prove deactivate/delete/password/role changes revoke sessions and old JWT immediately. Race refresh with disable and ensure no usable descendant. DB outage503, never permission fallback.
- [ ] Implement narrow update allowlists and dedicated status/role actions. Account creation with roleIds requires assign_role; own role assignment denied; soft delete, deterministic locks and atomic audit. No exposed secret fields.
- [ ] Run three test files; commit `feat(accounts): enforce server RBAC and protected master CRUD`.

### Task5: Roles, permission matrix and audit reads

**Files:** create backend/src/roles/repository.ts,service.ts,routes.ts; audit/routes.ts. Tests backend/test/roles.test.mjs,audit.test.mjs.
**Interfaces:** RoleService list/create/update/remove/setPermissions, all mutations actor/revision; listPermissions():Promise<PermissionDto[]>; listAssignableRoles(actor):Promise<RoleOptionDto[]>; listAudit(query,actor):Promise<Page<AuditDto>>. Add RoleOptionDto to contracts. fullAccess/system flags remain server-owned.

- [ ] Test every endpoint permission, unknown/duplicate IDs, in-use role deletion409, built-in Admin mutation403, grant ceilings and self escalation through role permission changes.
- [ ] Test atomic session revocation for all users affected by permission changes, multi-role users included. Audit login/failure/reuse/revoke/account/role/permission changes; safe paginated projection. Static option/report routes are registered before /:id; test that filter-options and report are not interpreted as record IDs.
- [ ] Observe failures, implement services with matching lock order and no arbitrary resource codes accepted from clients. Seed registers current codes; fullAccess covers future codes without schema changes.
- [ ] Run tests; commit `feat(rbac): add role permission and audit APIs`.

### Task6: Memory-only HTTP auth and multi-tab refresh

**Files:** create src/lib/admin-http.ts; accounts/auth/http-service.ts,refresh-lock.ts. Modify accounts/auth/contracts.ts, services/context.tsx,services/contracts.ts,accounts/permissions.ts. Tests tests/admin/http-auth.test.ts,refresh-singleflight.test.ts,auth-epoch.test.ts and tests/e2e/auth-tabs.spec.ts.
**Interfaces:** createAdminHttp({fetch,origin,onUnauthorized,clock,refreshLock}):AdminHttpClient exposing request<T>(path,options):Promise<T>,login(credentials),restore():Promise<PrincipalDto|null>,logout(),dispose(). Token is closure state only. Session is discriminated HTTP principal or explicitly injected fixture; HTTP never uses legacy roleId authority. canCode(session,code):boolean handles fullAccess.

- [ ] Test credentials:include/Bearer, boot refresh→profile, no token in storage/URL/JS cookie,20 concurrent401s→one refresh/one retry each,403 not refreshing, late401 using current token and auth endpoint exclusion.
- [ ] Test failed refresh/internal returnTo, logout-vs-refresh/login races, cancellation and stale results after user switch. Two-tab test queues cookie fetch only after Web Lock acquisition; no broadcast/persistence of tokens.
- [ ] Observe failures; implement single-flight/epoch guards and logout synchronization. Fix fallback explicitly: without Web Locks, no automatic refresh; require fresh login on boot/expiry with a clear message instead of unsafe rotation or stored tokens. Test that fallback.
- [ ] Provider defaults to HTTP; fixture adapter only injected tests. Update route/action permission context and local-service guards to server identity without querying local role authority. Old tests inject fixtures intentionally; no production fallback.
- [ ] Run targeted Vitest/browser tests; commit `feat(admin): connect memory-only sessions and serialized refresh`.

### Task7: Accounts/roles UI and visitor-only navigation

**Files:** create src/features/admin/accounts/http-api.ts,account-form.tsx; modify accounts/pages/users.tsx,user-detail.tsx,roles.tsx,permissions.tsx; accounts/config.tsx,profile-form.tsx; shell/admin-layout.tsx,account-menu.tsx,navigation.ts,search-service.ts; services/context.tsx; dashboard/service.ts; audit/pages/audit-logs.tsx. Tests tests/admin/server-account-ui.test.tsx and tests/e2e/account-management.spec.ts.
**Interfaces:** createAccountApi(http) implements Task4–5 wire methods; useAccount/useAccounts/useServerRoles/usePermissions query by principal ID/epoch, never one roleId. AccountForm({initial,onSave,readOnly}) supports roleIds multi-select and dedicated actions. Use common DataTable/form primitives and safe server DTOs, not a lossy legacy single-role projection.

- [ ] Test User01 only sees Khách truy cập and logout, lands there from root/login, cannot open dashboard/accounts or hidden search/notification/profile shortcuts. Admin sees all registered menus; server profile renders without local users/roles seeding.
- [ ] Test create/update/conflict/status/delete/multi-role UI, variable permission action rows, draft preservation on error, master all edit/avatar/status/role controls read-only, keyboard/mobile navigation and logout after revoked permissions.
- [ ] Implement focused HTTP-backed forms; dedicated endpoints for role/status/password changes. Leave content/sales local data untouched. Remove local profile writes in HTTP mode. This project adds no backend avatar upload: display server initials/profile and disable unsupported local-avatar mutation rather than pretend to save it; master profile remains read-only.
- [ ] Move account search/counts/audit to APIs. Keep local sales/product metrics distinct and do not join backend user IDs to fixture users. Remove fixture users/roles/audit as active authority in HTTP paths.
- [ ] Run new tests and sidebar/editor/sales/cache regressions; commit `feat(admin): integrate server accounts and permission-aware navigation`.

### Task8: Bounded visitor ingestion and retention

**Files:** create backend/src/visitors/catalogue.ts,normalize.ts,repository.ts,collector.ts,service.ts,routes.ts,cleanup.ts; scripts/analytics-catalogue.mjs. Modify app/build preparation. Tests backend/test/visitor-ingest.test.mjs,visitor-concurrency.test.mjs,visitor-retention.test.mjs and scripts/analytics-catalogue.test.mjs.
**Interfaces:** collectVisitor(pool,input:CollectBatch,context:CollectorContext):Promise<CollectResult> returns202 bootstrap/no DB write or204 acknowledged; clearAnalyticsCookie clears caller cookie only; cleanupAnalytics(pool,now,batchLimit):Promise<CleanupCounts>. Context contains verified IP/UA/origin/server clock and optional server-verified probe marker. Generated public route/product manifest contains slugs/labels, no admin/price/cart data. VisitorService list/get/sessions/report/filterOptions returns Task1 visitor DTOs and safe filter metadata. Explicit read routes: GET /api/customer-access, /filter-options, /report, /:id, /:id/sessions; register static routes first.

- [ ] Test bootstrap creates0 rows until valid cookie-bearing collect; blocked cookies stop after2 attempts.100 repeated product views yield1 visitor/active session/product association. Same-cookie concurrent tabs, retries and out-of-order batches do not inflate distinct counters or reduce server timestamps;30min idle creates exactly one new session under lock.
- [ ] Test canonical route/query stripping, product-type listings excluded, invalid input/body/rate limits,200page/100product caps and truncation, no raw IP/UA/query/form/auth tokens persisted/logged, proxy spoof rejection, null location and saturated collector503.
- [ ] Test90-day bounded cleanup/FK order without touching auth/audit; analytics/auth cookie isolation; server DNT hints; signed probe expiry and unsigned is_test rejection. Public response cannot reveal history/account/session IDs.
- [ ] Observe failures; implement dedicated small collector pool (2connections within actual hosting quota), visitor-row locking, unique associations and counts from inserted rows only. Mask IPv4/24 or IPv6/48 before persistence, bounded UA parse, no external GeoIP requests. Last route means last received, no per-click timeline. Add explicit cleanup CLI/cron instructions.
- [ ] Run new tests/catalogue validation; commit `feat(analytics): collect deduplicated sessions and product interests`.

### Task9: Lightweight tracker, privacy control and MySQL visitor UI

**Files:** create src/lib/visitor-tracker.ts, src/components/visitor-tracking.tsx,analytics-privacy-control.tsx; src/features/admin/analytics/http-api.ts. Modify src/routes/__root.tsx,src/components/site-footer.tsx; analytics/pages/visitors.tsx,visitor-detail.tsx; analytics/components/visitor-dialog.tsx,visitor-service.ts,hooks.ts; dashboard/service.ts. Tests tests/admin/visitor-http.test.ts,tracker-batching.test.ts and tests/e2e/visitor-collection.spec.ts. Retain existing public bundle report/budgets.
**Interfaces:** createVisitorTracker({send,clock,privacy,bootstrapLock}):VisitorTracker has visit(publicPath),flush(reason),setEnabled(boolean),dispose(). VisitorApi implements list/get/sessions/report/filterOptions using /api/customer-access; React wrapper observes committed public routes only.

- [ ] Test dirty-only15sec cap, rapid route dedup,50entry/16KiB chunking and bounded pending memory, one pagehide keepalive, at most2 transient retries, no infinite429 retry,202 retaining data until204, blocked cookie bounds and StrictMode/SSR listener cleanup.
- [ ] Test DNT/GPC/opt-out sends nothing and creates no cookie, enabling resumes, disabling cancels queues/clears only analytics cookie/synchronizes tabs. Exclude admin/API/auth/error/form/search/query/hash data. Test Web Lock bootstrap and documented approximate fallback.
- [ ] Observe failures; implement without admin/chart/editor imports in public graph. Tracking errors do not block navigation. Footer control states masked IP,90days, estimated location and opt-out behavior. No third-party SDK/network geolocation.
- [ ] Move visitor list/detail/report/filter options to backend. Remove mock description/production rows; label unique pages and last-received route accurately, null location/truncation/empty states. User stays read-only; dashboard reads same visitor aggregates.
- [ ] Run tracker/visitor tests, real browser public visit→admin interest walkthrough and desktop/mobile overflow check; run public bundle baseline check. Commit `feat(analytics): connect public collection and live visitor UI`.

### Task10: Migration artifacts and host deploy/rollback hooks

**Files:** modify scripts/build.mjs,release-manifest.mjs,deploy-client.mjs,smoke.mjs,browser-smoke.mjs; ops/deploy.cjs,receiver.cjs,release.cjs,deploy-config.example.json; ops/passenger/app.cjs. Create ops/database-lifecycle.cjs,backend/src/db/backup-cli.ts,probe-cli.ts. Tests scripts/auth-release.test.mjs,auth-deploy.test.mjs,auth-rollback.test.mjs and existing deploy/manifest suite.
**Interfaces:** manifest.database {requiredMin,compatibleMax,migrationChecksums}; checkDatabaseCompatibility(release,schema):void; prepareDatabase(config,release):Promise<BackupReceipt> exposes hash/state only; verifyReleaseProbe(config,release):Promise<ProbeReceipt>. Host spawns fixed release CLI using runtime node, not arbitrary shell/SQL. Existing scoped SSH grammar remains.

- [ ] Test missing/tampered migration assets, schema-range refusal, excluded env/secrets, owned backup path/0600, consistent dump and actual isolated restore, partial DDL failing before activation and interrupted migration never marked complete.
- [ ] Test post-activation DB/auth probe failure restores compatible app and preserves accounts/audit/revocations created since backup. Incompatible manual rollback refused. First rollback to pre-auth public site has absent auth endpoints and explicit degraded-admin receipt; no claim auth remains functional.
- [ ] Build packages SQL/checksums and generated catalogue manifest. Parse old public manifests backward-compatibly as explicitly pre-auth/no DB. Stable Passenger loads private env outside releases/webroot without breaking synchronous createApp; close pools on supported shutdown paths.
- [ ] Host deploy adds backup→restore-check→locked migration/seed/readiness before pointer switch. Separate host-only migration/backup credentials, passwords passed in private config/env, never args/logs. No resets of existing seeded accounts. Stop on failed backup/restore or unknown dirty schema.
- [ ] Add release-signed tagged analytics probe, excluded from real visitor lists/counts and expiring24hours. Host-side DB verifier outputs assertions/counts for this marker only; no HTTP probe-result endpoint. Narrow probe account checks login/profile and expected management403, never fullAccess. Ordinary browser smoke sends DNT. Do not mutate real master/user01 for testing.
- [ ] Run lifecycle tests and deploy suite with actual restore; commit `feat(deploy): add verified DB migration and compatible app rollback`.

### Task11: Local/CI commands and operational documentation

**Files:** modify root/backend package scripts; scripts/check.mjs,dev.mjs,preview.mjs,install-backend.mjs; .github/workflows/ci.yml,production.yml,rollback.yml; .env.example; docs/admin.md,build-and-deploy.md. Create docs/admin-auth-api.md,admin-auth-operations.md; tests/e2e/auth.config.ts;scripts/auth-ui-check.mjs. Test scripts/auth-tooling.test.mjs.
**Interfaces:** npm run dev starts FE/BE using configured isolated local DB; may start an initialized local container but never silently migrate. npm run check owns disposable test DB unless a guarded CI DB service is supplied and runs mandatory real integration/UI tests. Build never connects to or mutates production DB. db:setup:local is explicit one-time setup; migrate/seed/status remain deliberate.

- [ ] Test no production credentials/targets consumed by dev/test harness; cleanup only owned schema/container; shutdown frees ports/DB handles; missing DB gives actionable failure; check cannot silently skip required integration/UI tests; build has no live DB/seed side effects.
- [ ] Integrate backend and auth-tabs/accounts/visitor browser tests into check with isolated fixtures/ports. CI pins measured compatible DB image/service health and browser install, tests DML-only runtime. Set timeout from measured workload, not blindly preserve old20min.
- [ ] Load private env consistently for dev, compiled preview and Passenger. Template contains names only; no credentials in VITE_* or bundle. Local setup can persist developer DB volume while tests own throwaway schemas. Bootstrap secrets supplied once via ignored env, not hardcoded source.
- [ ] Document schema diagram, endpoints/errors, setup/env, multi-role semantics, strict lost-refresh response behavior, Web Locks fallback, analytics approximations/privacy/retention, direct npm correction, backup/restore, exact rollback/degraded baseline behavior. Other modules remain local explicitly.
- [ ] Run tooling tests/full check/build; commit `docs(tooling): document and verify auth development and production operations`.

### Task12: Final review and actual acceptance

**Files:** create docs/superpowers/reports/2026-11-04-admin-auth-acceptance.md; actual screenshots under C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/ using bibi-auth-admin.png, bibi-auth-user-mobile.png, bibi-auth-accounts.png and bibi-auth-visitor-interest.png. No mockup screenshot presented as actual implementation.
**Interfaces:** receipt records exact SHA/schema/checksums, CI artifact digest, tests/failures/skips, backup/restore proof and current/previous release IDs. Acceptance remains conditional until all required checks complete.

- [ ] Run full migrations/seed/check/build with Node24 and real isolated DB. Re-seed preserves edits. Verify all12 owner cases plus Review Focus. Capture actual desktop/mobile Admin, visitor-only User, account CRUD/master read-only and collected product-interest UI. No screenshots of tokens/password/private config.
- [ ] Request whole-change code/security review against approved spec and a fixed diff range via applicable review skill. Resolve material findings, re-run affected checks. No push/deploy until required tests/review pass; no rewriting published history.
- [ ] Preflight actual cPanel DB/grants/proxy/runtime/backup/restore. Prepare concrete dedicated DB/host tool/config changes before activation; request action-time approval if provisioning expands security-sensitive access. Runtime must not use unrestricted hosting DB credentials. Disabled browser/absent MySQL is a live acceptance blocker, never invented success.
- [ ] With implementation accepted and production activation authorized, bootstrap reviewed fixed tools/config, merge/push normally, wait for exact successful main CI artifact and run protected workflow. Verify DB/auth/RBAC/tagged probe, public product images/API-test FE-BE version, same-origin TinyMCE assets and already-open client. Preserve unrelated vhplastic.com/apps.
- [ ] Under production authorization perform compatible app rollback/re-release, verify public availability, auth or explicit pre-auth degraded state and no DB/audit/revocation reversal. Record exact backup hash/current/previous IDs; never restore a production snapshot just as a drill.
- [ ] Write honest acceptance/limitations, update guide/plan and commit docs. Never report complete while build/test/migration/browser/live acceptance fails or is blocked. Deliver changed-file/test/env summary and verified URL.

## Coverage and self-review

- Owner cases1–2→Task3;3–5/11→Tasks3/6;6–7→Tasks3/4;8→Tasks6/7/9;9→Tasks4/5/7;10→Tasks4/7;12→Task6 real concurrency tests.
- Transactions/audit/master→Tasks1–5; stale identity/multiple tabs→Tasks6–7; real collection/privacy/volume/retention→Tasks8–9; backup/migration/rollback and truthful acceptance→Tasks10–12.
- Review Focus1→Task6,2→Tasks1/10,3→Tasks8/9,4→Tasks2–4/8,5→Tasks10/12.
- All referenced DTOs are defined in Task1; internal auth identity carries principal/sid/authVersion, frontend authority reads principal permissions/fullAccess. SQL/HTTP/FE interfaces stay explicit; no fake single-role HTTP projection.
- Builder decisions fixed: conservative re-login when Web Locks absent; focused multi-role forms; host-only probe-result verifier; explicit local DB setup; compatible app rollback without data reversal. Hosting values/versions are measured in Task0 before installation.
- No remaining owner scope questions. Product code/migrations not started. Native inline or subagent-driven execution follows these same gates; choose/review execution before implementation.


Self-review completed before handoff: every approved spec section maps to Tasks0–12 and owner cases1–12 above. Corrected seed/password helper ordering, required compilation before backend test reruns, explicit static visitor routes, and cookie/IP parsers. The plan changes no implementation or production state.
