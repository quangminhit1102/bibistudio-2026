# Admin authentication, RBAC and account management — design

Date: 2026-11-04
Status: Reviewed design updated with owner-confirmed real visitor collection; awaiting approval before implementation.

## Intent and approved direction

Replace the local admin identity with Express authentication backed by the production MySQL-compatible database on cPanel. Preserve the React/TanStack UI and existing service boundaries. Provide real account/role/permission management, secure rotating sessions, server authorization and real visitor collection with MySQL-backed visitor reads. One production environment only; no staging application. Disposable databases for automated testing are test infrastructure, never the production database.

The owner supplied the full API/security/test requirements, chose cPanel MySQL, and accepted the recommended mysql2 + SQL migration direction with application rollback and non-destructive database migrations, and explicitly confirmed real visitor collection. This design records additional implementation calls explicitly below; they are proposals until approved.

## Current source and integration constraints

- `backend/src/app.ts` is a synchronous Express factory, currently serving health/version/demo only. Node24, TypeScript compiled to CommonJS. `ops/passenger/app.cjs` loads that factory from the selected immutable release.
- `src/features/admin/accounts/auth/contracts.ts` has login/getSession/logout, and `AdminProvider.authFactory` is the intended seam. Current local adapter hardcodes a fixture and persists one roleId in localStorage.
- `accounts/permissions.ts`, runtime query keys, users forms and generic services currently assume one role and permissions in IndexedDB. Merely hiding menu entries is insufficient; these assumptions must change together.
- Users/roles/permissions/visitor pages already exist. Visitor list, details and aggregates currently read local visitor/session records. Other business/content modules remain browser-local in this project.
- Existing release workflow trusts an exact successful main-CI artifact, gates production, retains prior assets and automatically restores the previous release on smoke failure. SSH accepts only check/upload/deploy/rollback. No database migration/backup hook exists yet.
- Production app code `9eb48b8c4b51bec51bb9a20088e2179b04cbe2e1` was deployed by run41666027459. The host's CloudLinux npm wrapper redirected ci to virtualenv/lib. A tested host-only config change points npmBin to `/opt/alt/alt-nodejs24/root/usr/bin/npm`; preserve this and document it in the deployment guide.
- Hosting MySQL/MariaDB version, database names/grants, connection/backup tools and available local test engine are NOT verified yet. Browser access was disabled in Work settings on the last attempt. Do not claim compatibility or migration acceptance before real preflight.

## Approaches

1. **Selected: mysql2/promise pool + parameterized SQL + versioned SQL migrations.** No ORM; explicit transactions/locks, small dependency footprint, fits current plain Express services. Requires deliberate mapping of DB rows to public DTOs and migration bookkeeping.
2. Drizzle + mysql2. Adds schema/query typing and migration tooling, but more dependencies and conventions in a backend that has no existing ORM. Not selected.

Keep application code in focused backend modules (db, auth, authorization, accounts, roles, visitors, audit) behind repositories and services. HTTP handlers validate/map requests and call services. Do not build a generic ORM or rewrite unrelated admin pages.

## Scope and non-goals

In scope: listed auth/account/role/permission endpoints, many-role identity, protected master, DB audit, public bounded visitor collection plus protected read-only visitor APIs, UI adapters/guards, migrations/seeds, tests, documentation and production-ready deploy/rollback changes.

Confirmed visitor scope: collect real public-site visits, sessions and distinct viewed products into MySQL. Seed sample visitor data ONLY in disposable tests; never present synthetic production visitors as customers. Preserve the owner's earlier requirement to avoid one insert per repeated click. Location is inferred only from a verified local/trusted server source; missing location displays “Chưa xác định”. The masking/retention and metrics definitions below are proposed implementation calls for approval.

Not in scope: moving products/posts/sales/media to MySQL; publishing browser-local posts; payment processing; redesigning the admin; email/password recovery; MFA; third-party login. Protect all newly added server endpoints; existing browser-local modules do not become server-backed by adding login.

## Database and invariants

Use InnoDB, foreign keys, utf8mb4 and UTC timestamps. Actual migration syntax targets the confirmed hosting engine/version. Prefer broadly compatible types; do not rely on MySQL-only JSON/check/index features before preflight. Physical table names use consistent lowercase snake_case to avoid Windows/Linux case differences; logical names map to the requested entities.

