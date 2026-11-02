# Hoàn thiện BiBi Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Hoàn thiện admin tiếng Việt theo thiết kế đã duyệt, gồm Login, dữ liệu trình bày, ảnh đại diện E, điều hướng, nút, báo cáo và kiểm chứng đủ96 ví dụ component.

**Architecture:** Sửa shared UI đang có, giữ các feature/service hiện tại. Auth dùng adapter có thể thay bằng HTTP; profile lưu Blob và hồ sơ nguyên tử trên IndexedDB. Migration trình bày giữ dữ liệu nghiệp vụ và lazy loading; không viết lại admin.

**Tech Stack:** React19, TypeScript, TanStack Router/Query/Table, Radix, Recharts, Zod, IndexedDB/idb, Vitest/Testing Library; Node24.

**Spec:** [Thiết kế đã duyệt](../specs/2026-11-02-admin-ui-polish-design.md), gồm mục16 — E. Chấm slider thực hiện bằng [plan riêng](2026-11-02-home-hero-dots.md).

## Global Constraints

- Toàn bộ UI admin tiếng Việt; không đổi API identifier, tên riêng hoặc nội dung người dùng bằng dịch máy.
- Không còn marker demo trong UI hệ thống/seed mới/link được sinh; giữ nguyên văn bản người dùng và audit/snapshot lịch sử.
- Không thêm dependency/framework/backend endpoint; không Supabase, auth server, MFA, reset mật khẩu hay tracking thật.
- A–D chưa chọn. E chỉ đổi/xóa ảnh hồ sơ, không crop/editor/import CSV.
- Không reset DB, không đổi primary ID cũ; giữ custom role, counter, số phiếu, tiền, stock/reserved, Blob và references.
- VAT chỉ có/không; tổng phiếu = số lượng×đơn giá; phiếu không cập nhật kho; báo cáo loại phiếu hủy.
- Login local không bảo vệ API; ghi rõ giới hạn trong tài liệu kỹ thuật, không đặt credential hosting/người thật vào source.
- Contrast chữ thao tác bật đạt4.5:1; vùng chạm44px hoặc tương đương; light/dark, bàn phím, reduced motion.
- Nghiệm thu360/390/768/1024/1440px; không tràn ngang toàn trang. Public không có giá/cart và giữ font/ảnh/kính lúp3x/bidiary.
- Public initial gzip tăng≤10240bytes JS/≤2048bytes CSS so với `docs/admin-baseline.json`; admin/editor/chart/seed/gallery phải lazy.
- Local trước; không push/deploy trong plan này. Giữ lịch sử Git đã publish; đọc `docs/build-and-deploy.md` trước chạy/build.

## Review Focus

1. Session legacy/hỏng, account inactive, returnTo ngoài site và logout giữa tác vụ: về Login an toàn, không ghi muộn — Task1 và4.
2. DB cũ đã sửa một field, quota/partial migration và lazy seed lại: không ghi đè dữ liệu, đổi danh tính hay nhận nhầm custom record — Task2.
3. Alias phiếu cũ, trùng số phiếu, điều hướng A→B khi form đang tải: resolve đúng primary ID, không ghi nhầm bản ghi — Task3.
4. Ảnh giả MIME/lỗi decode/quá lớn, revision cũ, quota và đổi session: giữ ảnh cũ/draft, không orphan Blob hoặc mở rộng quyền — Task4.
5. Nhãn dài/tên trùng, portal dark/mobile/keyboard và component ít được dùng: đọc được metadata, không mất focus/draft hoặc đóng băng bảng — Task5–9.

---

## Cách chạy và chia file

Các lệnh dưới dùng Node24 trong PATH. `npm run test:admin -- <file...>` là targeted Vitest; test mới phải FAIL vì hành vi còn thiếu trước khi sửa rồi PASS sau. Lỗi CSS/position chỉ cần bằng chứng browser trước/sau có giá trị, không thêm test sao chép CSS. Mỗi task commit file đã review của chính task, không `git add .`.

Giữ vị trí feature hiện tại. File mới chỉ cho seam auth, migration trình bày, resolver phiếu, avatar profile và mapping nhãn component; không di chuyển toàn bộ thư mục `demo` chỉ để xóa tên nội bộ. Những file bổ sung trong lúc audit phải được ghi rõ cùng lỗi tái hiện trong biên bản.

