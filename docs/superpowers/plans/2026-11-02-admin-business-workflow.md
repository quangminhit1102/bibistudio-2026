# BiBi Admin Business Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chỉnh admin demo thành quản lý khách mua hàng/phiếu/báo cáo đúng nghiệp vụ, một trang khách truy cập và popup thông báo sát chuông; giữ dữ liệu cũ và kiểm chứng local thực tế.

**Architecture:** Reuse admin lazy routes, shared forms/table, Query và IndexedDB; tạo customers/purchaseSlips/notificationReads thay vì đổi nghĩa records legacy. Phiếu có service nghiệp vụ riêng cho snapshot, tính tổng, số phiếu và hủy; report/dashboard dùng chung aggregate. Một plan vì data upgrade, quyền, route, dashboard và cache dùng chung; các task vẫn có deliverable/test riêng.

**Tech Stack:** React19, TypeScript, TanStack Router/Query/Table, Tailwind4, Radix, Recharts, Zod, idb; Vitest5/jsdom/fake-indexeddb. Giữ Node24/Express/cPanel tooling hiện tại.

**Spec:** `docs/superpowers/specs/2026-11-01-admin-business-workflow-design.md` — người dùng đã duyệt, gồm bốn quy tắc ở mục 3.

## Global Constraints

- VAT chỉ là nhãn “Có VAT / Không VAT”, không tính thuế; total = tổng quantity × unitPrice, VND nguyên không âm và không vượt safe integer.
- Doanh thu ghi nhận lấy phiếu saved, loại void, không diễn đạt tiền đã thu; phiếu không đổi stock/reserved.
- Giữ nguyên DB `bibi-admin-demo` và dữ liệu legacy; upgrade không reset, không tự chuyển đơn/sách cũ thành phiếu.
- Không thêm dependency/app/cloud/MySQL/auth/tracking thật; không tạo log cho mỗi click; public catalogue vẫn không có giá/cart hoặc writeback.
- Khách truy cập một trang; thông báo popup bám chuông trên cả desktop/mobile, không notification page/bottom sheet.
- Dùng basepath `/` và `/~vhplasti`; CSS `.admin-root`, lazy module/chart/editor/seed, không import admin vào public entry.
- Giữ budget public so với baseline gốc trong `docs/admin-performance.json`: gzip JS tăng tối đa 10,240 bytes, CSS tối đa 2,048 bytes; không cộng lại budget cho mỗi task.
- Local review; không push/merge/deploy. Không force push/rebase/amend lịch sử đã push. Commit task đã kiểm chứng, không gom file không liên quan.
- Đọc `docs/build-and-deploy.md` trước dev/build/preview. Windows: nếu test/socket/junction bị sandbox chặn, chạy lại đúng command với escalation, không báo pass từ lượt bị chặn.

## Review Focus

1. Hai tab cùng tạo phiếu hoặc retry sau lỗi: số phiếu duy nhất, không dùng lại số đã hủy; cả phiếu/counter/audit cùng commit hoặc cùng rollback — Task 3.
2. Refetch khi đang sửa hoặc đổi tên/giá/VAT trong danh mục: không mất bản nháp, không sửa snapshot phiếu cũ; chủ động đổi khách mới reset VAT — Tasks 3–4.
3. Logout/đổi user lúc mark-read hoặc mark-all pending: không ghi receipt sai user hoặc để badge cũ; lỗi lưu phải rollback UI — Task 7.
4. DB v1 còn tab mở, seed bị ngắt, quota lỗi: upgrade không reset/custom-role overwrite, retry không nhân bản, không seed legacy từ đường gọi tồn kho — Task 1.
5. URL cũ, tên trùng, năm sát mốc UTC, danh sách nhiều hơn một trang: không gộp nhầm ID, không thiếu tổng/CSV, Back/deep-link giữ filter và basepath — Tasks 2, 5, 6, 8.

## File structure and common contracts