| Logical table | Main fields and invariants |
| --- | --- |
| Users | id, normalized unique username, display_name, optional email, password_hash, active, is_master, auth_version, revision, deleted_at, created/updated timestamps. Soft delete prevents login and preserves audit identity. Master marker created only by trusted bootstrap. |
| Roles | id, unique immutable key, name, description, system/full-access flags, revision. Built-in Admin key and full-access semantics cannot be edited/deleted through APIs. |
| Permissions | id, unique resource.action code, display_name, description. Registered by versioned migration/seed; GET API exposes them. No arbitrary permission string insertion by clients. |
| UserRoles | composite primary key user_id/role_id, foreign keys, assigned_by/at. A user may have multiple roles. |
| RolePermissions | composite primary key role_id/permission_id, foreign keys. Effective permissions are the union across current roles. |
| RefreshTokenSessions | id, user_id, auth_version, created_at, last_activity_at, idle_expires_at, absolute_expires_at, revoked_at/reason. One row per login session/family; not analytics VisitorSession. |
| RefreshTokens | id, session_id, unique token_hash, issued_at, consumed_at, replaced_by. Retain spent hashes until the session is past expiry so old-token reuse is detectable. Never store plaintext tokens. |
| AuditLogs | id, actor_id nullable, target type/id, action, outcome, request_id, timestamp, minimal allowlisted metadata. No passwords, tokens, cookies, SQL credentials or raw Authorization headers. |
| Visitors, VisitorSessions, VisitorViewedProducts | existing UI-compatible fields, indexed visitor/time filters, bounded session metadata. Unique session_id/product_slug prevents per-click product-interest rows. VisitorSessionPages stores unique canonical session/path pairs, not a chronological click/event log. Visitor sessions are distinct from login sessions. |
| SchemaMigrations | version, checksum, completed timestamp, explicit dirty/in-progress state for interrupted DDL recovery. |

Index normalized username, active/deleted status, role mappings, token hash/session, session user/revocation/expiry, audit time/actor and visitor last_seen/session visitor+time. Limit list page size to100; whitelist sort/filter columns; all values use SQL parameters. Do not perform full-table loads to paginate.

### Seeds and protected identity

- Usernames: master `admin`, initial ordinary account `user01`. Passwords come ONLY from `MASTER_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`; no values committed, logged, baked into FE, or written in docs/tests. Test passwords are independently generated fixtures.
- bcrypt via bcryptjs, cost12 by default with bounded configuration; reject passwords exceeding72 UTF-8 bytes instead of truncating. Generic login failure performs a dummy comparison for missing/inactive/deleted users. Bound login input length before hashing.
- Bootstrap is explicit and idempotent: create absent built-ins/accounts; never reset existing passwords, reactivate users, replace role assignments or overwrite admin-edited role permissions on every deploy. Missing initial secret fails bootstrap; application startup does not seed silently.
- Exactly one master designated by trusted bootstrap metadata/transaction. The master has unconditional full access to existing/future registered resources. Built-in Admin role also represents full access; it is not a static list of today's menu permissions.
- Every account mutation path (including generic update, role assignment, delete, activate/deactivate, password/profile/avatar change and any future bulk path) rejects a master target before writing. No is_master/system flags accepted from API input. Logout and security session revocation for the master's own session remain available.
- Initial User role contains only `customer_access.view`; user01 lands directly at `/admin/analytics/visitors`. Built-in role keys cannot be renamed. Assigned roles cannot be deleted. Admin can manage User/custom-role permissions deliberately; initial least privilege must be covered by tests.

## Authorization

JWT is identity, not authority: every protected request verifies signature/algorithm/issuer/audience/expiry, then checks the active user, nondeleted status, live unrevoked/unexpired session and auth_version against MySQL, and resolves current roles/permissions. No local role-name fallback for HTTP mode and no authority from IndexedDB. Database failure denies access with503; it never grants permissions or enables fixture login.

Permission namespace: `customer_access.view`; `account.view/create/update/delete/activate/deactivate/assign_role/revoke_session`; `role.view/create/update/delete/assign_permission`; `permission.view`; `audit.view`, plus resource.action codes mapped explicitly to existing admin modules. Special actions such as activate/deactivate/assign_role remain distinct permissions; UI permission matrix must support variable actions rather than fixed six-column assumptions.