### Task 1: Login có adapter và session hợp lệ

**Files:** Create `src/features/admin/accounts/auth/{contracts,local-service,return-to}.ts`, `tests/admin/{auth-service.test.ts,login.test.tsx,auth-fixtures.ts}`. Modify `services/context.tsx`, `accounts/pages/login.tsx`, `shell/admin-entry.tsx` trong feature admin; `tests/admin/session-sync.test.tsx` và các UI test đang tạo session legacy.

**Interfaces:** `AuthCredentials={username:string;password:string}`; `AuthSession=DemoSession` (giữ tương thích service hiện tại); `AuthService={login(credentials:AuthCredentials):Promise<AuthSession>;getSession():Promise<AuthSession|null>;logout():Promise<void>}`. `createLocalAuthService(store:AdminStore,ensureAccounts:()=>Promise<void>):AuthService`. Provider nhận `authFactory?:(store:AdminStore)=>AuthService`; runtime `login(credentials:AuthCredentials):Promise<void>`. `safeAdminReturnTo(value:unknown,basepath:string):string` trả pathname/search/hash nội bộ đã kiểm tra, fallback dashboard cùng basepath.

- [x] **RED:** Viết `rejects_invalid_credentials_without_storing_password`, `expires_legacy_and_inactive_sessions`, `restores_versioned_session`, `rejects_external_and_public_return_to`, `logout_cancels_pending_work`. Assertions: sai password không có session; legacy `{userId,roleId}` hết hạn nhưng DB giữ nguyên; envelope `{version:2,session}` restore; `//evil.test`, `https://evil.test`, `/contact`, URL encoded thoát admin → dashboard; `/~vhplasti/admin/sales/slips?year=2026` được giữ khi basepath `/~vhplasti`; logout làm generation tăng, query cũ bị hủy và mutation cũ không commit. Test Login Enter/hiện mật khẩu/lỗi vẫn giữ username.

  ```ts
  expect(safeAdminReturnTo("//evil.test", "/")).toBe("/admin/dashboard");
  expect(safeAdminReturnTo("/~vhplasti/admin/sales/slips?year=2026", "/~vhplasti")).toBe(
    "/~vhplasti/admin/sales/slips?year=2026",
  );
  await expect(auth.login({ username: "bibi.admin", password: "wrong" })).rejects.toThrow();
  expect(await auth.getSession()).toBeNull();
  ```

- [x] Chạy `npm run test:admin -- tests/admin/auth-service.test.ts tests/admin/login.test.tsx tests/admin/session-sync.test.tsx`; xác nhận FAIL đúng hành vi thiếu.
- [x] Implement adapter với fixture `bibi.admin` / `BibiLocal!2026`, map `user-1`, kiểm tra active account và role; không lưu password. Một key session version2, expire session legacy một lần; event storage phải đọc lại qua adapter, không tin JSON event. Provider có trạng thái khởi tạo, invalidate generation/cache trước đổi session, bỏ kết quả getSession/login cũ sau logout/đổi phiên. Login dùng adapter, safe returnTo, lỗi tiếng Việt; không account picker. Test helper inject adapter cho Viewer/Manager, không lách bằng session legacy.
- [x] Chạy lại targeted tests rồi toàn bộ `npm run test:admin`; cập nhật fixture của các UI test mà giữ assertions nghiệp vụ. Browser thử sai/đúng/reload/logout, inactive, deep link và basepath; kiểm tra không có credential trong log.
- [x] Commit: `feat(admin): add replaceable local login service`.

### Task 2: Seed có nội dung thực và migration không mất dữ liệu

**Files:** Create `src/features/admin/demo/{presentation-upgrade,legacy-presentation}.ts`, `tests/admin/presentation-upgrade.test.ts`. Modify `demo/registry.ts`, `products/{seed,stock-seed}.ts`, `content/seed.ts`, `accounts/seed.ts`, `sales/{business-seed,seed}.ts`, `analytics/seed.ts`, `settings/seed.ts`, `bookstore/seed.ts` nếu có marker hiển thị; `tests/admin/{seed,business-upgrade,integrity,orders}.test.ts` khi kỳ vọng số fixture thay đổi.

