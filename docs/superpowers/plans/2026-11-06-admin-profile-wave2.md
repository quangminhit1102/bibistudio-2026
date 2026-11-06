# Admin Profile Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Native đã chọn ở đợt1, tiếp tục giữ phương thức này). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Non-Master tự sửa tên/email/điện thoại/avatar qua backend MySQL thật; quản lý User dùng cùng dữ liệu, giữ nguyên RBAC/Master protection và có đường rollback không mất ảnh.

**Architecture:** API self-profile lấy danh tính từ token, không đòi account.update. Metadata dùng transaction/revision hiện có; ảnh immutable được decode/resize ở worker rồi lưu private ngoài webroot/release. Feature migration/manifest riêng, giữ identity schema4 để có thể thử rollback về backend cũ.

**Tech Stack:** React/TanStack Query/Router, Express5, MySQL/MariaDB, Node24, jpeg-js/pngjs chỉ phía backend; UI primitives hiện có.

**Spec:** `docs/superpowers/specs/2026-11-06-admin-usability-profile-design.md`, phần Đợt2. Đợt1 đã kết thúc tại2043880, source ứng dụng được kiểm chứng e27102c.

## Global Constraints

- Chỉ triển khai và kiểm chứng local trong plan này; không push/deploy, sửa role production, cấp DB permission mới hoặc sửa config hosting. Phát hành thật cần owner duyệt riêng.
- Mọi non-Master còn hoạt động được sửa hồ sơ chính mình; Master bất biến. Admin+User vẫn cộng quyền; User chỉ có module Khách truy cập và lối vào Hồ sơ qua account menu.
- Không tự đổi username/password/role/permission/active qua self-profile. API strict allowlist; backend bảo vệ độc lập UI; không thêm account.update cho User.
- Email optional theo validation hiện có; phone optional/nonunique, tối đa32ký tự, chỉ số với dấu+ ở đầu; bỏ dấu cách/dấu ngoặc/gạch nối, từ chối chữ/extension, giữ0 đầu và không tự thêm mã quốc gia. Cho phép7–15chữ số; empty thành null. Đây là quyết định builder, không biến phone thành định danh login.
- Avatar: JPEG hoặc PNG tĩnh, input<=2097152byte, <=16000000pixel, output giữ tỉ lệ trong512×512; không upsize/crop; không URL ngoài/base64 DB; reject SVG/HTML/GIF/WebP/APNG. Output JPEG chất lượng85 hoặc PNG8bit, không EXIF/comment/metadata gốc; honor JPEG orientation1–8 trước khi bỏ metadata.
- Ưu tiên không native dependency: baseline jpeg-js0.4.4/pngjs7.0.0 pin exact, verify provenance/audit/lock/install size ở Task3 trước dùng. PNG baseline chỉ8bit noninterlaced để giữ inflate bounded; thông báo từ chối rõ cho encoding khác. Không âm thầm mở format/limit khi codec không qua probe.
- Decode worker concurrency1/process, không queue vô hạn, timeout5giây, JPEG maxResolutionInMP16/maxMemoryUsageInMB128/tolerantDecoding=false. Worker resourceLimits không được mô tả là hard cap cho Buffer/zlib; PNG phải kiểm tra cấu trúc/chunk/IHDR và inflate bound riêng.
- Một config mới `PROFILE_ASSET_DIR` absolute/persistent/outside webroot/release; local setup tự tạo `.superpowers/local-avatars`, production dự kiến `production/profile-assets`. Directory0700/files0600 trên POSIX; root/file symlink, relative path, traversal bị từ chối. Không startup migrate/seed.
- Ảnh cũ retired giữ>=30ngày; không xóa khi thay ảnh trước commit. Backup DB+files cùng manifest/hash, restore thử isolated. Không down-migrate, restore đè live DB hoặc rollback bằng cách xóa dữ liệu mới.
- Không thêm thư viện UI/codec vào public entry; giữ ngân sách public initial gzip deltaJS<=10240byte/CSS<=2048byte theo script hiện có.

## Review Focus