- `services/contracts.ts`: thêm Customer/PurchaseSlip/SlipItem/NotificationRead và EntityKey mới, giữ models legacy.
- `demo/store.ts`, `demo/registry.ts`, new `sales/business-seed.ts`, new `products/stock-seed.ts`: DB v2, nhóm seed business và stock độc lập legacy.
- `customers/config.tsx`, `customers/pages/{list,editor,detail}.tsx`: module khách theo shared editor và route riêng.
- `sales/{slip-schema,slip-service,slip-aggregate}.ts`, `sales/components/slip-form.tsx`, `sales/pages/{slips,slip-editor,slip-detail,reports}.tsx`: nghiệp vụ phiếu/UI/report.
- `analytics/{visitor-service.ts,components/visitor-dialog.tsx,pages/visitors.tsx}`: một list và dialog phiên.
- `notifications/{service.ts,hooks.ts,header-menu.tsx}`: read receipts theo user, Query cache/optimistic, Radix Popover.
- `shell/navigation.ts`, `shell/global-search.tsx`, new `shell/legacy-destination.ts`, các route adapters: menu/search/aliases.
- Tests mới nằm `tests/admin/`; giữ các tests legacy nếu legacy service còn tồn tại, thay expectations của UI/routes đã được user thay thế; không xóa test chỉ để xanh.

Các model mới dùng BaseRecord hiện có. Customer fields: name, kind (`bookstore|individual|company`), address, vatApplied, notes, active, phone/email tùy chọn. PurchaseSlip fields: number, customerId, customerSnapshot `{name,address,kind}`, vatApplied, items, total, notes, status (`saved|void`), voidedAt (`string|null`), voidReason. SlipItem: lineId, productId, sku, name, quantity, unitPrice. NotificationRead: userId, notificationId, readAt.

Giữ resource key `bookstore` cho customers, sales cho purchaseSlips, notifications cho receipts. Generic EntityService chỉ đọc/export phiếu/receipt, không cho generic create/update/remove/bulk vượt service nghiệp vụ. Các service custom nhận `(store: AdminStore, session: () => DemoSession|null)` và dùng authorizeOperation/generation/revision trong transaction.

## Execution preflight

- [ ] Reuse managed worktree `C:/Users/Admin/.codex/worktrees/fullstack-cicd/bibistudio-2026`, branch `codex/admin-dashboard`; inspect status and applicable worktree skill before execution, without resetting existing changes or creating another unnecessary checkout.
- [ ] Preserve existing uncommitted table fix: `src/features/admin/shared/tables/data-table.tsx`, `tests/admin/history-responsiveness.test.tsx`, `docs/superpowers/reports/2026-11-01-admin-history-freeze-repro.md`. Prior report contains actual red/green and browser evidence. Run `npm run test:admin -- tests/admin/history-responsiveness.test.tsx tests/admin/data-table.test.tsx`, expect both pass; then commit only these three files as `fix(admin): prevent client table sorting update loops` before task commits depend on the fix. Do not revert the working fix merely to repeat a known browser hang.

## Task 1: Nâng cấp DB và bộ dữ liệu business không mất dữ liệu

**Files:** Modify `src/features/admin/services/{contracts,validation,entity-service}.ts`, `src/features/admin/demo/{store,registry}.ts`, `src/features/admin/accounts/permissions.ts`, `src/features/admin/services/context.tsx`; create `src/features/admin/sales/business-seed.ts`, `src/features/admin/products/stock-seed.ts`, `tests/admin/business-upgrade.test.ts`, `tests/admin/business-fixtures.ts`; adjust `tests/admin/seed.test.ts`, `tests/admin/reset-race.test.ts` when asserting registry groups.

**Interfaces:** Preserve AdminStore API. Extend `createAdminStore(name?: string, options?: {onBlocked?: () => void}): AdminStore`; callback exposes upgrade-blocked state to AdminProvider. New seed `seed(context?: {products?: AdminProduct[]}): SeedBatch`; registry supplies products only to business. Test helper `businessFixture(name: string): Promise<{store:AdminStore, session:DemoSession, customerId:string, productId:string}>` opens isolated DB, ensures users/products/business and returns existing active IDs. Close/destroy only isolated test DB in cleanup.

- [ ] **1. Write red tests:** `upgrades v1 without losing custom product/post/blob/profile/roles/legacy orders` compares exact old records and Blob bytes after reopening v2; `blocked upgrade is visible and resumes after old connection closes`; `seed retry keeps 12 customers and 30 slips without duplicates`; `stock access never initializes legacy books/orders`; reset tests confirm full demo reset remains explicit, and quota abort leaves no success marker. Use idb `openDB` to create actual v1 fixture, not a mock of upgrade logic.

  Core assertions after opening the upgraded fixture and retrying business seed:

  ```ts
  expect(await store.get("products", "custom-1")).toEqual(beforeProduct);
  expect(await store.list("customers")).toHaveLength(12);
  expect(await store.list("purchaseSlips")).toHaveLength(30);
  ```