Master/Admin full access is evaluated by trusted server flags, including future permissions. Other actors need every required permission. Grant ceilings: non-full-access role managers cannot grant privileges/roles they do not themselves hold, assign full-access/system roles or modify a full-access role. Account creation with roleIds also requires assign_role. Clients cannot assign their own roles or edit their own role's permissions through any alternate update payload; narrow field allowlists prevent privilege escalation. Normal self profile edits do not permit role/status/password bypasses.

Role membership/permission changes lock affected users in deterministic order, commit the mapping plus audit, increment auth_version and revoke affected sessions atomically. Account deactivate/delete/password change likewise revoke sessions; middleware rejects previously issued access JWTs immediately. Role deletion in use returns409 instead of silently stripping access. Transaction ordering for refresh/account/role changes consistently locks user before session/token rows; deadlock retry is bounded and never repeats external side effects.

## Authentication and session behavior

- Access JWT15min: sub, sid, auth_version, iss, aud, iat, exp, jti. Use a pinned verification algorithm and strong env secret. Never include password hash or trust client role claims. Return access token in JSON, memory only in FE.
- Refresh token: CSPRNG256-bit opaque value; store SHA-256 hash only. HttpOnly host-only cookie, Secure production, SameSite=Lax, Path=/api/auth, no Domain attribute. Clear with identical attributes. FE and API use canonical https://bibistudio.vn; www admin redirects to canonical to avoid split cookies. Local dev uses same-origin Vite `/api` proxy; Secure=false only for explicit development loopback.
- Enforce trusted Origin on login/refresh/logout cookie endpoints. Reject unexpected/missing origins for browser-facing cookie mutations; API tests send the configured Origin. JSON-only bodies and same-origin custom CSRF header add a simple request barrier. Authorization-only endpoints do not rely on CORS as auth. No wildcard credentialed CORS; production needs only same-origin, local origin is separately configured.
- Login validates credentials generically, creates session+first token hash+audit in one transaction, sends cookie/token after commit. last_login may update ordinary/master account activity metadata through the auth service; the master protection forbids management edits, not required security bookkeeping.
- Refresh locks user then session/token, verifies active status/auth_version and both expiry bounds. Unconsumed valid token: mark spent, create replacement hash, update session idle expiry, audit as necessary, commit, then issue cookie/access JWT. Never send a replacement before commit.
- Reused spent token: revoke the whole family and audit **then commit**, return401 afterward; do not throw inside a transaction in a way that rolls back the revocation. Unknown random tokens yield generic401 and do not revoke arbitrary sessions.
- Sliding idle expiry extends on successful authenticated activity and refresh to min(now+7days, login_at+30days). All server requests reject an already idle/absolute-expired session; activity cannot resurrect it. Use server UTC clock with injectable clock in tests.
- Logout revokes the current cookie session idempotently and clears the cookie even if already invalid. Revoke permits current/owned session or all owned sessions; revoking other users requires account.revoke_session and rejects targeting master by another account. Default revoke affects current sid; body variants are strictly validated. Session revocation invalidates access tokens too through the DB check.
- Session expiry and consumed-token cleanup is a bounded scheduled/CLI job, never a timer per HTTP request. Retain hashes until family expiry; clean audit/visitor data only under an explicitly documented retention policy (no automatic loss of audit by default).
- Helmet, bounded JSON payload, trusted-proxy configuration matched to actual Passenger/LiteSpeed topology, configurable login/refresh rate limits and generic login errors. Use MySQL-backed atomic throttle counters/TTL (`auth_rate_limits`) so Passenger workers/restarts do not reset limits; configure client IP only after verifying proxy chain. Return429 with Retry-After. Never expose stack traces/SQL/errors with secrets.

### FE concurrency and restore

HTTP client sends credentials:include and Bearer from memory. On startup, no access token exists: refresh cookie first, then GET profile and install server identity/permissions. One in-flight refresh promise per tab; simultaneous401 requests await it and retry once. Requests made with a superseded token reuse the new access token instead of starting another refresh. Login/refresh/logout themselves are excluded from this interceptor; distinguish403 from expired401. Failed refresh clears identity/query cache, cancels pending requests and returns to Login with a validated internal returnTo.

