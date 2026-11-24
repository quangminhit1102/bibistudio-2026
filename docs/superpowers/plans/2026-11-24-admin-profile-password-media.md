# Media facts, the master admin's own profile, password change in the profile: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The media library shows the real dimensions, size and type of the site's own images; the master admin edits its own profile; every signed-in user changes their own password from the profile page.

**Architecture:** Three independent changes in existing modules. The media page measures a seeded image's file in the browser when its record carries no figures. The profile service drops the master refusal for the account's own profile and avatar only. A new `POST /api/profile/password` verifies the current password, stores the new hash and revokes the account's other sessions; a new form on the profile page calls it.

**Tech Stack:** React 19, TanStack Query, Vitest + Testing Library (`tests/admin`), Express + mysql2 + zod + bcryptjs, `node:test` against MariaDB (`backend/test`), Playwright e2e (`tests/e2e`).

**Spec:** `docs/superpowers/specs/2026-11-24-admin-profile-password-media-design.md`

## Global Constraints

- No database migration, no change under `ops/`.
- `backend/src/accounts/service.ts` keeps refusing every change of the master account from the Accounts pages, by itself or anyone else; `backend/test/master-protection.test.mjs` must pass unchanged.
- Password rule, same as the Accounts page: at least 8 characters, at most 72 UTF-8 bytes. A password is never trimmed, logged, audited or echoed in an error.
- Wrong current password is HTTP 400 `INVALID_CURRENT_PASSWORD`, never 401.
- Rate limit of the password route: 5 per 15 minutes per account, 30 per 15 minutes per network prefix; over it, 429 `RATE_LIMITED` with `Retry-After`.
- A password change revokes the account's other sessions with `revoke_reason = 'password_changed'`, keeps the calling session, and does not change `auth_version`.
- User-facing texts are Vietnamese, exactly as written in this plan.
- Core must build for any site: `node scripts/check.mjs blank-site` passes; no site value in core files.
- Published history is never rewritten (no amend, rebase, squash, force-push).

## Review Focus

1. A password with Vietnamese letters or spaces: 8 characters may be more than 8 bytes, fewer than 72 characters may be more than 72 bytes, and leading or trailing spaces are part of the password. Expected: the form and the API agree, and neither trims (Task 4 and Task 5 tests).
2. The profile form has unsaved edits when the password is changed. Expected: the edits stay, and saving them afterwards succeeds instead of a revision conflict (Task 5 test).
3. The 429 answer on the password form. Expected: the message is shown, the three fields keep their values (Task 5 test).
4. A seeded image whose file is missing or is not an image. Expected: `—`, no error state for the page, no retry storm (Task 1 test).
5. The master account opened from Accounts > Users after this change. Expected: still read-only with the note "Tài khoản quản trị gốc được bảo vệ", including its avatar (Task 3 test; e2e `auth.spec.mjs` line 210 stays).

---

### Task 1: Media facts measured from the file

**Files:**
- Create: `src/features/admin/content/media/facts.ts`
- Modify: `src/features/admin/content/pages/media.tsx` (the two places that print `formatDimensions(...) · formatBytes(...)`)
- Test: `tests/admin/media-facts.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface MediaFacts { width: number; height: number; size: number; mime: string }
  /** Fetches a same-site public path; rejects any other url without a request. */
  export function measureImage(url: string, signal?: AbortSignal): Promise<MediaFacts>;
  /** `facts` is null while measuring and when the file cannot be measured. */
  export function useMediaFacts(asset: MediaAsset): { facts: MediaFacts | null; pending: boolean };
  ```

- [ ] **Step 1: Write the failing tests** in `tests/admin/media-facts.test.tsx` (stub `fetch` and `createImageBitmap` with `vi.stubGlobal`):
  - `"a record with figures is shown without a request"`: asset `{ width: 800, height: 600, size: 204800, mime: "image/png" }` renders `800×600 · 200 KiB`, `fetch` not called.
  - `"a seeded record is measured from its file"`: asset `{ width: 0, height: 0, size: 0, mime: "image/webp", url: "/catalogue/a.jpg" }`, `fetch` answers a 1 572 864-byte `image/jpeg` blob, `createImageBitmap` answers `{ width: 1200, height: 900, close() {} }`; first `…`, then `1200×900 · 1.5 MB`; `useMediaFacts(...).facts.mime === "image/jpeg"`.
  - `"a file that cannot be measured shows —"`: `fetch` answers 404; text is `— · —`; `fetch` called once.
  - `"a url outside the site is not fetched"`: `measureImage("//evil.example/a.jpg")` and `measureImage("https://evil.example/a.jpg")` reject, `fetch` not called.