- [ ] **2. Run red:** `npm run test:admin -- tests/admin/business-upgrade.test.ts`. Expected missing new stores/contracts or new assertions failing, not a configuration/import typo.
- [ ] **3. Implement upgrade/models:** version 2 creates only missing stores, preserves meta/blobs and legacy stores. Add schemas/entity permission maps and deny generic writes for slips/receipts. Bridge blocked callback to visible admin storage message. Keep custom roles unchanged. Optional customer email validates format without importing the global users-email uniqueness restriction.
- [ ] **4. Implement seed groups:** business depends on products, creates 12 synthetic customers/30 saved-or-void slips over several months/years with VAT both ways and correct snapshots/totals. Seed counter in settings with key `purchase-slip-counter:<year>` and numeric `values.next`. Give business its own `seed:business:v2` marker; lazy factory imports only when needed. Add independent stock seed group; active stock/product-delete flows must not ensure legacy orders/books. Seed writes idempotent, marker only after successful records; retries do not overwrite user edits. Receipts start empty, mapped to system seed safely. Legacy groups remain readable but not active dependencies.
- [ ] **5. Run green:** targeted upgrade/seed/reset tests plus `node node_modules/typescript/bin/tsc --noEmit`; expect all pass, no manual DB reset. Check inventory existing tests because stock bootstrap changed.
- [ ] **6. Commit:** stage this task's source/tests only; `git commit -m "feat(admin): upgrade business data without resetting legacy records"`.

## Task 2: Khách mua hàng và form riêng

**Files:** Create `src/features/admin/customers/config.tsx`, `src/features/admin/customers/pages/{list,editor,detail}.tsx`, `src/routes/admin.customers.tsx`, `src/routes/admin.customers.create.tsx`, `src/routes/admin.customers.$id.tsx`, `src/routes/admin.customers.$id.edit.tsx`, `tests/admin/customers.test.tsx`; modify `services/validation.ts`, `shared/entity-manager.tsx`, `shared/record-editor.tsx` only for explicit archive/return-query needs.

**Interfaces:** Export `customerConfig: EntityConfig<"customers">` consumed by customer pages. Generic customer service via `runtime.service("customers")`; `active=false` replaces destructive delete UI. Return URL search type `returnTo?: string`, accepted only if it resolves to the customers list under admin; never use an arbitrary/external return URL. Editor uses `RecordEditor` snapshot/unsaved guard, `listHref` includes validated return query.

- [ ] **1. Write red:** `creates edits and deactivates a customer via dedicated pages`; `same name and same optional contact email do not merge records`; `referenced customer cannot be deleted`; `viewer cannot write and inactive customer remains filterable`; `Back/Cancel preserves q/kind/VAT/page`. Assert form kind has three choices, VAT checkbox persists and cancel leaves record unchanged.

  Core assertions after creating two same-named customers and opening the first customer's form:

  ```ts
  expect(first.id).not.toBe(second.id);
  expect(screen.getByRole("checkbox", { name: "Áp dụng VAT" })).toBeChecked();
  ```

- [ ] **2. Run red:** `npm run test:admin -- tests/admin/customers.test.tsx tests/admin/nested-routes.test.tsx`.
- [ ] **3. Implement:** config fields name/kind/address/VAT/notes/phone/email/active; list ID/name/kind/address/VAT/status and dedicated create/detail/edit links. Name/kind required, address optional. Hide Delete/bulk-delete for customers; offer Ngừng sử dụng/Đang sử dụng via validated active updates; service blocks hard delete when referenced by a slip. Detail includes filtered customerId slip links. Use RouteLeaf/Outlet to avoid swallowed nested forms. Keep data operations typed, no handwritten localStorage CRUD.
- [ ] **4. Verify green:** targeted tests and TypeScript. Customer label in new module is “Khách mua hàng”; old sidebar removal waits Task 8. Keyboard labels, loading/error and no-write Cancel included in UI tests.
- [ ] **5. Commit:** `feat(admin): manage customer accounts with dedicated forms`.