**Interfaces:** `upgradePresentation(store:AdminStore,entity:EntityKey):Promise<void>` chạy sau ensure dependency/group, trước trả dữ liệu cho UI. `legacyPresentationBaseline(entity:EntityKey,id:string):Readonly<Record<string,unknown>>|undefined` chỉ chứa baseline cũ đã biết; không import seed mới để giả baseline cũ. `seed(context?:{products?:AdminProduct[]}):SeedBatch` dùng thống nhất cho các factory cần sản phẩm. Tập seed-owned ID tường minh được xuất từ `products/seed.ts`, không regex nhận UUID của người dùng.

- [x] **RED:** `upgrades_only_unchanged_seed_fields`, `retries_without_overwriting_after_partial_failure`, `keeps_identity_snapshots_roles_and_blobs`, `does_not_claim_custom_product_as_seed`, `fresh_seed_uses_catalogue_and_blog`. Assertions: tên người dùng sửa giữ nguyên dù slug legacy chưa sửa được chuẩn hóa; chạy2 lần cùng kết quả; lỗi marker/quota rồi retry không nhân bản; audit/snapshot/counter/stock/Blob/custom role giữ bằng deep equality; product tự tạo không bị business seed nhận; fresh product/post tương ứng số phần tử thật, ảnh resolve đúng cả basepath, mọi reference tồn tại.

  ```ts
  expect(after.products.find((p) => p.id === "product-1")?.name).toBe("Tên tôi đã sửa");
  expect(after.purchaseSlips).toEqual(before.purchaseSlips);
  expect(after.audit).toEqual(before.audit);
  expect(after.customRoles).toEqual(before.customRoles);
  expect(afterSecondUpgrade).toEqual(after);
  ```

- [x] Chạy `npm run test:admin -- tests/admin/presentation-upgrade.test.ts tests/admin/seed.test.ts tests/admin/business-upgrade.test.ts`; ghi nhận FAIL trước sửa, phân biệt test count cũ với lỗi reference thật.
- [x] Seed mới lấy `getAllProducts()`/`getAllBlogPosts()` qua dynamic feature import; chuyển blog content sang document editor đã hỗ trợ, media URL nội bộ không tải lặp Blob. Giữ map slug→legacy product ID tường minh cho10 mẫu bản đồ đã khớp; các sản phẩm thật còn lại dùng ID ổn định từ slug. Không dùng index để gán lại danh tính DB cũ. Legacy sales/stock chọn từ các product thật đang có, không giả luôn có50 sản phẩm. Giữ lazy dependency và seed ownership an toàn.
- [x] Implement migration field-level với marker `presentation:<group>:v1`, transaction các entity liên quan; set marker sau commit, lỗi không chặn retry trong pending cache. Chỉ so/đổi field có baseline chính xác, không chạm audit/snapshot, không xóa synthetic record cũ hoặc sửa số tiền/kho. Slug legacy không map được chắc chắn đổi sang `san-pham-<id>`/`bai-viet-<id>` khi còn khớp baseline; tên trùng phân biệt bằng SKU/ID, không bịa quy cách. Khách/tài khoản tên hợp lý, contact chưa biết để trống hoặc domain example.test, không giả thông tin đã xác minh; visitor anonymousId dạng `VIS-001`, vẫn là fixture trong docs.
- [x] Chạy targeted + `tests/admin/integrity.test.ts tests/admin/orders.test.ts tests/admin/purchase-slips.test.ts`; PASS reference, fixture counts theo dataset thật và nghiệp vụ cũ. Browser kiểm tra DB mới và DB cũ đã sửa, mở product/post/khách/visitor, ảnh và tìm kiếm. Không reset DB thật để lấy ảnh pass.
- [x] Commit: `feat(admin): normalize seeded presentation without resetting records`.

### Task 3: URL phiếu dùng số phiếu, bảo toàn alias và draft

**Files:** Create `src/features/admin/sales/slip-route.ts`, `tests/admin/slip-route.test.ts`. Modify `sales/pages/{slips,slip-detail,slip-editor}.tsx`, `shell/{search-service,legacy-destination}.ts`, các nơi sinh link phiếu qua kết quả `rg 'slip-demo|sales/slips' src/features/admin src/routes`; giữ route files `src/routes/admin.sales.slips.$id{,.edit}.tsx`. Extend `tests/admin/business-review-regressions.test.tsx`.