Coordinate refresh across same-origin tabs with Web Locks. After acquiring the lock, read the current shared cookie through the browser's cookie mechanism (not JavaScript) by making refresh; do not queue a cookie-bearing request before acquiring the lock. Recheck session generation before committing any response. Logout broadcasts invalidation; pending refresh/login results from an older epoch cannot resurrect a session. Do not broadcast or persist tokens. Cross-tab tests verify serialization; browsers lacking Web Locks use a conservative single active-refresh tab/coordinator or force re-login rather than introducing a token-reuse grace window. Exact fallback choice must be fixed in the implementation plan and tested.

Strict rotation has a deliberate consequence: if a successful refresh response is lost, retrying the spent token revokes that family and requires login. Do not weaken reuse detection to hide this case.

## Real visitor collection (owner confirmed)

### What is counted and stored

Add one small public-site tracker at the router boundary in `src/routes/__root.tsx`, separate from admin imports. Initialize client-side after route commit; no browser globals during SSR. Exclude `/admin`, `/api`, auth routes, error pages and non-catalogue/private URLs. No third-party analytics SDK or synchronous request that delays navigation.

One visitor is an anonymous first-party browser identifier, not a verified person. Generate256-bit opaque visitor cookies on the server, signed with a dedicated analytics secret; persist only their hash, with a distinct secret/table from auth. Cookie is host-only HttpOnly, Secure in production, SameSite=Lax, Path=/api/analytics, maximum90days. www and apex are separate cookie contexts unless a verified canonical redirect applies; do not create cross-domain tracking. Blocking/clearing cookies, separate devices or browsers may count as another visitor; never fingerprint to bypass that choice.

A visitor has one active analytics session per30minutes of inactivity across tabs. Lock the visitor row when selecting/creating its active session; sessionCount increments once only when a new session is inserted. Session ends are inferred from last activity/timeouts; closing a tab is not proof the person ended browsing. No idle heartbeat that keeps hidden sessions alive.

Store normalized device class/OS/browser from bounded User-Agent parsing, first/last seen, session landing/latest path, referral hostname/source category, unique canonical page paths and unique product slugs. Resolve product labels against a small server catalogue manifest generated during build from the current catalogue; do not trust client-provided product names. Exclude product-type listing slugs from product-interest counts. Article/referral query strings, URL fragments, input fields, search text, emails, passwords, mouse/keyboard recordings and form payloads are never collected.

Identify IP from the verified proxy topology; never trust arbitrary forwarded IP headers. Proposed privacy default: convert IPv4 to a /24 prefix and IPv6 to /48 before persistence, expose masked IP in the visitor UI, and do not retain the full address in analytics rows or logs. Use a keyed, short-lived IP bucket for throttling if needed. User01's customer_access.view does not expose unmasked IP. Location may be resolved before masking using an existing verified local GeoIP/trusted server facility; do not send customer IP to an external service. Without such a facility store nullable country/city and show “Chưa xác định”; no fabricated location and no dependency on an unverified hosting header. Device/location are estimates, not identity verification.

### Batching, idempotence and limits

- Endpoint: POST `/api/analytics/collect`, same-origin credentialed JSON, validated Origin and a fixed custom request header. Never requires an admin token, and never uses or changes auth session cookies. Unknown/malformed/oversized input is rejected with400/413, throttled traffic with429; valid cookie-bearing collection returns204. If no valid visitor cookie exists, return202 with the new cookie and a fixed retry-bootstrap indicator, write no visitor/session/page rows yet, and retain pending paths until the subsequent acknowledged collect. Serialize initial bootstrap/first collect across same-origin tabs using Web Locks when available; if cookies cannot be established, stop after two bootstrap attempts rather than generating rows endlessly. Without Web Locks, first-ever parallel tabs may count separately; document this approximate-metric limit instead of claiming exact uniqueness. It never exposes visitor/session IDs, stored IP/location, previous activity or account data.
- First eligible public page sends once after a short defer; subsequent route changes accumulate in memory and flush at most once per15seconds while visible. Debounce bursts so repeated rapid clicks become one request. No periodic request when nothing changed. Use one best-effort keepalive flush on pagehide/visibility-hidden; no unload blocking. Retry transient network/503 at most twice with bounded backoff; do not infinitely retry429 or validation failures.
- A batch carries canonical paths/product slugs seen since the last acknowledgement and the current/landing path. Product/path sets are capped50 entries per request, at most16KiB body; retain bounded pending sets in memory only. No client timestamp is trusted as session authority.
- Server validates against generated public route/product allowlists; strips query/fragment and rejects unknown/admin/encoded-private paths before SQL. Referrer is normalized to hostname/category only; never save full URL. Request-origin checks reduce cross-site abuse, but are not proof of genuine traffic: mark analytics as approximate and apply server limits regardless.
- Transactions use server time, visitor-row lock and INSERT IGNORE/unique constraints for `(session_id,canonical_path)` and `(session_id,product_slug)`. Retrying the same cookie-bearing batch or concurrent tabs with the same established visitor cookie must not create duplicate visitors/sessions/page/product associations or increment distinct counters twice. Derive counters from successful new unique inserts, not incoming array length. Update landing only at session creation, latest route/last_seen monotonically on accepted activity. A duplicate retry can extend activity slightly; do not claim exact dwell time. Latest route means last received by the server, not a reconstructed chronological exit across tabs; label it accordingly. Out-of-order batches must not reduce server last_seen timestamps or double-count distinct pages/products.
- Keep up to200 distinct page paths and100 distinct products per analytics session. At the cap, continue last_seen updates and set an explicit truncation flag instead of unbounded inserts. The admin UI must disclose capped product lists when applicable.
- Initial proposed limits:10 batches/minute per visitor and120/minute per trusted network-prefix bucket, plus a global configurable ceiling. Existing MySQL throttle mechanism uses separate analytics keys, bounded expiries and request-cost checks before opening expensive transactions; tune after real hosting preflight. Public ingestion cannot starve auth: use a small dedicated pool/concurrency budget and return503 promptly when saturated. Catalogue rendering/links remain fully usable when metrics fail.