## Task 3: Service phiếu atomic, snapshot và số phiếu

**Files:** Create `src/features/admin/sales/slip-schema.ts`, `src/features/admin/sales/slip-service.ts`, `tests/admin/purchase-slips.test.ts`; modify `services/validation.ts`, `services/entity-service.ts`, `sales/business-seed.ts` only to share normalization/integrity rules.

**Interfaces:** `SlipDraft = {customerId:string; vatApplied:boolean; notes:string; items:{lineId:string;productId:string;quantity:number;unitPrice:number}[]}`; export `calculateSlipTotal(items: Pick<SlipItem,"quantity"|"unitPrice">[]): number`; `createSlipService(store,session,clock?:()=>Date)` returns `{create(input:SlipDraft):Promise<PurchaseSlip>; update(id:string,input:SlipDraft,revision:number):Promise<PurchaseSlip>; void(id:string,reason:string,revision:number):Promise<PurchaseSlip>}`. Read/list/export uses generic read service. Counter uses settings record from Task 1 inside the same purchaseSlips/settings/audit/customers/products transaction, with format `PMH-<Vietnam year>-<4-or-more digits>` and no reuse.

- [ ] **1. Write red:** qty 2 × 10000 + qty 3 × 5000 gives total 35000 with VAT either true/false; reject empty, NaN, negative/fraction qty, duplicate productId and unsafe multiplication/sum. Reject inactive customer on create and missing products. Test two service instances concurrently create distinct numbers, failed audit/counter transaction creates neither slip nor consumed number, void excludes edits and never reuses number. Assert stock/reserved and legacy payments unchanged.

  Core arithmetic and concurrent create assertions (service instances share the same isolated DB):

  ```ts
  expect(
    calculateSlipTotal([
      { quantity: 2, unitPrice: 10000 },
      { quantity: 3, unitPrice: 5000 },
    ]),
  ).toBe(35000);
  expect(new Set(created.map((slip) => slip.number)).size).toBe(2);
  ```

- [ ] **2. Run red:** `npm run test:admin -- tests/admin/purchase-slips.test.ts tests/admin/integrity.test.ts`.
- [ ] **3. Implement service:** validate draft, active session/grants, current revision, load referenced records in transaction, calculate total, generate number/snapshot/audit and commit atomically. On update keep number/createdAt; keep snapshots for same customer/lineId+productId, refresh only when customer/product selection explicitly changes. Existing inactive references are allowed unchanged when editing an old slip, new inactive selections rejected. Void requires reason/update permission and saved status; no restore/hard-delete route. Block deleting referenced products in generic integrity checks without lazy-seeding legacy orders.
- [ ] **4. Pin snapshot races:** `rename customer/change VAT/product price after creating slip keeps old snapshots`; `switch customer refreshes snapshot and submitted VAT`; `stale revision rejects without audit/counter side effect`; `session generation change aborts`; same-named products aggregate separately later. Run targeted services/inventory/reset tests; expect pass and TypeScript clean.
- [ ] **5. Commit:** `feat(admin): save purchase slips atomically with historical snapshots`.

## Task 4: Trang danh sách, tạo/sửa và chi tiết phiếu

**Files:** Create `sales/components/slip-form.tsx`, `sales/pages/{slips,slip-editor,slip-detail}.tsx`, `src/routes/admin.sales.slips.tsx`, `src/routes/admin.sales.slips.create.tsx`, `src/routes/admin.sales.slips.$id.tsx`, `src/routes/admin.sales.slips.$id.edit.tsx`, `tests/admin/purchase-slip-form.test.tsx`; modify `src/features/admin/admin.css` and existing shared primitives only when reusable.

**Interfaces:** `SlipForm({initial?:PurchaseSlip; customers:Customer[]; products:AdminProduct[]; onSave:(draft:SlipDraft)=>Promise<void>; onCancel:()=>void})`. Editor calls Task 3 service; initial snapshot captured once per record ID/revision, refetch does not rewrite dirty form. List supports customer/date/VAT/status/search and generic readonly service data, but own Xem/Sửa/Hủy actions (never generic mutation).