**Interfaces:** `resolveSlipRoute(store:AdminStore,token:string):Promise<PurchaseSlip>` ưu tiên exact primary ID, nếu không có thì exact number duy nhất; missing/conflict là `ServiceError`. `slipRouteToken(slip:Pick<PurchaseSlip,'number'>):string` trả number. Query option/queryKey phải gồm token/session; form/service luôn nhận `resolved.id`, không truyền number làm ID update.

- [x] **RED:** `resolves_old_id_and_number_to_same_record` → `slip-demo-1` và `PMH-2026-0001` cùng primary ID; `rejects_duplicate_number` → conflict; `canonical_redirect_preserves_query` giữ returnTo/filter; `route_a_to_b_never_saves_a_draft_to_b` assert mỗi mutation nhận đúng ID và snapshot revision. Missing/resolve error không dựng form tạo mới.

  ```ts
  expect((await resolveSlipRoute(store, "PMH-2026-0001")).id).toBe("slip-demo-1");
  expect((await resolveSlipRoute(store, "slip-demo-1")).number).toBe("PMH-2026-0001");
  // Sau khi thêm fixture thứ hai có cùng number nhưng primary ID khác:
  await expect(resolveSlipRoute(store, "PMH-2026-0001")).rejects.toMatchObject({
    code: "conflict",
  });
  ```

- [x] Chạy `npm run test:admin -- tests/admin/slip-route.test.ts tests/admin/business-review-regressions.test.tsx`; xác nhận FAIL.
- [x] Implement resolver; sinh link canonical từ number và replace alias sau resolve. Giữ wrapper form key theo primary ID, không reset draft vì refetch hoặc thay alias cùng record. Cập nhật link trong search/dashboard/notification nếu có; không thay ID record, số phiếu hoặc lịch sử notification người dùng.
- [x] Targeted PASS; browser legacy detail/edit → canonical, Back/filter, reload, create→edit, missing/trùng number; từ A sang B nhanh và refetch lỗi không ghi nhầm hoặc mất draft. Kiểm tra lần nữa Lịch sử→Giao dịch legacy redirect không treo.
- [x] Commit: `fix(admin): use canonical purchase slip numbers in links`.

### Task 4: E — hồ sơ và ảnh đại diện lưu nguyên tử

**Files:** Modify `services/{contracts,entity-service,validation}.ts`, `demo/store.ts`, `accounts/profile-service.ts`, `settings/pages/profile.tsx`. Create `accounts/{profile-avatar.ts,profile-avatar.tsx,profile-form.tsx}`, `tests/admin/{profile-avatar.test.ts,profile-avatar-form.test.tsx}`; extend `tests/admin/{profile,media-atomic}.test.ts`.

**Interfaces:** `ProfileAvatar={blobKey:string;mime:string;size:number;width:number;height:number}`; `AdminUser.avatar?:ProfileAvatar|null`. `AvatarChange={kind:'keep'}|{kind:'replace';file:File}|{kind:'remove'}`. Extend `AdminBlobTransaction extends AdminTransaction` with `getBlob(key:string):Promise<Blob|undefined>`, `putBlob(key:string,value:Blob):Promise<void>`, `removeBlob(key:string):Promise<void>`; `AdminStore.transactionWithBlobs<T>(entities:EntityKey[],work:(tx:AdminBlobTransaction)=>Promise<T>):Promise<T>`. `saveProfile(store,session,values,revision,avatarChange:AvatarChange={kind:'keep'}):Promise<AdminUser>` retains the existing first4 argument types. `ProfileAvatar({user,size?}:{user:AdminUser;size?:number})` returns JSX, dùng chung trong Profile/footer/mobile.