- [ ] **Step 2: Run** `npx vitest run --config vitest.admin.config.ts tests/admin/media-facts.test.tsx`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `facts.ts`.** `measureImage`: validate with the same rule as `publicPath` in `media/resolve.ts` (export that function and reuse it), `fetch(url, { signal })`, reject unless `ok`, `blob.size` and `blob.type`, dimensions from `createImageBitmap(blob)` (close the bitmap). `useMediaFacts`: return the record's own figures when `width`, `height` and `size` are all above 0; otherwise `useQuery({ queryKey: ["bibi-admin", "media-facts", asset.url], enabled: !!asset.url, staleTime: Infinity, retry: false })`.
- [ ] **Step 4: Use it in `media.tsx`.** Add a small component `MediaFactsLine({ asset, withMime }: { asset: MediaAsset; withMime?: boolean })` in `media.tsx` that prints `…` while pending, else `[mime · ]dimensions · size` with the existing `formatDimensions` and `formatBytes`; replace both call sites (grid/list item without mime, preview dialog with mime).
- [ ] **Step 5: Run** the test file and `tests/admin/media.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `fix(admin): the media library measures a site image that has no stored figures`.

### Task 2: The master account edits its own profile and avatar (backend)

**Files:**
- Modify: `backend/src/profile/service.ts` (`updateSelf`), `backend/src/profile/avatar-service.ts` (`mutable` and its three callers)
- Test: `backend/test/profile-api.test.mjs`, `backend/test/profile-avatar-api.test.mjs`

**Interfaces:**
- Produces: `mutable(user: UserRow, revision: number, self: boolean)`; `self` is true when the route has no target id (`/api/profile/avatar`).

- [ ] **Step 1: Change the tests first.**
  - `profile-api.test.mjs`, test at line 113: the master's `PATCH /api/profile` with `{ revision, displayName: "Quản trị mới", email: "root@example.test", phone: "0900000001" }` answers 200 with those values and `revision + 1`; `audit_logs` has one `profile.update` row for the master with `changedFields` `["displayName","email","phone"]`. Rename the test (drop "Master"). Keep every other assertion.
  - `profile-avatar-api.test.mjs`, test at line 67: the master's own `PUT /api/profile/avatar` with a valid PNG answers 200 and `DELETE` answers 200; add: a second full-access admin (`user01` given `system-admin`) calling `PUT` and `DELETE /api/accounts/<master id>/avatar` gets 403 `PROTECTED_ACCOUNT`, and the master calling that management path for itself also gets 403.
- [ ] **Step 2: Run** `node scripts/check.mjs backend` (or the two files with `node --test` after `tsc -p backend/tsconfig.build.json`). Expected: the changed assertions FAIL with 403.
- [ ] **Step 3: Implement.** Remove the `is_master` refusal in `updateSelf`. In `avatar-service.ts`, `mutable` refuses `is_master` only when `self` is false; pass `targetId === undefined` from each caller.
- [ ] **Step 4: Run** `profile-api`, `profile-avatar-api`, `master-protection`, `accounts`, `release-acceptance` tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(profile): the master account edits its own profile and avatar`.

### Task 3: The master account's profile page is editable (frontend)

**Files:**
- Modify: `src/features/admin/accounts/self-profile-form.tsx`, `src/features/admin/accounts/avatar-editor.tsx`, `src/features/admin/accounts/server-profile.tsx`
- Test: `tests/admin/self-profile.test.tsx`, `tests/admin/server-profile.test.tsx`, `tests/admin/profile-avatar-form.test.tsx`, `tests/e2e/profile.spec.mjs` (lines 328-335), `tests/e2e/admin-usability.spec.mjs` (lines 209-214)

**Interfaces:**
- Produces: `AvatarEditor` gains `self?: boolean` (default false); it is locked when `readOnly || (user.isMaster && !self)`. `ServerProfile` passes `self`.

- [ ] **Step 1: Change the tests first.**
  - `self-profile.test.tsx` line 31: with `isMaster: true`, "Tên hiển thị" is not readonly, the note "Tài khoản quản trị gốc được bảo vệ" is absent, changing the name enables "Lưu thông tin" and `onSave` receives the new name. "Tên tài khoản" stays readonly.
  - `server-profile.test.tsx`: the master sees "Lưu thông tin" and "Đổi ảnh đại diện"; no protected note.
  - `profile-avatar-form.test.tsx`: `user.isMaster` without `self` is locked; with `self` it is not.
  - e2e `profile.spec.mjs`: the master changes its display name, saves, sees "Đã lưu hồ sơ"; the file input "Chọn ảnh đại diện" exists. e2e `admin-usability.spec.mjs` lines 209-214: check where that page is; if it is the master's own profile, use the readonly "Tên tài khoản" field for the keyboard check.