This is intentionally distinct-page/product aggregation. Replace misleading “page views” labels in the affected visitor summary with “Trang khác nhau đã xem”; the backend does not count every repeated page load/click. Visitor sessions expose first/last path and unique viewed products, without a per-click chronological timeline. Existing `pages` adapters may carry unique paths and first-seen timestamps solely for compatible presentation; no invented event history.

### Retention and opt-out

Keep analytics visitor/session/page/product data for90days of session activity; remove expired rows in small indexed batches through an explicit scheduled cleanup command. Remove an inactive visitor record after it has no retained sessions. Keep approximate aggregate reporting consistent with this90-day window and show the available range. Do not apply visitor cleanup rules to auth sessions or security audit logs.

Respect `navigator.globalPrivacyControl`, browser Do Not Track and a documented first-party analytics opt-out setting; skip collection and avoid creating the anonymous cookie when opted out. Provide a small public footer privacy control for turning this analytics collection off/on, without an admin/site redesign; disabling clears pending queues and requests clearing the analytics cookie via a same-origin opt-out endpoint. That endpoint cannot delete another visitor or auth session. Persist the choice locally, synchronize tabs and preserve the opt-out across reload. When opted out, collected historic rows remain subject to the90-day retention rather than silently claiming full erasure. Automated production smoke sends DNT:1 so it is not counted as customer traffic.

No claim that these analytics are complete, bot-proof or legal/compliance-certified. Explain anonymous ID, masked IP, estimated location,90-day retention and opt-out in the privacy control. Precise geolocation, identity enrichment, cross-site tracking and third-party IP APIs are outside scope.

### Visitor verification

Use real MySQL plus injected time: first hit, revisit,30-minute split, concurrent tabs, duplicate/out-of-order batches, rapid100-click sequence, capped pending sets/session limits, invalid paths, missing location, proxy spoofing, bot/oversized/rate tests, opt-out/DNT/GPC, retention and outage behavior. Assert constant row counts for repeated views of the same product within a session, no per-click event table, and no raw IP/query/form/token fields in persisted data/logs. Public collection must not return account/customer history or read arbitrary identifiers.

Browser acceptance: create a genuine public product visit with a fresh controlled test browser context with collection enabled, then read it through the admin visitor UI in local/CI. On production the tagged probe is checked by the host-side verifier, while screenshots verify the real admin UI without injecting fake customer traffic into its lists. A User account sees it through customer_access.view and is denied account/role APIs. Clearly identify controlled test traffic and keep it out of customer production metrics via a dedicated smoke mechanism; never insert fake named customers to make screenshots look populated. Local/CI browser tests assert collection, batching, duplicate suppression and visitor product interest; the live probe strategy is fixed below.

## HTTP contracts