- [ ] **1. Write red:** selecting customer sets VAT once; manual override survives refetch; explicit switch customer changes VAT; adding existing product focuses its current row; two products/save yields 35000, refresh/detail matches snapshots; invalid qty and save failure retain edits; dirty Cancel asks confirmation; read-only/void hides edit actions. Verify safe return URL and list filters after Save/Cancel.

  Core assertions after entering the Task 3 quantities/prices and saving:

  ```ts
  expect(screen.getByText(/35\.000\s*₫/)).toBeInTheDocument();
  expect(saved.total).toBe(35000);
  expect(saved.customerSnapshot.name).toBe(originalCustomerName);
  ```

- [ ] **2. Run red:** `npm run test:admin -- tests/admin/purchase-slip-form.test.tsx tests/admin/edit-snapshot.test.tsx`.
- [ ] **3. Implement UI:** date/time readonly, searchable customer/product pickers, default admin price only for new lines, VAT override label/reset, quantity/price editable and line/total readonly. Separate Cancel form from Hủy phiếu confirmation/reason; show pending/error/retry, prevent double save. Desktop table and mobile cards with numeric keyboards, 44px delete target; do not obstruct inputs with sticky summary when keyboard appears. Use current unsaved guard, optimistic revision and query invalidations (slips/customer detail/report/dashboard). No shipping/payment/discount controls.
- [ ] **4. Verify green:** targeted UI tests and TypeScript; test draft cancellation versus saved-slip void as separate actions. Test dedicated nested routes through RouteLeaf; saved/void detail remains reloadable. Print with browser print styles/CSV using existing utilities only.
- [ ] **5. Commit:** `feat(admin): add responsive purchase slip pages`.

## Task 5: Báo cáo theo khách/sản phẩm và dashboard cùng dữ liệu

**Files:** Create `sales/slip-aggregate.ts`, `tests/admin/slip-reports.test.ts`, `tests/admin/slip-report-ui.test.tsx`; modify `sales/pages/reports.tsx`, `dashboard/service.ts`, `dashboard/pages/dashboard.tsx`, `analytics/hooks.ts`, `tests/admin/dashboard-access.test.ts`.

**Interfaces:** `SlipReportFilter={year:number;customerId?:string}`; `SlipSummary={count:number;voidCount:number;total:number;byCustomer:{id:string;name:string;count:number;value:number}[];byProduct:{id:string;sku:string;name:string;quantity:number;value:number}[];trend:{name:string;value:number}[]}`. Export `yearRange(year:number):DateRange`, `summarizeSlips(slips:PurchaseSlip[],range:DateRange,customers:Customer[],products:AdminProduct[],customerId?:string):SlipSummary`, `loadSlipReport(store,session:DemoSession|null,filter:SlipReportFilter):Promise<SlipSummary>`. `total/count/by*` exclude void; voidCount reports excluded slips in the selected scope. Labels use current entity name with snapshot fallback, grouping always by ID.

- [ ] **1. Write red:** include timestamp `2026-12-31T17:00:00Z` in Vietnam year 2027, exclude from 2026; include `2026-12-31T16:59:59Z` in 2026; void ignored; same product name with two IDs stays two rows; same product at different prices sums quantity/value; multiple pages (>200 slips) still sum all; expect sum(byCustomer.value) = sum(byProduct.value) = total, VAT unchanged. Filter customer including inactive and unknown ID (empty result).

  Core range and full-dataset total assertions:

  ```ts
  expect(yearRange(2027).start).toBe("2026-12-31T17:00:00.000Z");
  expect(report.byProduct.reduce((total, row) => total + row.value, 0)).toBe(report.total);
  ```

- [ ] **2. Run red:** `npm run test:admin -- tests/admin/slip-reports.test.ts tests/admin/slip-report-ui.test.tsx tests/admin/dashboard-access.test.ts`.
- [ ] **3. Implement aggregate and UI:** read all permitted rows (store list in service, not UI table page), shared year/customer query validation, default actual Vietnam current year; available years include data/current. Two report sections, horizontal Top 10 charts clearly labeled and full paged tables/CSV; product chart metric switch quantity/value. One filtered dataset for chart/table/KPI/export, no random seed KPIs. Non-numeric/unsupported query year falls back safely, no NaN date range.
- [ ] **4. Replace dashboard dependencies:** use summarizeSlips for sales cards/trend/recent/bestsellers, show Phiếu mua hàng and Doanh thu ghi nhận, omit fake paid/shipping state panels; conversion displays “Chưa có dữ liệu liên kết”. Preserve other panels and permission gating of raw data. Keep DateRange dashboard interface; no ensure orders/books. Shared notification read display is integrated in Task 7.
- [ ] **5. Run green:** targeted report/access tests and TypeScript. Test CSV uses entire filtered set and Top 10 never truncates exported rows; URL year/customer survives reload, no global viewport overflow.
- [ ] **6. Commit:** `feat(admin): report recorded sales by customer and product`.