- [ ] **Step 2: Run** the three vitest files. Expected: FAIL on the changed assertions.
- [ ] **Step 3: Implement.** In `self-profile-form.tsx` remove every `initial.isMaster` branch (dirty, submit guard, `readOnly`, `data-readonly`, the note; the footer with the buttons is always rendered). `avatar-editor.tsx` and `server-profile.tsx` per Interfaces.
- [ ] **Step 4: Run** `node scripts/check.mjs admin`, then `node scripts/check.mjs e2e profile`, `e2e admin-usability`, `e2e auth`. Expected: PASS (`auth.spec.mjs` line 210 is the Accounts page and stays).
- [ ] **Step 5: Commit** `feat(admin): the master account's own profile page is editable`.

### Task 4: `POST /api/profile/password`

**Files:**
- Modify: `backend/src/profile/service.ts`, `backend/src/profile/routes.ts`, `backend/src/app.ts` (line 234: pass `{ pool, clock }` like `avatarRoutes`)
- Test: create `backend/test/profile-password.test.mjs` (fixture copied from `profile-api.test.mjs` lines 11-49)

**Interfaces:**
- Produces:
  ```ts
  // service
  changePassword(input: { currentPassword: string; newPassword: string }, actor: AuthPrincipal): Promise<ProfileDto>
  // routes
  profileRoutes(service: ProfileService, auth: AuthService, config: SecurityConfig, deps: { pool: Pool; clock: Clock }): Router
  ```
  Request body (strict): `{ currentPassword: string (1..72 bytes), newPassword: string (>= 8 chars, <= 72 bytes) }`. Answers: 200 `ProfileDto`; 400 `VALIDATION` shape as other routes; 400 `INVALID_CURRENT_PASSWORD` "Mật khẩu hiện tại không đúng"; 400 `PASSWORD_UNCHANGED` "Mật khẩu mới phải khác mật khẩu hiện tại"; 429 `RATE_LIMITED`.

- [ ] **Step 1: Write the failing tests.**
  - `"a user changes the password, keeps this session and loses the others"`: `user01` logs in twice (sessions A and B). With A: `POST /api/profile/password { currentPassword: userPassword, newPassword: "Mật khẩu mới 88" }` answers 200 with `revision + 1`. Then: A's `GET /api/profile` is 200; B's is 401; login with the old password fails (401); login with the new one succeeds; `refresh_token_sessions` rows of B have `revoke_reason = 'password_changed'`; `users.auth_version` is unchanged; `audit_logs` has `profile.password_change` whose metadata is `{ revokedSessions: 1 }` and no column of that row contains either password.
  - `"the master changes its own password"`: same call with the master token answers 200; login with the new password succeeds.
  - `"a wrong current password changes nothing"`: 400 `INVALID_CURRENT_PASSWORD`; `password_hash` and `revision` unchanged; both sessions still valid.
  - `"the new password must follow the rule and differ"`: `"short"` is 400; 25 times `"ấ"` (25 characters, 75 bytes) is 400; `" spaced pass "` is accepted and the login needs the spaces; the current password again is 400 `PASSWORD_UNCHANGED`; an extra key (`{ ..., userId }`) is 400.
  - `"origin and sign-in are required"`: a foreign `Origin` is 403; no token is 401.
  - `"the sixth attempt in 15 minutes is refused"`: five wrong attempts are 400, the sixth is 429 with `Retry-After`; after the clock moves 15 minutes a correct attempt is 200.
- [ ] **Step 2: Run** the new file. Expected: FAIL with 404.
- [ ] **Step 3: Implement the route.** `router.post("/password", requireBrowserOrigin(config), ...)`: rate limit first with `consumeRateLimit(pool, key, { limit, windowMs: 900000 }, clock.now())` for `profile-password:account:<req.auth.principal.id>` (5) and `profile-password:network:<networkPrefix(req.ip ?? "")>` (30), then `validate`, then `service.changePassword`.
- [ ] **Step 4: Implement the service.** Outside the transaction: read the caller's `password_hash`, `verifyPassword(currentPassword, hash)` (400 if false), `verifyPassword(newPassword, hash)` (400 `PASSWORD_UNCHANGED` if true), `hashPassword(newPassword)`. Inside the same write wrapper as `updateSelf`: lock the caller with `current(connection, actor)`; if its `password_hash` no longer equals the hash that was verified, 409 `REVISION_CONFLICT`; `UPDATE users SET password_hash=?,revision=revision+1,updated_at=?`; `UPDATE refresh_token_sessions SET revoked_at=?,revoke_reason='password_changed' WHERE user_id=? AND id<>? AND revoked_at IS NULL` with `actor.sid`; `writeAudit` action `profile.password_change`, target the account, metadata `{ revokedSessions: <affectedRows> }`; return `profileDto` of the updated row.
- [ ] **Step 5: Run** `profile-password`, `profile-api`, `auth`, `auth-http`, `http-security` tests. Expected: PASS.
- [ ] **Step 6: Commit** `feat(profile): a signed-in user changes their own password`.