- [x] **RED:** `viewer_can_change_own_avatar_without_content_permission`; `rejects_invalid_signature_decode_and_limits` với empty/GIF/SVG, MIME giả, 5MiB+1, 40.000.001pixel; `quota_conflict_and_logout_keep_previous_avatar` assert user/reference/oldBlob/audit giữ nguyên khi abort, generation đổi lúc decode/lưu hoặc revision stale; `replacement_removal_and_account_deletion_clean_only_owned_blob`; `generic_account_update_rejects_avatar_reference`. Ảnh hợp lệ5MiB/40.000.000pixel không bị loại chỉ vì chạm ngưỡng. Form `keeps_draft_after_failed_save` và `one_save_commits_name_email_avatar` assert một revision tăng, không autosave khi chọn/xóa.

  ```ts
  // Snapshot trước/sau transaction bị quota: không có partial write.
  expect(after.user).toEqual(before.user);
  expect(after.blobKeys).toEqual(before.blobKeys);
  expect(after.audit).toEqual(before.audit);
  // Save hợp lệ bằng Viewer của chính hồ sơ, không thêm quyền role:
  expect(saved.revision).toBe(before.user.revision + 1);
  expect(roleAfter).toEqual(roleBefore);
  ```

- [x] Chạy `npm run test:admin -- tests/admin/profile-avatar.test.ts tests/admin/profile-avatar-form.test.tsx tests/admin/profile.test.ts tests/admin/media-atomic.test.ts`; xác nhận FAIL đúng capability thiếu.
- [x] Chia sẻ transaction runner hiện có cho entity-only/withBlobs, giữ abort/storageError/generation; không nâng IDB version hoặc tạo store mới. Khi transaction có users, enlist blobs để `tx.remove('users',id)` chỉ xóa ảnh sở hữu đúng key prefix `profile-avatar:<userId>:` của user đó, không ảnh khác/media. Generic account create/update/bulk không nhận avatar field từ input. Profile service là nơi ghi reference được kiểm tra, không thêm quyền accounts/content cho Viewer.
- [x] Tái dùng `validateImageFile`, decode bằng createImageBitmap và close; chuẩn bị ảnh trước transaction rồi recheck actor/generation/revision trong transaction users/roles/audit/blobs. Ghi Blob key mới theo owner+UUID, sửa profile, dọn key cũ đúng chủ, audit metadata cùng commit. Không await decode trong transaction. Query avatar không đưa Blob vào localStorage, shared media hay audit bytes.
- [x] ProfileForm giữ draft name/email/avatar + snapshot revision, unsaved guard và một Lưu. Preview tròn/cover, Xóa ảnh về initials, lỗi không reset draft. Avatar component đọc Blob reference, fallback initials khi thiếu/lỗi; revoke ObjectURL trên đổi/cancel/unmount/logout và bỏ kết quả async cũ. Reload đọc persisted profile; invalidation sau save cập nhật mọi trigger.
- [x] Targeted PASS; browser chọn/preview/cancel/save/xóa/reload, ảnh không hợp lệ, error/quota có kiểm soát trong test DB, logout khi pending; kiểm tra object URL cleanup bằng regression test. Không dùng thư viện crop/upload hoặc endpoint.
- [x] Commit: `feat(admin): add atomic personal profile avatars`.

### Task 5: Menu gọn và nút dùng được ở mọi trạng thái

**Files:** Modify `shell/{navigation.ts,admin-layout.tsx}`, `shared/ui/primitives.tsx`, `admin.css`, `sales/components/void-slip.tsx`, `settings/pages/preferences.tsx`, `src/routes/admin.settings.security.tsx`; create `shell/account-menu.tsx`; extend `tests/admin/{business-navigation,shared-ui}.test.tsx` and create `tests/admin/account-menu.test.tsx`.

**Interfaces:** `AccountMenu({user,compact?}:{user:AdminUser;compact?:boolean})` consumes Task4 ProfileAvatar và runtime.logout Task1; shared trigger + Radix menu. Giữ Button variant API và resource keys/custom permission checks.