## Task 6: Một trang khách truy cập và chi tiết phiên cùng trang

**Files:** Create `analytics/visitor-service.ts`, `analytics/components/visitor-dialog.tsx`, `tests/admin/visitors-page.test.tsx`; modify `analytics/pages/visitors.tsx`, `src/routes/admin.analytics.visitors.tsx`, `src/routes/admin.analytics.visitors.$id.tsx`, `src/routes/admin.analytics.{index,overview,sessions,pages,traffic-sources}.tsx`.

**Interfaces:** `listVisitorSessions(store,session,visitorId:string,input:ListInput):Promise<ListResult<VisitorSession>>` checks analytics:view and filters visitorId before paging. `VisitorDialog({visitorId:string;onClose:()=>void})`. Visitors route validates optional `visitor` search; old `/visitors/$id` replaces URL with `/visitors?visitor=<id>` under router basepath.

- [ ] **1. Write red:** desktop columns include ID/IP/location/device–OS/browser/sessions; select visitor opens same-page dialog, Back/Escape closes; 250 sessions page correctly with no >200 truncation; invalid/deleted visitor shows a recoverable dialog error without breaking list; Viewer read is allowed only with analytics:view. No click tracking or geo requests.

  Core assertions for an isolated visitor fixture with 250 sessions, request page 2 of size 100:

  ```ts
  expect(result.total).toBe(250);
  expect(result.items).toHaveLength(100);
  expect(screen.getByRole("dialog")).toBeVisible();
  ```

- [ ] **2. Run red:** `npm run test:admin -- tests/admin/visitors-page.test.tsx tests/admin/routing.test.ts`.
- [ ] **3. Implement:** preserve current fake/masked IP and dataset label; combine device–OS and city/country; mobile cards expose remaining fields in dialog. Show session timestamps/entry/exit/source/page count, not click timeline. Derive optional “Sản phẩm đã xem” only from existing demo session product paths resolving actual catalogue slugs; deduplicate and label viewed, never create events or infer customer identity. All other analytics routes redirect visitors, retaining only supported search parameters; no menu page for sessions.
- [ ] **4. Verify green:** targeted tests and TypeScript. Test 375px accessible detail trigger, loading/empty/error and reopen dialog without stale visitor data. Confirm query `visitor` isn't dropped by table search/page updates.
- [ ] **5. Commit:** `feat(admin): consolidate visitor analytics into one page`.

## Task 7: Thông báo popup và read receipts theo tài khoản

**Files:** Create `notifications/service.ts`, `notifications/hooks.ts`, `tests/admin/notification-service.test.ts`, `tests/admin/notification-popup.test.tsx`; modify `notifications/header-menu.tsx`, `dashboard/service.ts`, `dashboard/pages/dashboard.tsx`, `shell/admin-layout.tsx`, `services/context.tsx` where query cleanup needs receipt keys; scoped admin CSS.

**Interfaces:** `NotificationView=Notification & {isRead:boolean}`; `loadNotifications(store,session:DemoSession|null,input:{page:number;pageSize:number}):Promise<ListResult<NotificationView>&{unreadCount:number}>`; `markNotificationsRead(store,session:DemoSession|null,ids:string[]|"all"):Promise<void>`. Receipt ID encodes the userId/notificationId pair unambiguously; `isRead = notification.read || receiptExistsForUser`. `useNotifications()` returns paged data/count and pending/read/read-all handlers; keys start `['bibi-admin','notifications',session.userId,...]`.

- [ ] **1. Write red:** A reads false-default notification → A read/B unread after reopen; legacy true default stays read for both; Viewer with view but no update can read own receipt and cannot mutate content/href/another user. Mark-all affects every row, not page; duplicate calls idempotent; session/generation changed mid-flight writes nothing for stale user.

  Core assertions after markNotificationsRead for user A and independent reloads for A/B:

  ```ts
  expect(forA.items.find((n) => n.id === notificationId)?.isRead).toBe(true);
  expect(forB.items.find((n) => n.id === notificationId)?.isRead).toBe(false);
  ```