Success: `{data: ...}` plus `{meta:{page,pageSize,total}}` for lists. Errors: `{error:{code,message,requestId,details?}}`; only field validation details are public. Codes/statuses400 validation,401 unauthenticated,403 forbidden,404 missing,409 conflict,429 throttled,503 temporarily unavailable. Existing health/version/demo contracts remain backward compatible.

| Endpoint | Behavior / required authority |
| --- | --- |
| POST /api/auth/login | username/password, cookie + access token + sanitized profile; public but origin/rate guarded |
| POST /api/auth/refresh | cookie rotation; public token-exchange endpoint, origin/rate guarded |
| POST /api/auth/logout | current cookie revocation; origin guarded; idempotent |
| POST /api/auth/revoke | authenticated; own session/all-own, or account.revoke_session for other ordinary accounts |
| GET /api/auth/profile | any authenticated account; own profile, roleIds/roles, permissions/fullAccess, no tokens/hashes |
| GET /api/accounts[/:id] | account.view; search/status/role filters, pagination and safe field projection |
| POST /api/accounts | account.create, and assign_role when roles supplied; username/display/password, optional email, roleIds |
| PUT /api/accounts/:id | account.update; display/email/password only plus revision; password change revokes sessions |
| DELETE /api/accounts/:id | account.delete; soft delete + revoke + audit |
| PATCH .../activate or /deactivate | matching distinct permission; no generic status-update bypass |
| PATCH .../roles | account.assign_role; complete roleIds set, revision; no master/self escalation |
| GET /api/roles | role.view; account form may use a narrow assignable-role-options endpoint requiring account.assign_role instead |
| POST/PUT/DELETE /api/roles[/:id] | matching role action; protected full-access role and in-use deletion checks |
| GET /api/permissions | permission.view |
| PATCH /api/roles/:id/permissions | role.assign_permission; permissionIds set, revision, grant ceiling and revocation |
| POST /api/analytics/collect | public same-origin bounded batch ingestion, anonymous cookie only; rate limited; no history returned |
| POST /api/analytics/opt-out | same-origin clears only the caller's anonymous analytics cookie; no auth-cookie/data deletion |
| GET /api/customer-access, /:id, /:id/sessions | customer_access.view; visitor list/detail/sessions and distinct viewed products; bounded paging/filtering |
| GET /api/audit-logs | audit.view; server security/account audit rows, paginated |
| GET /api/ready | deployment readiness only, no credentials/PII; DB reachable, expected schema/seed invariants and required config valid |

IDs and DTO shapes are defined once in typed contracts; repositories never serialize SELECT*. Mutations carry expected revision and return409 on stale writes. Unknown input keys are rejected, particularly roleIds/status/system flags on the wrong endpoints. Normalized usernames are unique and case-insensitive under an explicit rule; use lowercase ASCII username3–64 chars to avoid collation ambiguity. Do not require seeded email addresses not supplied by the owner.

## UI integration

Replace the default local auth adapter in normal dev/production; local adapter retained only as explicitly injected test fixture if useful. Remove implicit fallback and invalidate the old fixture session key when HTTP mode initializes. Runtime session becomes server user/profile+roleIds+effective permissions+fullAccess; update route guards, query keys, can/requirePermission and menu/action decisions together. Server identity is not mirrored into local role tables as authority.

Users form adds username/password and a multi-role picker; distinguish create password from optional password-change input. Activate/deactivate/role assignment use dedicated endpoints. Roles/permissions pages load APIs and variable resource.action entries. Show readable conflict/errors and preserve drafts. Master management fields and actions are read-only; backend remains authoritative.

User01 sees only Khách truy cập, with read-only list/detail/session UI and logout; redirect root/dashboard and forbidden deep links to allowed visitor route or403 view. Hide profile-edit, global search results, notifications and shortcuts that expose inaccessible modules. Admin/master sees all existing/future registered modules. Account header/footer display server profile; master's profile/avatar controls are read-only. Non-master profile edits use authorized account API paths, not IndexedDB.

HTTP-backed entity adapters cover users/roles/permissions/audit/visitors and visitor session reports. Existing browser-local business/content services keep their storage but use the current server-derived permission context; changing user clears caches/epoch and prevents an older asynchronous result from rendering. Local users/roles/audit fixture datasets are not seeded/queried as the authority in HTTP mode. Dashboard visitors/active-user totals must use the same server aggregates; replace the mock visitor description and hardcoded country/browser filters with actual API filter metadata and clear empty states; keep sales/product local metrics distinct and do not join unrelated local/server user IDs.