- [x] **RED:** Account menu chỉ có Hồ sơ/Đăng xuất, tên thật, fallback không hardcodeMN; Escape trả focus. Menu phẳng có4 link sản phẩm, active chính xác1 sibling; Viewer không thấy link vượt quyền. Button/link disabled hoặc loading không chạy action; void dialog chỉ submit1 lần, lỗi giữ lý do. Chạy `npm run test:admin -- tests/admin/account-menu.test.tsx tests/admin/business-navigation.test.tsx tests/admin/shared-ui.test.tsx` và xác nhận FAIL.
- [x] Tái hiện/screenshot màu Edit và hover Void light/dark trước sửa; ghi computed foreground/background và lỗi CSS specificity. Sửa anchor/button token scoped, variant normal/hover/active/focus không bị hover chung ghi đè. Edit primary; Void detail outline/tint danger, confirm destructive. Disabled/loading có semantics thật, không chỉ CSS.
- [x] Implement AccountMenu chung, footer đầy hàng actual name/avatar/role, desktop bỏ menu lặp; mobile có trigger khi drawer đóng, compact sidebar vẫn mở được. Quản lý sản phẩm→Danh sách sản phẩm/Thêm sản phẩm/Danh mục/Tồn kho; Khách hàng sang Kinh doanh. Security URL redirect Hồ sơ, bỏ fake MFA/reset/session-timeout UI, giữ reset nội bộ cho tests. Không thêm page thay thế rỗng.
- [x] Targeted PASS; browser keyboard/Escape/click ngoài/collision/mobile drawer, deep link/basepath, mọi Button variant light/dark. Đo contrast≥4.5:1 khi enabled, vùng chạm44px; verify Edit/Void thực tế không chỉ gallery. Không layout shift khi hover.
- [x] Commit: `fix(admin): refine navigation account menu and action states`.

### Task 6: Báo cáo đọc rõ, căn nhãn và khoảng cách thống nhất

**Files:** Modify `shared/charts/{chart,blocks}.tsx`, `sales/pages/reports.tsx`, `admin.css`; create `tests/admin/chart-labels.test.tsx`, extend `tests/admin/slip-report-ui.test.tsx`.

**Interfaces:** Extend existing `ChartPoint` bằng optional `reference?:string`; `name` là tên đầy đủ, reference là customerID/SKU. Giữ Chart signature và `unit:'VND'|'quantity'`; tooltip không parse chuỗi đã truncate. Không đổi report service/aggregate/schema.

- [x] **RED:** `distinguishes_equal_names_by_reference` dùng2 tên khách giống nhau/ID khác; `keeps_full_long_name_and_large_value` với tên dài>60 ký tự và1.234.567.890VND; `top_ten_does_not_limit_totals_table_or_export` có12 rows, chart10, CSV12 và tổng đủ12. Empty/error/filters giữ behavior. Chạy `npm run test:admin -- tests/admin/chart-labels.test.tsx tests/admin/slip-report-ui.test.tsx tests/admin/slip-reports.test.ts`, xác nhận FAIL phần trình bày thiếu.
- [x] Implement tick trái, cột label/trục bar ổn định; tên và metadata tách dòng, full tooltip/đơn vị/legend. Tại≤767px dùng ranked horizontal bars DOM từ cùng data để tên đọc được không cần hover; desktop giữ Recharts. Không cắt text bằng20 ký tự; CSS ellipsis desktop phải có tooltip/focus full label. No extra request hoặc aggregate mới.
- [x] Shared section rhythm32px desktop/24px mobile, sửa reports và page có section tương tự bằng class dùng chung, tránh margin rải rác. Bỏ DEMO badge và suffix demo của KPI; chỉ hiện delta khi có dữ liệu so sánh thật từ service hiện có, không thay bằng một KPI không có dữ liệu. Chart palette/text/empty/light-dark đồng bộ.
- [x] Targeted PASS; browser360/390/768/1024/1440, tên trùng/dài, số lớn/0, năm/khách, empty/reload, tooltip/legend và7 loại chart. Screenshot full report xác nhận nhãn trái, bar/value không đè chữ, section Tổng kết sản phẩm có khoảng thở. Console không có freeze/update-depth errors.
- [x] Commit: `fix(admin): align readable report labels and section spacing`.

### Task 7: Tiếng Việt và audit32 ví dụ hành động/biểu mẫu

**Files:** Create `src/features/admin/components/labels.ts`, `docs/admin-component-audit.md`; modify `src/features/admin/components/{page,example,actions,forms}.tsx`, `components/usage.ts`, `analytics/aggregate.ts`, `accounts/permissions.ts`, `products/config.tsx`, `content/config.tsx`, `customers/config.tsx`, `shared/charts/blocks.tsx` và các copy runtime trong feature admin tìm được qua `rg -n -i 'demo|mẫu|active|inactive|published|draft|hidden' src/features/admin`; extend `tests/admin/component-docs.test.ts`, create `tests/admin/presentation-copy.test.ts`.