- [ ] **2. Run red:** `npm run test:admin -- tests/admin/notification-service.test.ts tests/admin/notification-popup.test.tsx tests/admin/session-sync.test.tsx`.
- [ ] **3. Implement service/hooks:** authorize active user, use notificationReads transaction, immutable notification.read fallback, optimistic list+badge/read-all using cancel/snapshot/invalidate. On failure restore snapshots, keep popup/error/retry; navigation only after successful persistence, no-href remains open. Pending IDs block double click; session change cancels queries and ignores stale mutation updates.
- [ ] **4. Implement anchored Radix Popover:** icon/read accessible labels, title/body/time, max width min(360px, viewport minus 24px), max-height and internal scroll/load-more, badge full unread count. Both desktop and mobile anchored to bell, collision detection. Safe href helper accepts app-relative paths or http(s), rejects protocol-relative/javascript/data and external return injection; internal router respects basepath and aliases. Esc/outside closes, focus returns bell; no nested interactive elements.
- [ ] **5. UI assertions:** click immediately updates icon/badge before deferred write resolves; failed write rolls both back and does not navigate; no href stays open; success href closes and navigates; mark-all/full list loading/error/retry; 375px popup within viewport and keyboard focus. Update dashboard notification panel to same read data/actions, no link to removed notification page.
- [ ] **6. Run green:** targeted tests and TypeScript; ensure no import of report/editor from header. Commit `feat(admin): show per-user notifications beside the bell`.

## Task 8: Hoàn thiện sidebar/search và các URL cũ

**Files:** Create `shell/legacy-destination.ts`, `tests/admin/business-navigation.test.tsx`; modify `shell/navigation.ts`, `shell/global-search.tsx`, `accounts/permissions.ts` display labels, `settings/seed.ts`, `src/routes/admin.notifications.tsx`, `src/routes/admin.sales.{index,orders,orders.$id,order-history,transactions}.tsx`, and `src/routes/admin.bookstore.{index,books,books.create,books.$id,books.$id.edit,authors,publishers,genres,inventory}.tsx`. Task 6 owns analytics aliases. Regenerate `src/routeTree.gen.ts` through existing Vite route generator, never edit it by hand.

**Interfaces:** `legacyDestination(pathname:string):{to:string;search?:Record<string,string>}|null` returns app-relative typed destination; alias components use TanStack replace redirect/validated search and do not import old pages. Search entities become products/customers/purchaseSlips/posts/users; labels use name/title/number as appropriate, paths new detail routes.

- [ ] **1. Write red:** nav exposes Khách truy cập, Khách mua hàng, Phiếu mua hàng, Báo cáo and bell; no books/authors/publishers/order-history/transactions/notification page item. Search finds new customer/slip with proper permissions and never ensures legacy books/orders. Every old route in Files redirects once to the spec destination; visitor aliases preserve ID via query; old order/book IDs never become new slip/customer IDs. Test root and `/~vhplasti`, deep create/edit/detail and Back.

  Core alias assertions:

  ```ts
  expect(legacyDestination("/admin/sales/orders/order-1")).toEqual({ to: "/admin/sales/slips" });
  expect(legacyDestination("/admin/bookstore/books/book-1")).toEqual({ to: "/admin/customers" });
  ```

- [ ] **2. Run red:** `npm run test:admin -- tests/admin/business-navigation.test.tsx tests/admin/nested-routes.test.tsx tests/admin/routing.test.ts`.
- [ ] **3. Implement integration:** remove active imports of old UI/seed groups; keep legacy typed stores/service code only where needed for preservation/tests. Sales index → slips, bookstore aliases → customers, notifications alias → dashboard. Replace seeded hrefs and breadcrumbs/action links, resource display labels only (no custom-role grant rewrite). Re-check generic product delete/stock initialization does not wake old modules.
- [ ] **4. Run green:** navigation/access/search tests and TypeScript; build route generator and assert route replacements render child form rather than parent list. Commit `refactor(admin): retire legacy business pages safely`.