## Migrations, build, production deploy and rollback

1. Preflight actual DB engine/version/InnoDB, cPanel grants, connection path, charset/timezone, proxy chain, npm real path and backup/restore tools. Dedicated production DB and DB account; app runtime has DML only. Migration/backup credentials live outside releases/webroot on hosting, not in FE/artifact/GitHub logs. Provisioning credentials/grants is a separate concrete hosting action, reviewed at action time where required.
2. CI uses disposable MySQL service with confirmed compatible engine family, runs migration/seed and real integration tests plus existing check/build. Local testing uses a disposable DB configured separately; no production credentials in tests. Keep everyday dev/check/build commands; add explicit db:migrate/db:seed/db:status commands and documentation, not hidden startup schema mutation.
3. Artifact contains compiled backend, SQL migration files/checksums and schema compatibility range in manifest. It never contains secrets. Validate runtime and migration requirements before deployment/rollback.
4. Production gate selects exact CI artifact as today. Under the existing host deploy lock: verify archive/storage, install dependencies, validate env/DB, create consistent auth/visitor DB backup outside webroot (0600), hash it, and prove restore into an isolated disposable DB. Refuse migration if backup/restore verification cannot be completed. Do not send backup contents to GitHub logs/artifacts.
5. Run ordered migrations using a MySQL advisory lock and checksum ledger; only mark a version complete after verification. MySQL/MariaDB DDL may implicitly commit; do not claim CREATE/ALTER are rolled back with the DML transaction. Keep each migration narrowly scoped, additive and resumable with explicit dirty-state checks; stop on unknown/partial schema instead of stamping success or deleting it. Seed bootstrap separately in a transaction. On deploy failure before activation, leave the previous app selected and preserve migration/backup evidence.
6. Only activate after schema/seed/readiness checks. Restart Passenger with stable private environment loading and execute public API/version/images/retained-assets smoke plus auth/permission checks using dedicated smoke identities or ephemeral DB rows. Verify analytics with a signed, time-bounded server-issued probe marker whose rows are flagged and excluded from all customer counts/lists; a host-side verifier reads only this probe marker's rows through the private application DB connection and emits pass/fail assertions/counts, never visitor data or credentials. Do not add a public or admin HTTP probe-result endpoint. Do not accept an unsigned client is_test flag. DNT is used for ordinary smoke; the explicit ingestion probe uses a fresh context with this marker and no real visitor cookies. Never mutate/deactivate/delete the real master or user01 for tests; no test fixture records in production user-facing lists. Use a dedicated deployment-probe account with narrowly scoped non-management checks; keep its secrets host-side. Probe rows are segregated by a trusted server test flag, expire within24hours and are removed by bounded cleanup; production APIs never let regular clients set that flag. The narrowly scoped probe account tests login/profile and expected account/role API403 responses only; it never receives fullAccess. A separate host-side DB verifier checks the signed marker and release-bound analytics row counts, so probe-result verification does not require granting Admin to that account. Initial test/bootstrap tooling must document this strategy before live acceptance.
7. If post-activation checks fail, automatically select last known-good app release whose declared schema range still matches. Verify public site and API. Preserve migrated tables and all subsequent accounts/audit/revocations. No automatic down migration or database snapshot restore during app rollback. Failed rollback is explicit and requires intervention; never report successful deployment.
8. First auth rollout must also test rollback to the current pre-auth release: public site remains available; auth/account endpoints are absent and expose no DB data. This is a degraded admin state, not a verified working authenticated CMS. Later auth releases roll back to compatible authenticated releases. Keep this transition explicit in the release receipt.
9. Manual rollback uses the existing protected workflow and compatibility check. Emergency data restore is an independent maintenance action: quiesce writes, identify exact snapshot/time/loss window, owner approval, restore and verify; never overwrite newer production data silently. Deactivation/password/session revocation events must not be reversed by application rollback.
10. Keep scoped SSH protocol check/upload/deploy/rollback, host key pinning and fixed production config. Extend the trusted receiver's internal deploy sequence for backup/migrate/verify without allowing arbitrary shell/SQL commands. Bootstrap the reviewed tools deliberately through hosting access; app artifacts do not overwrite receiver code automatically.

Stable runtime env/secret file outside immutable release is loaded consistently for Passenger and deploy CLI. Missing auth config means auth endpoints/readiness fail closed; public static catalogue can remain available. Do not activate a release whose DB migration compatibility is not satisfied. Preserve npmBin correction already verified on hosting.