**Interfaces:** `componentLabel(key:string):string` trong `src/features/admin/components/labels.ts`; map đủ96 key hiện tại sang nhãn Việt, giữ internal catalogue key/routes. Example có `data-component=<stable key>` để audit. Không import catalogue vào shell/public. Date preset tính từ đồng hồ thực theo ngày Việt Nam, không dựa DEMO_NOW; fixture analytics vẫn ghi rõ trong docs.

- [x] **RED:** `translates_all_96_component_labels_without_changing_keys` assert tổng96 và không thiếu mapping; `runtime_copy_has_no_demo_markers` chỉ quét string UI/seed do hệ thống sở hữu, cho phép user text/audit/code API identifiers; `today_preset_uses_current_vietnam_day` freeze thời gian `2026-11-02T18:00:00Z`, Hôm nay là03/11 tại Việt Nam, không ngày fixture. Chạy các test mới, ghi nhận FAIL trước sửa.

  ```ts
  vi.setSystemTime(new Date("2026-11-02T18:00:00Z"));
  expect(presetRange("today")).toEqual({
    start: "2026-11-02T17:00:00.000Z",
    end: "2026-11-03T17:00:00.000Z",
  });
  expect(Object.values(componentCatalogue).flat()).toHaveLength(96);
  ```

- [x] Xóa/đổi copy ở login/layout/footer/search/toast/error/empty/aria/title/settings và component snippets; áp dụng nhãn status đúng spec, không đổi enum/nghiệp vụ. Bỏ lựa chọn ngôn ngữ giả khi chỉ có tiếng Việt; giữ theme thật. Role display tiếng Việt nhưng không đổi permission keys. Credentials local chỉ mô tả trong docs, không banner demo UI.
- [x] Tạo inventory96 dòng từ catalogue với nhóm/tên/path/steps/expected/observed/theme/viewport/evidence/status, khởi đầu chưa kiểm tra. Mở và thao tác riêng8 hành động+24 biểu mẫu: disabled/loading/copy error, required/invalid, select/multi/combobox/autocomplete/date/time, upload/image, keyboard. Ghi lỗi trước sửa; fix shared nguyên nhân trong file sở hữu; regression test logic mới có assertion, không test CSS mirror.
- [x] Targeted PASS + browser các ví dụ32 và page tiêu thụ liên quan, ít nhất light/dark/keyboard/mobile. Dòng chưa chạy giữ pending/blocked, không đánh pass cả nhóm từ screenshot. Một ví dụ chỉ được pass khi đủ trạng thái đã áp dụng cho nó.
- [x] Commit: `fix(admin): localize interface and verify action form examples`.

### Task 8: Audit45 ví dụ hiển thị/điều hướng/overlay

**Files:** Modify `components/{data-display,navigation,overlays}.tsx`, shared primitive/table/form và page tiêu thụ chỉ khi lỗi đã tái hiện; update `docs/admin-component-audit.md`; extend `tests/admin/{data-table,nested-routes,notification-popup,edit-snapshot}.test.tsx` cho regression có liên quan.

**Interfaces:** Giữ contracts TableState/record snapshot/UnsavedGuard/Modal/ActionMenu hiện có; không tạo primitive thay thế song song. Mọi thay đổi contract phát hiện trong audit phải cập nhật test và caller ngay trong task.

- [x] RED khi có lỗi logic: ghi tên test, input, expected/actual vào biên bản trước sửa rồi chạy targeted xác nhận FAIL. Ví dụ bắt buộc giữ: sort/filter/paging/selection phản hồi được sau đổi trang; refetch lỗi không mất draft; thông báo click vừa mark read vừa mở đúng link; nested portal không mất focus hoặc sai theme.
- [x] Thao tác đủ18 hiển thị+17 điều hướng+10overlay: avatar/badge/tooltip/progress/skeleton/empty/preview, table dài, tree/tabs/accordion/stepper/breadcrumb, dropdown/popover/drawer/dialog/confirmation; open/close/Escape/focus return/scroll collision/pending/error và disabled. Không xem component tĩnh như có chức năng chưa có.
- [x] Fix nguyên nhân đã xác nhận trong shared hoặc example/caller đúng nơi; quét các consuming page cùng primitive. Kiểm tra dirty guard không mất form khi overlay đóng hoặc route đổi; không đổi flow nghiệp vụ để né lỗi.
- [x] Chạy targeted regression liên quan và browser45 examples, light/dark, keyboard, mobile; evidence riêng từng dòng. Kiểm tra lại route legacy Lịch sử→Giao dịch và table sorting không freeze.
- [x] Commit: `fix(admin): verify data navigation and overlay components`.