## Task 9: Browser acceptance, lightweight boundary và tài liệu

**Files:** Modify `docs/admin.md`, `docs/admin-acceptance.md`, `docs/admin-performance.json`, `docs/build-and-deploy.md` (admin status only); create `docs/superpowers/reports/2026-11-02-admin-business-execution.md`. The existing DataTable fix/test/repro report were committed separately during Execution preflight; keep that history distinct from acceptance docs.

**Interfaces:** Run contract is still `npm run dev`, `npm run check`, `npm run build`, `node scripts/preview.mjs <actual-bundle-path>`. Acceptance report records actual branch/commit/dirty state, artifact/checksum, exact counts and screenshots. No new test runner/CI/deploy workflow.

- [ ] **1. Check regression coverage:** run `npm run test:admin -- tests/admin/history-responsiveness.test.tsx tests/admin/data-table.test.tsx`; expected pass. Old history URL is now an alias; shared-table regression still exercises actual client sorting/pagination and settlement before navigation.
- [ ] **2. Run full checks:** `npm run check`, then `npm run build`, expected exit 0. Record real counts/warnings/skips; do not use old 50/54 counts as new evidence. If a test fails, reproduce and fix before claiming success. Validate actual archive/version output, not a guessed bundle filename.
- [ ] **3. Preview with actual artifact:** serve on an available documented port, prefer existing localhost:4181 if the owned preview can be stopped safely. Preserve browser data; do not remove junctions recursively or overwrite a running bundle. When uncommitted changes are built, label that fact instead of equating HEAD with artifact content.
- [ ] **4. Browser business flow:** desktop then 375px: create named test customer → create two-line slip → reload → change customer's name/VAT and product price → old slip unchanged → report same totals → void with reason → totals reduce. Review empty/error/dirty-cancel and no stock change. Use isolated test DB for destructive reset tests; never reset user's review dataset.
- [ ] **5. Browser interaction flow:** 375/768/1024/1440 widths: one visitor page/dialog paging, anchored bell read/no-link/read-all/failure behavior, session switch isolation, form numeric input/focus and popup Escape/return focus. Revisit aliases and new table sorting/filtering/pagination; no hangs, uncaught console errors or page overflow. Save actual screenshots after transitions finish; reset viewport override.
- [ ] **6. Public boundary:** network on home and a real product detail must not load admin/chart/editor/seed chunks; compare public initial gzip against original baseline limits in Global Constraints; customer/slip list must not load chart/editor. Smoke public images/zoom/bidiary links/footer and `/api-test`; FE/BE version match on preview. Keep any test failures/unrun items explicit.
- [ ] **7. Documentation and final commit:** document new model, legacy preservation, VAT/no-stock/revenue semantics, demo limitations, notification read behavior and actual acceptance; mark task checkboxes only after evidence. Commit appropriate source fixes separately from acceptance docs, no automatic push/deploy. Report URL/screenshots, local commits and remaining limitations to user.

## Self-review and execution handoff

- Spec sections 1–4/10 → Tasks 1/8; customer 5 → Task 2; slips 6 → Tasks 3/4; reports/dashboard 7 → Task 5; visitors 8 → Task 6; notifications 9 → Task 7; acceptance 11 → all task tests and Task 9; builder scope/order 12 → interfaces/constraints/handoff.
- Review Focus 1 → Task 3 concurrency/atomic tests; 2 → Tasks 3/4 snapshot/refetch tests; 3 → Task 7 isolation/deferred mutation tests; 4 → Task 1 upgrade/retry/stock tests; 5 → Tasks 2/5/6/8 return-query/boundary/paging/alias tests. No uncovered focus item left as “handle edge cases”.
- Names/types align: purchaseSlips, Customer.kind, vatApplied, PurchaseSlip.number/items/status, SlipDraft, summarizeSlips; legacy Order APIs stay separate. UI does not calculate an authoritative persisted total, forge snapshots or set receipts for another user.
- Plan is proposed execution work, not a record that these new tasks already passed. No product implementation begins in this planning turn.
- Recommend **Native** execution (`superpowers:executing-plans`) because the nine tasks share data/router/cache contracts and build on already tested components; one independent final review after implementation. Subagent-driven remains available if user prefers per-task independent reviews. Ask user to review this plan and choose before implementation, as required by writing-plans.