### Task 5: "Đổi mật khẩu" on the profile page

**Files:**
- Create: `src/features/admin/accounts/password-form.tsx`
- Modify: `src/features/admin/accounts/profile-api.ts`, `src/features/admin/accounts/server-profile.tsx`
- Test: create `tests/admin/password-form.test.tsx`; extend `tests/admin/server-profile.test.tsx`, `tests/e2e/profile.spec.mjs`

**Interfaces:**
- Consumes: `POST /api/profile/password` from Task 4.
- Produces:
  ```ts
  // profile-api.ts
  changePassword(currentPassword: string, newPassword: string): Promise<ProfileDto>
  // password-form.tsx
  export function PasswordForm(props: { onChange: (currentPassword: string, newPassword: string) => Promise<void> }): JSX.Element
  ```
  Labels: "Mật khẩu hiện tại" (`autoComplete="current-password"`), "Mật khẩu mới" and "Nhập lại mật khẩu mới" (`autoComplete="new-password"`), button "Đổi mật khẩu". Messages: "Mật khẩu mới cần ít nhất 8 ký tự", "Mật khẩu mới quá dài", "Hai ô mật khẩu mới không khớp", "Mật khẩu mới phải khác mật khẩu hiện tại"; success notice "Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất."

- [ ] **Step 1: Write the failing tests** in `password-form.test.tsx`:
  - the button is disabled until the three fields are filled;
  - `"1234567"` shows "Mật khẩu mới cần ít nhất 8 ký tự"; 25 times `"ấ"` shows "Mật khẩu mới quá dài"; different confirmation shows "Hai ô mật khẩu mới không khớp"; new equal to current shows "Mật khẩu mới phải khác mật khẩu hiện tại"; in each case `onChange` is not called;
  - `" spaced pass "` twice calls `onChange("old-pass-1", " spaced pass ")` untrimmed; on success the three fields are empty;
  - `onChange` rejecting with `new Error("Vui lòng thử lại sau")` shows that message and the three fields keep their values.
  In `server-profile.test.tsx`: the card "Đổi mật khẩu" is on the page for a normal user and for the master; with the display name edited but unsaved, a successful password change (server answers `revision: 2`) keeps the edited name, and the following "Lưu thông tin" sends `revision: 2`.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement** `changePassword` in `profile-api.ts`, `PasswordForm`, and a third `Card` in `server-profile.tsx` under "Thông tin tài khoản" titled "Đổi mật khẩu". After success call the page's `saved(p)` so the cached profile carries the new revision, then the notice. The password fields do not feed `UnsavedDialog`. If `SelfProfileForm` only adopts a newer `initial.revision` while clean (its effect at lines 38-44), make it adopt the revision alone while dirty, keeping the draft.
- [ ] **Step 4: e2e** in `tests/e2e/profile.spec.mjs`: `user01` signs in in two browser contexts; in the first, changes the password on `/admin/settings/profile` and sees the notice; the second, on reload, is on the sign-in page; signing in with the new password works. Restore nothing: the fixture database is per run.
- [ ] **Step 5: Run** `node scripts/check.mjs admin` and `node scripts/check.mjs e2e profile`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(admin): change the password from the profile page`.

### Task 6: Documents, full check, local run

**Files:**
- Modify: `docs/admin-auth-api.md` (the master rule at line 21; the profile API table near line 99: master allowed on `PATCH /api/profile` and `/api/profile/avatar`, new row `POST /api/profile/password`), `docs/admin.md` (profile paragraph near line 109; media library figures), the spec's status line ("đã duyệt (2026-11-24)").

- [ ] **Step 1:** Update the documents.
- [ ] **Step 2: Run** `npm run check` (all stages, including `blank-site` and `e2e`) and `npm run build`. Expected: every stage passes.
- [ ] **Step 3: Local run** per `docs/build-and-deploy.md`: local MariaDB, backend and site; with the master account and `user01`, on the browser: media library shows figures for catalogue and journal images; the master saves its name, email, phone and avatar; password change, sign-in with the new password, the other browser signed out. Recorded by the testing agent.
- [ ] **Step 4: Commit** `docs(admin): the master account's own profile, password change, media figures`.
- [ ] **Step 5:** Open the pull request into `main` once PR #14 is merged; do not merge it.