### Task 9: Audit19 ví dụ phản hồi/biểu đồ và nghiệm thu tích hợp

**Files:** Modify `components/{feedback,charts}.tsx` và shared owner khi lỗi xác nhận; update `docs/{admin-component-audit,admin,admin-acceptance,build-and-deploy}.md`; targeted tests mới chỉ cho regression logic đã tái hiện.

**Interfaces:** Không thêm API; dùng Chart/ChartPoint Task6, AuthService Task1, profile Task4. Bộ audit phải có đúng96 dòng, không trùng key và không bỏ example trong từng nhóm.

- [x] Reproduce rồi sửa mọi lỗi còn lại trong12 feedback+7charts, từng ví dụ toast/banner/alert/dismiss/retry/loading/aria-live, success/error thật; unit/legend/tooltip/empty/resize/reduced motion. Test logic mới phải RED→GREEN theo các bước đã áp dụng Task7–8.
- [x] Hoàn tất từng dòng audit96: đủ steps/expected/observed/evidence; không còn failed/pending mà vẫn tuyên bố hoàn tất. Nghiệm thu page Login/dashboard/khách/products/slip list-detail-create-edit/reports/profile và7 nhóm tại360/390/768/1024/1440, light/dark/keyboard; no global overflow, no console crash, no missing images. Nếu có lỗi mới, tái hiện/sửa/regression rồi kiểm tra lại vùng liên quan.
- [x] Chạy `npm run check`, `npm run build`, `node scripts/admin-bundle-report.mjs`; yêu cầu exit0 và public gzip delta so baseline JS≤10240/CSS≤2048. Mở artifact thực bằng `node scripts/preview.mjs <đường dẫn .releases/local-SHA vừa tạo>` theo build output, kiểm tra FE/API version cùng release, reload deep links/basepath và public catalogue. Không dùng screenshot mockup làm bằng chứng build.
- [x] Viết báo cáo acceptance chỉ điều đã chạy, phân biệt automated/browser/local/live. Docs hướng dẫn3 lệnh dev/check/build, fixture credential, auth adapter seam và giới hạn IndexedDB/front-end auth, profileảnh, migration/legacylinks; giữ production status cũ chưa phát hành. Ghi không làm A–D, không deploy, và điểm còn thiếu nếu có.
- [x] Self-review diff, `git diff --check`; commit `docs(admin): record verified interface acceptance`. Sau khi triển khai xong yêu cầu final independent review theo phương thức Native đã chọn, xử lý finding và chạy lại kiểm tra bị ảnh hưởng trước bàn giao; không push/deploy nếu chưa có lệnh riêng.

## Tự review plan và bàn giao

Đã đối chiếu spec1–10/12–16 vào Task1–9; mục11 vào plan hero độc lập. Năm Review Focus có regression/acceptance ở task sở hữu; avatar reference không đi qua generic CRUD, profile không cần Content:update, alias form giữ primary ID. Không thay authentication/backend thật hoặc số liệu lịch sử để làm UI trông thật hơn.

Phương thức dự kiến giữ **Native**: triển khai trong session theo `superpowers:executing-plans`, review độc lập cuối đợt. **Plan đã được duyệt và triển khai local; giữ nhánh để người dùng review kết quả.**

Nghiệm thu đã thực hiện local,131 tests/96 ví dụ; xem docs/superpowers/reports/2026-11-02-admin-ui-polish-acceptance.md. Một review độc lập và một fix pass hoàn tất; giữ branch để review, không push/deploy. Các checkbox phản ánh kết quả theo biên bản, gồm giới hạn browser đã ghi rõ.