1. User-only/no-role/role đổi giữa request: self-profile chỉ phụ thuộc active session; quản lý người khác vẫn account.view/update; Master bị chặn ở mọi mutation, kể cả upload/delete avatar.
2. Upload thành công ở disk nhưng transaction/revision thất bại, hoặc client retry sau mất response: không mất ảnh cũ, không ghi avatar vào sai user, không ghi đè immutable asset.
3. Logout/account switch trong lúc load/upload ảnh hoặc refresh401: không hiện avatar/user cache từ session trước, chỉ một refresh đồng thời, không replay mutation sang identity mới.
4. Nội dung giả MIME, dimension/inflate bomb, ảnh xoay EXIF, PNG lỗi CRC/APNG/interlace: từ chối sớm hoặc chuẩn hóa đúng, không treo event loop/API.
5. Old release chạy trên DB mới và backup trong khi thay ảnh: readiness/login vẫn hoạt động, old account writes giữ phone/avatar, DB backup trỏ đúng file snapshot; rollback không chỉ là đổi symlink.

## Quyết định và interface chung

- `backend/profile-migrations/001_profiles.sql`: thêm nullable `users.phone VARCHAR(32)`, `users.avatar_id CHAR(36)`; tạo `profile_avatar_assets` (id,user_id,format,width,height,bytes,sha256,created_at,retired_at) và `profile_schema_migrations`. Không sửa001–004 identity hay access-log migrations. Không thêm FK ngược users.avatar_id để tránh vòng DDL; service kiểm tra ownership/pointer trong transaction, asset.user_id FK users.id. Mọi phase DDL dirty/resume theo pattern feature migration hiện có.
- `ProfileDto = PrincipalDto & {phone:string|null; avatarId:string|null}`. PrincipalDto thêm phone/avatarId optional để tương thích wire/fixtures cũ; runtime mới luôn trả nullable values từ row (undefined→null ở DB chưa migrate). AccountDto kế thừa fields này. Không đưa path, token hoặc bytes vào DTO.
- GET `/api/profile` → ProfileDto; PATCH cùng route nhận `{revision,displayName?,email?,phone?}` → ProfileDto. PUT `/api/profile/avatar` raw image và DELETE cùng route → ProfileDto. GET `/api/profile/avatar/:assetId` → authenticated binary của pointer hiện hành.
- Quản lý User: POST/PUT `/api/accounts` hiện có thêm phone; avatar chỉ thêm sau khi tạo tài khoản thành công. PUT/DELETE `/api/accounts/:id/avatar` cần account.update; GET `/api/accounts/:id/avatar/:assetId` cần account.view. Không cấp permission mới. Self route không nhận targetId; field thừa kể cả avatarId bị400.
- Upload/delete dùng `If-Match: "<revision>"`; thiếu428 PRECONDITION_REQUIRED, malformed400, stale409 REVISION_CONFLICT, unsupported415, quá byte/pixel413, ảnh hỏng422, bận429. JSON mutations giữ body revision như hiện tại.
- GET ảnh không nhận cookie-only authentication: dùng Bearer qua HTTP client rồi ObjectURL, Cache-Control private,no-store và nosniff. Retired/noncurrent asset404, người khác không có quyền403; chỉ lấy path từ opaque UUID đã kiểm tra và DB metadata.
- Tất cả profile mutations lấy advisory lock profile-assets trước withRbacWrite/lockAuthorizedUsers (code undefined cho self); kiểm tra active session/current actor/target/isMaster/revision trong transaction. Increment users.revision, không đổi auth_version hoặc role. Audit profile.update/avatar.replace/avatar.remove chỉ ghi field names/asset IDs, không old/new email/phone/bytes.
- File mới ghi temp wx0600 rồi rename cùng filesystem tới UUID mới, fsync trước DB commit. DB rollback dọn file mới nếu commit chắc chắn chưa xảy ra; commit outcome không rõ giữ orphan để cleanup sau, không unlink file có thể đã referenced. Old file chỉ retired sau commit.
- Avatar UI có chọn/xem trước/Lưu ảnh/Hủy/Xóa; tách metadata save khỏi avatar mutation. Khi metadata dirty, yêu cầu lưu/hủy trước đổi ảnh để không làm mất draft/revision. Query refetch không remount/reset form dirty.
- Codec references: [jpeg-js API/limits](https://github.com/jpeg-js/jpeg-js), [pngjs API](https://github.com/pngjs/pngjs), [PNG sync parser](https://github.com/pngjs/pngjs/blob/main/lib/parser-sync.js). Source hiện tại dùng inflate không bound cho interlaced; không dựa dimension check một mình. Pin/tarball thực tế phải kiểm tra lại khi cài.

### Task 1: Migration, DTO và tương thích bản cũ

**Files:** create `backend/profile-migrations/001_profiles.sql`, `backend/src/profile/schema.ts`, `types.ts`; modify `backend/src/http/contracts.ts`, `backend/src/auth/repository.ts`, `backend/src/accounts/service.ts`, `routes.ts`; test `backend/test/profile-schema.test.mjs`, `profile-phone.test.mjs`.

**Interfaces:** `migrateProfiles(pool:Pool,directory:string):Promise<void>`; `profileSchemaStatus(pool,directory)` → `{version:number,state:'empty'|'complete'|'dirty'|'incompatible',migrationChecksums:Record<string,string>}`; `assertProfileSchemaReady(connection:PoolConnection):Promise<void>` returns503 unless feature1 complete. `normalizePhone(value:unknown):string|null` in `profile/validation.ts`, Zod schema shared by account/self routes. UserRow phone/avatar_id optional nullable; existing resolvePrincipal maps absent→null without requiring feature tables. Account writes only touch new columns when phone is supplied and feature readiness is confirmed; legacy CRUD with phone absent stays usable on schema4 without profile migration.

- [ ] RED tests: migrate pre-existing schema4 with edited user data/roles/passwords; assert phone/avatar null, originals unchanged; repeated migrate no-op; partial DDL dirty/resume/checksum mismatch fail closed; phone normalization/null/invalid letters/+ placement/leading0/nonunique; existing account CRUD phone permission and Master denial.
- [ ] Run Node24 backend build then `node --test backend/test/profile-schema.test.mjs backend/test/profile-phone.test.mjs`; observe actual failures before implementation.
- [ ] Implement additive feature schema and shared validation, enrich account create/update within existing authorization/revision transactions. Schema migration never runs at app startup. Seed stays idempotent and does not overwrite new fields. Capture immutable old compiled backend fixture at e27102c in ignored test workspace before rebuilding (no checkout/reset shared worktree).
- [ ] GREEN command above + existing account-crud/master-protection/migrations tests. Run actual captured old createApp against migrated isolated DB: readiness200/login200, old update of displayName preserves phone/avatar pointer. No unknown-schema bypass in identity checks.
- [ ] Commit `feat: add profile metadata with additive migration`.

### Task 2: Self-profile service và API

**Files:** create `backend/src/profile/service.ts`, `routes.ts`; modify `backend/src/app.ts`, `runtime.ts`, `config.ts`; test `backend/test/profile-api.test.mjs`.

**Interfaces:** `createProfileService({pool:Pool,clock:Clock})` → `getSelf(actor:AuthPrincipal):Promise<ProfileDto>`, `updateSelf(input:{displayName?:string,email?:string|null,phone?:string|null},revision:number,actor:AuthPrincipal):Promise<ProfileDto>`. `profileRoutes(service,auth,config):Router`. PROFILE_ASSET_DIR absent → existing runtime stays usable, new profile routes return503; configured feature verifies migration for reads/writes, missing schema503 (readiness of enabled feature fails closed).

- [ ] RED integration: User-only and active no-role edit own allowed fields with valid session; cannot target another ID, set roles/active/password/username/assetId; unknown fields400; Master self and Admin→Master mutations403; inactive/revoked session401; concurrent same revision only one writer; audit field names only; login/refresh grants reflect updated displayName/phone with permissions unchanged.
- [ ] Run `node --test backend/test/profile-api.test.mjs` after backend build, observe RED; implement using existing locked authorization with code undefined, never temporary elevated principal.
- [ ] Keep requireBrowserOrigin JSON behavior for JSON calls; account.update stays mandatory for management routes. Validate empty/invalid data, no-op does not churn revision/audit. Preserve common ApiError shape and safe logs.
- [ ] GREEN profile API plus http-security/accounts/auth tests; commit `feat: add authenticated self profile API`.

### Task 3: Bounded image normalization và private file store

**Files:** create `backend/src/profile/avatar-codec.ts`, `avatar-worker.ts`, `avatar-store.ts`; modify backend package/lock and local setup as needed; tests `backend/test/profile-avatar-codec.test.mjs`, `profile-avatar-store.test.mjs`.

**Interfaces:** `NormalizedAvatar={bytes:Buffer,format:'jpeg'|'png',width:number,height:number}`; `normalizeAvatar(bytes:Buffer,mime:string):Promise<NormalizedAvatar>`; `StoredAvatar={id:string,format:'jpeg'|'png',width:number,height:number,byteLength:number,sha256:string}`. `createAvatarStore({root:string}):AvatarStore` exposes `write(image:NormalizedAvatar):Promise<StoredAvatar>`, `read(asset:StoredAvatar):Promise<Buffer>`, `remove(id:string,format:'jpeg'|'png'):Promise<void>`. Service/cleanup must prove unreferenced under lock before remove; store never accepts a client path. `PROFILE_ASSET_DIR` validated once with lstat/realpath; Node file open nofollow + regular file/owner/path constraints at use, not just startup.

- [ ] Inspect installed tarballs/version provenance, dependency licenses/audit and install size before adding two exact backend dependencies. No frontend imports. Baseline test fixture generation uses checked-in tiny synthetic JPEG/PNG + corrupt/bomb headers, never user files.
- [ ] RED: format/MIME mismatch, truncated/bad CRC, APNG/interlace/16bit, >2MiB/16MP, duplicate/malformed IHDR/chunk lengths, EXIF rotations1–8; normalized<=512 each, alpha preserved PNG, metadata removed, small image not upscaled; worker busy429/timeout and API heartbeat still responds. Header preflight bounds JPEG dimensions/PNG IHDR before allocation; no trust extension.
- [ ] Implement strict PNG chunk scanner (single first IHDR, bounded chunks/lengths, interlace0/8bit, reject acTL), jpeg decoder explicit bounds, worker timeout/busy handling and pixel resize/rotation. Re-encode pixels only; never copy input ancillary chunks/EXIF. Do not describe worker heap limit as Buffer hard cap. Run backend build + `node --test backend/test/profile-avatar-codec.test.mjs` RED→GREEN.
- [ ] RED→GREEN storage tests: root escape/symlink/path injection, exclusive new file, immutable collision, missing/wrong-hash file, permissions, fsync/rename failures, no original bytes retained; POSIX behavior tested on Linux CI rather than fake Windows mode assertions. Record cold decode time/RSS with synthetic max valid input; no hosting compatibility claim from local result.
- [ ] Commit `feat: normalize and store private profile avatars`.

### Task 4: Avatar authorization, concurrency và HTTP binary client

**Files:** extend `profile/service.ts`, `routes.ts`; create `backend/src/profile/avatar-routes.ts`; modify account routes, `backend/src/http/security.ts`, `src/lib/admin-http.ts`; tests `backend/test/profile-avatar-api.test.mjs`, `tests/admin/http-binary.test.ts`.

**Interfaces:** extend profile factory options with `assets?:AvatarStore`; methods `replaceAvatar(targetId:string|undefined,bytes:Buffer,mime:string,revision:number,actor:AuthPrincipal):Promise<ProfileDto>`, `removeAvatar(targetId:string|undefined,revision:number,actor:AuthPrincipal):Promise<ProfileDto>`, `readAvatar(targetId:string|undefined,assetId:string,actor:AuthPrincipal):Promise<{bytes:Buffer,format:'jpeg'|'png'}>` (undefined=self; provided ID=management permission required). HTTP client add `upload<T>(path:string,blob:Blob,options:{revision:number,signal?:AbortSignal}):Promise<T>` and `requestBlob(path:string,options?:{signal?:AbortSignal}):Promise<Blob>`, reusing endpoint/bearer/refresh/epoch logic, credentials include. Existing request options add `ifMatch?:number` only when explicitly supplied; DELETE avatar calls request with method DELETE/body {}/ifMatch revision. Normal JSON callers unchanged. No token in URL/img src.

- [ ] RED MySQL+filesystem integration: real image upload/read/replace/delete, User cannot mutate/view others, Master denied before body decode, Origin/X-Bibi-Request required for mutations, missing/stale If-Match, no session/busy/invalid body errors. Add If-Match to allowed headers; extract origin-header check so raw route does not weaken JSON requirement elsewhere. Authenticate/rate-limit before express.raw2MiB; actor10uploads/15min shared DB throttle plus worker process gate.
- [ ] RED failure/race tests: stale upload after disk write, DB rollback, commit acknowledgement lost, two replacements, replace vs remove/deactivate/role change, request disconnect. Only one revision wins; previous pointer/file intact on failures; commit-uncertain leaves safe orphan, no cleanup of possibly referenced data. Retired image not retrievable; audit has no PII/bytes.
- [ ] RED binary-client tests: concurrent401 single refresh, preserve immutable Blob on retry, raw content type/If-Match, abort and logout/login to another identity discards late responses and does not replay writes. JSON client contracts unchanged.
- [ ] Implement and GREEN via backend build + `node --test backend/test/profile-avatar-api.test.mjs` and `vitest --config vitest.admin.config.ts run tests/admin/http-binary.test.ts`; commit `feat: secure avatar mutations and authenticated binary requests`.

### Task 5: Hồ sơ và quản lý tài khoản trên UI

**Files:** create `src/features/admin/accounts/self-profile-form.tsx`, `server-avatar.tsx`, `profile-api.ts`; modify `server-profile.tsx`, `account-form.tsx`, `server-account-detail.tsx`, `http-api.ts`, `server-hooks.ts`, shell `account-menu.tsx`, `admin-layout.tsx`, services/context cache boundaries and minimal admin.css. Tests `tests/admin/self-profile.test.tsx`, `server-avatar.test.tsx`, existing account/navigation/session tests.

**Interfaces:** `createProfileApi(http)` get/update/upload/remove/avatarBlob matching Tasks2/4; authenticated image hook keyed session identity+userId+avatarId and releases ObjectURLs on replace/unmount/logout. Header/sidebar query and profile caches invalidated consistently after save; other users only via account.view endpoints. Keep legacy local avatar adapter for fixture-only UI.

- [ ] RED: User-only menu shows Hồ sơ/Đăng xuất at header/sidebar, can open /admin/settings/profile, cannot open account management or other business routes. Active no-role user lands at own profile when navigation is empty (not an inaccessible visitors fallback). Native readonly username/roles; editable name/email/phone; Master explanation/readonly/no active save/upload. Non-Master Admin can self-edit without changing roles.
- [ ] RED: metadata create/edit/revert/save-failure dirty guard, phone validation, revision conflict preserves draft and offers reload; query refetch/theme does not wipe changes. Create account has phone; avatar offered only after account exists. Upload failure does not pretend newly created account was rolled back.
- [ ] RED: choose preview without uploading, save/remove image pending/success/failure, fallback initials, disabled with reason while metadata dirty; busy actions cannot race. Header/sidebar reflect new name/avatar after navigation/reload; logout/account-switch during pending blob has no old-user flash or unreleased ObjectURL.
- [ ] Implement using existing shared Button/Field/Badge/UnsavedDialog; profile route exception becomes any authenticated self, not account.view. No permission grants or extra admin menu modules. GREEN new tests + server-profile/account-ui/navigation/auth-http regressions; commit `feat: integrate editable server profiles and avatars`.

### Task 6: Artifact metadata, paired backup và rollback tooling

**Files:** create `ops/profile-metadata.cjs`, `ops/profile-lifecycle.cjs`, `backend/src/profile/backup.ts`, `cli.ts`; modify `ops/release.cjs`, `receiver.cjs`, `database-lifecycle.cjs`, `scripts/build.mjs`, `preview.mjs`, `local-database.mjs` and CI evidence/check wiring. Tests `scripts/profile-release.test.mjs`, `profile-rollback.test.mjs`, `backend/test/profile-backup.test.mjs`; docs `docs/admin-profile-operations.md`.

**Interfaces:** manifest schemaVersion4 adds profiles `{requiredMin:1,compatibleMax:1,migrationChecksums,assetFormatVersion:1}`; accepts legacy manifest1/2/3 unchanged. Enabled runtime must validate both identity4 and profile1. Explicit CLI profile:migrate/status/cleanup; existing local setup applies feature migration and config without extra daily dev commands. No migration on dev/server startup.

- [ ] RED metadata/artifact tests: tampered/missing feature SQL/worker assets rejected; no secrets/uploads/node_modules bundled; old receiver rejects schema4; upgraded receiver accepts old releases, never loosens identity/access-log checks. New required private path checked before activation. Do not claim release4 installable with receiver3.
- [ ] RED real MySQL/files backup tests: acquire same profile-assets advisory lock across native consistent DB dump and file snapshot, verify hashes/referenced IDs, restore DB plus files into isolated verifier and read every referenced avatar. Missing/corrupt/symlink asset or restore mismatch blocks activation. Backup manifest hashes cover DB dump and copied files; fixed backups directory0600/0700. Writes time out safely while backup holds lock, not partially commit.
- [ ] RED rollback to captured e27102c backend on migrated DB: /ready/login/profile/account edit200; phone/avatar references survive old writes; then forward new release reads same data/files. Inject release probe/upload failure and assert current release retained/restored. Old code may hide new fields, but no data deletion.
- [ ] Upgraded receiver owns paired backup even when current/target lacks profile feature: choose a verified profile-aware tool from current or candidate; if profile data/storage exists and no capable tool exists, refuse activation/rollback with explicit reason. No fallback to DB-only backup. Fixed-root storage persists independent of release symlink. Only nullable additive schema, no down migration.
- [ ] Cleanup CLI uses same lock, checks no users reference asset, retired>=30days and backup pin policy; failure cannot remove active/pinned assets. Fresh orphan files only cleaned after24hours, never blind recursive directory deletion. Backup retention and rollback horizon documented together; no new production cron installed here.
- [ ] GREEN Node tool/API tests and actual native backup/restore/old-backend rehearsal local; commit `feat: package profile assets with verified rollback support`.

### Task 7: Full acceptance, compiled preview và bàn giao

**Files:** create `tests/e2e/profile.spec.mjs`, `tests/e2e/helpers/profile-fixture.mjs`, `docs/superpowers/reports/2026-11-06-admin-profile-wave2-acceptance.md`; modify `tests/e2e/auth.spec.mjs`, `access-logs.spec.mjs`, `admin-usability.spec.mjs`, `scripts/auth-ui-check.mjs`, `.github/workflows/ci.yml`, `docs/admin.md`, `docs/build-and-deploy.md`, `docs/admin-auth-api.md`.

**Interfaces:** browser helper wraps existing MariaDB auth fixture with explicit profile migration + temporary private asset directory, passes PROFILE_ASSET_DIR to runtime, cleanup reverses all fixtures. Use it in all4browser specs so new UI is tested against enabled backend; do not silently migrate generic backend test fixtures or weaken old-schema tests. Compiled Express + real React/Chromium, fresh browser contexts; screenshot evidence `.superpowers/e2e/profile/`. No production credentials/data. Synthetic non-Master Admin and User-only distinct from production user01.

- [ ] Browser acceptance: User-only login→own profile save name/email/phone→reload/header/sidebar; avatar JPEG/PNG preview/upload/replace/remove, Master locked, management Admin edits another account without changing role; protected routes403. Parallel401, upload failure/revision conflict, draft retained, logout/login other user while blob pending. Test390×844,900×1000,1440×1000 and light/dark, labels/touch/overflow/focus.
- [ ] Run Node24 `npm run check`, `npm run build`, `node scripts/admin-bundle-report.mjs`; all required checks exit0, no admin code in public initial graph and budget respected. Record actual counts/skips/warnings, backend dependency footprint and measured decoder bounds. Linux CI must exercise POSIX/symlink cases before release acceptance.
- [ ] Start compiled preview at known SHA on guarded develop DB after explicit local migration; manually verify real forms/images, capture screenshots. Docs distinguish local acceptance from cPanel codec/upload/native-paired-backup/receiver acceptance still pending. No fabricated hosting claim.
- [ ] One fresh whole-branch reviewer on most capable model; regrade findings, one TDD fix pass for Important/Critical and full suite GREEN; defer minors explicitly. No implementer subagents and no per-task reviewers for Native.
- [ ] Commit acceptance, retain local branch and owner-facing preview. No push/deploy. Before any later production release: confirm config/codec on actual Node24 hosting, upgrade receiver first, backup paired and restore isolated, permission/gate approval, deploy exact artifact, protected-account/self API/avatar probes and actual rollback/forward rehearsal. Failure blocks release.

## Self-review và handoff

Spec coverage: self-only/RBAC/Master→Tasks1/2/4/5; phone/account data→1/2/5; bounded image/private storage→3/4; session/cache/drafts→4/5/7; migration/old release/paired backup→1/6/7. Review Focus1→2/4/5,2→4/6,3→4/5/7,4→3,5→1/6. Existing architecture reused; no unrelated CMS/public catalogue changes. Codec formats/limits, phone normalization and separate feature migration are builder calls made explicit above for owner review. No source/DB/hosting changes made while writing this plan.

Native remains the selected execution method. New implementation plan requires owner review before implementation; design scope is already approved and is not being reopened.