## Environment variables (values never committed)

DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD; optional DB_SOCKET / verified TLS settings; DB_POOL_LIMIT default5 with bounded queue/connect/acquire timeouts.
AUTH_JWT_SECRET (at least256-bit random), AUTH_JWT_ISSUER, AUTH_JWT_AUDIENCE; AUTH_ALLOWED_ORIGINS; AUTH_TRUST_PROXY matching preflight; AUTH_COOKIE_SECURE controlled by environment, AUTH_BCRYPT_COST bounded; login/refresh throttle settings with safe defaults.
ANALYTICS_ID_SECRET (separate from JWT), ANALYTICS_ENABLED, bounded analytics rate/retention settings (90days default), optional verified local GEOIP_DB_PATH, and private deployment-probe signing/credential settings.
MASTER_ADMIN_PASSWORD, SEED_USER_PASSWORD required only for first explicit bootstrap. Migration/backup DB credentials and database verification target are separate host-only settings; runtime account must not hold DDL/create-user grants. Access lifetime15min, idle7days and absolute30days are fixed requirements, not casually overridden in production.

## Verification and delivery acceptance

No success claim from mocks alone. Required automated tests use real MySQL and actual HTTP transport/cookies; injectable clock avoids waiting15min/30days. Cover all twelve owner cases, plus concurrent refresh transactions/reuse commit, multi-tab refresh, permission-revocation immediacy, master bypass attempts across every mutation path, create/update field smuggling, unknown role/permission IDs, stale revisions, password72-byte bound, input/rate/origin/proxy cases, no sensitive DTO/log fields, and outage fail-closed behavior.

Migration tests: empty DB, repeated seed, existing edited seed accounts unchanged, checksum mismatch, partial-DDL resume/dirty stop, backup/restore equality and application schema-range compatibility. Deployment tests: DB readiness/migration failure preserves current, post-switch auth smoke triggers app rollback without data rollback, immutable artifacts/checksums and previously open clients remain supported.

UI tests: admin/user login, user visitor-only menu/direct-link guards, role multi-select management, master disabled controls plus direct API403, one refresh for simultaneous401, stale response/logout races, save/conflict/error states. Real desktop/mobile browser walkthrough and screenshots are required after check/build; local preview is not proof of production acceptance.

Handoff contains changed files, migration/seed commands, environment template, DB diagram, API contracts, actual test counts/failures/skips, screenshot paths and deploy/rollback run IDs plus exact running source SHA. Report hosting/browser/database blockers accurately. No deployment is implied by design approval; implementation approval and any subsequent production activation must follow the owner's current authorization.

## Builder-owned calls for owner review

Calls proposed here: bcryptjs cost12, lowercase SQL table names, soft-delete accounts, extra spent-token table for strict reuse detection, server DB check on each protected request, MySQL-backed throttling, same-origin canonical host cookies, real MySQL disposable tests, no destructive automatic schema down migration, public first-party visitor collection, masked IP, no external geolocation calls,90-day analytics retention, distinct page/product semantics,15-second batch cap,30-minute analytics inactivity sessions and a minimal opt-out privacy control.

Owner confirmed real visitor collection after the first builder check. No unresolved owner scope question remains. All numeric collection/retention limits and masking behavior above are proposed defaults, not claims the owner specified them. Builder must implement and verify them as documented or surface a material constraint rather than silently changing metrics/security behavior.

## Primary references

- Refresh rotation/replay handling: https://www.rfc-editor.org/info/rfc9700/ and https://datatracker.ietf.org/doc/html/rfc9700#section-4.14
- MySQL DDL implicit commits: https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html ; MariaDB: https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit
- bcryptjs portability and input limit: https://github.com/dcodeIO/bcrypt.js


## Builder-check outcome

The fresh reviewer identified the visitor-collection scope question, which the owner resolved by including real traffic collection. A delta review then found one authority mismatch between a full-access probe-result endpoint and a least-privilege probe account. Resolved as a builder-owned call: no HTTP probe-result endpoint; the host-side verifier reads only signed release-specific probe rows and emits assertions, while the probe account remains non-management and never fullAccess. Reviewer found no other material planning ambiguity in the expanded collection design. Hosting preflight and final owner approval remain required; implementation has not started.
