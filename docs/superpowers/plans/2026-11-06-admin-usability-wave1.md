# Admin Usability Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa lỗi edit phiếu, dirty guard sai và UX sidebar/readonly/badge, có preview local kiểm chứng cho owner.

**Architecture:** Giữ React/TanStack và các service hiện tại. Sửa đúng route/query/form chịu trách nhiệm; nâng component dùng chung có backward-compatible defaults. Không thay backend/schema hoặc quyền truy cập trong đợt1.

**Tech Stack:** Node24, React19, TanStack Router/Query, react-hook-form, TinyMCE self-host, Radix Tooltip, Vitest/Testing Library, Playwright; MySQL fixture cho standard check hiện có.

**Spec:** `docs/superpowers/specs/2026-11-06-admin-usability-profile-design.md` (owner đã duyệt thiết kế và phác thảo).

## Global Constraints

- Giữ architecture, tiếng Việt, giao diện tối giản và bundle nhẹ. Không thêm thư viện UI lớn.
- Đợt1 chỉ làm rõ readonly hiện tại; không mở self-profile API, sửa role, upload avatar hoặc migrate DB. Các mục đó thuộc đợt2, có plan riêng sau.
- Master Admin vẫn bất biến; Admin+User hợp quyền như hiện tại. Không sửa role user01 production chưa được owner quyết định.
- Không đổi dữ liệu phiếu production, reset local data có sẵn hoặc biến sales/catalogue local thành backend CMS.
- Mockup trong `.superpowers/brainstorm/318-1793930575/content/admin-usability-preview.html` chỉ là tham chiếu; không chép trang minh họa hoặc handler giả vào product.
- Mỗi lỗi có regression RED trước fix; meaningful assertion, không tăng timeout/bỏ guard để test pass. Tests không dùng hosting secrets/raw logs.
- Preview local và owner review trước phát hành riêng. Chưa push/main/deploy trong phạm vi thực thi plan này nếu chưa có chỉ thị tiếp theo. Không rewrite published history/Lovable.
- Trước local tooling/build/deploy đọc `docs/build-and-deploy.md`; build pass không phải production acceptance.

## Review Focus

1. Query hết pending hoặc bị disabled nhưng route vẫn skeleton: phải hiện form hoặc error có điểm kết thúc (Task1).
2. TinyMCE chuẩn hóa/mount/đổi theme tạo event không do người dùng: không dirty giả, không mất nội dung đã sửa (Task2).
3. Tên/slug/gallery sửa rồi trả đúng baseline hoặc lưu lỗi: bỏ cảnh báo khi tương đương, giữ cảnh báo khi còn thay đổi (Task2).
4. Tooltip bị scroll container cắt, focus icon không có tên, drawer mobile bị thu gọn: menu vẫn rõ và điều hướng được (Task3/6).
5. Disabled che mất lý do hoặc badge chỉ dựa vào màu trong dark mode: trạng thái vẫn hiểu được, đủ tương phản và không mở quyền (Task4/5/6).

## File map

- `sales/pages/slip-editor.tsx`, `sales/use-slip-route.ts`, `sales/hooks.ts`: resolve số phiếu/ID, tải dữ liệu, kết thúc loading.
- `shared/forms/compose-form.tsx`, `shared/forms/record-form.tsx`, `content/components/rich-editor.tsx`: baseline và thay đổi thực.
- Create `shared/forms/form-baseline.ts`: pure semantic comparison cho form compose, không xử lý router hoặc persistence.
- `shell/sidebar-navigation.tsx`, `shell/admin-layout.tsx`, `shared/ui/primitives.tsx`: tên menu/tooltip và trạng thái form dùng chung.
- `accounts/server-profile.tsx`, `accounts/account-form.tsx`, `admin.css`: readonly và màu sắc.
- Create `shared/ui/status-badges.ts`: semantic mapping theo domain/state; chỉ import ở admin.
- Test files dưới `tests/admin/`; real-browser acceptance dưới `tests/e2e/`; báo cáo dưới `docs/superpowers/reports/`.

Paths trong task tương đối từ `src/features/admin/` trừ khi ghi prefix `tests/`, `scripts/` hoặc `docs/`.

### Task 1: Sửa route edit phiếu bị kẹt

**Files:** Modify `sales/pages/slip-editor.tsx`, `sales/use-slip-route.ts`, `sales/hooks.ts` chỉ khi trace chứng minh cần; extend `tests/admin/slip-route.test.ts`; create `tests/admin/slip-editor-route.test.tsx`.

**Interfaces:** Consume `resolveSlipRoute(store:AdminStore,token:string):Promise<PurchaseSlip>`, `useSlipRoute(token:string)`, `useSlipOptions()`, `useRecordId()`. Preserve signatures, trả primary record cho token ID/số phiếu và canonical URL giữ search/hash. Không thêm timeout chuyển dữ liệu rỗng.

- [ ] Tái hiện với fixture có number `PMH-2026-0002`, primary ID khác số phiếu; ghi trace token→ID→record/options/role và trạng thái enabled/pending/error. So với skeleton đã quan sát production; không mặc định lỗi do số phiếu.
- [ ] Viết integration regression render actual router/provider/editor, mở `/admin/sales/slips/PMH-2026-0002/edit?returnTo=%2Fadmin%2Fsales%2Fslips%3F`. Assertions: `await screen.findByRole('heading',{name:'Chỉnh sửa phiếu mua hàng'})`, đúng khách/dòng hàng từ fixture; primary-ID route về canonical number giữ returnTo. Bổ sung missing/conflict/options rejected/query disabled/không quyền/phiếu void: trạng thái error hoặc readonly có điểm kết thúc, không skeleton vô hạn. Dùng `businessFixture` hiện có; không mock resolve thành công để che loading chain.
- [ ] Chạy `node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin/slip-editor-route.test.tsx tests/admin/slip-route.test.ts`; quan sát RED sản phẩm. Nếu harness sai thì sửa harness và chạy lại; không gọi harness error là regression.
- [ ] Sửa tối thiểu tại hook/query/state gây lỗi, giữ stable query identity/dependencies và không conditional hook. Cache được dùng lại đúng key primary-ID nếu cần; loading/error phân biệt disabled. Giữ returnTo qua `safeListReturn`.
- [ ] Chạy cùng lệnh GREEN và `tests/admin/purchase-slips.test.ts tests/admin/purchase-slip-form.test.tsx`; bổ sung route từ danh sách/chi tiết và back không mất target. Commit `fix: resolve purchase slip edit loading` với chỉ file task.

### Task 2: Dirty guard phản ánh thay đổi thực

**Files:** Create `shared/forms/form-baseline.ts`, `tests/admin/form-baseline.test.ts`; modify `shared/forms/compose-form.tsx`, `shared/forms/record-form.tsx`, `content/components/rich-editor.tsx` khi cần; extend `tests/admin/editor-forms.test.tsx`, `tests/admin/editor-draft-retention.test.tsx`; create `tests/admin/editor-unsaved-guard.test.tsx`.

**Interfaces:** Produce `formFingerprint(kind:'post'|'product',values:FormValues):string` và `hasFormChanges(kind:'post'|'product',baseline:FormValues,current:FormValues):boolean`. Dùng sanitizer/readRichContent/writeRichContent hiện có cho rich body; gallery giữ thứ tự, scalar không tùy tiện trim nội dung người dùng. Preserve `ComposeFormProps.onDirtyChange(dirty:boolean)` và RichEditor props. Snapshot baseline tách immutable values; không giữ tham chiếu array đang mutate.

- [ ] Viết RED pure tests: `expect(hasFormChanges('product',base,structuredClone(base))).toBe(false)`; reorder imageIds thành khác phải true, trả thứ tự ban đầu false. HTML rỗng/tương đương sau TinyMCE normalization false; đổi text/link/media thật true. Không so plain text khiến mất khác biệt formatting.
- [ ] Viết RED integration tạo và sửa product/post: mount và editor init không cảnh báo khi đi trang khác; tên sinh slug từ người dùng làm dirty; đổi rồi trả baseline hết dirty; gallery và rich text thật có dialog; preview/theme/refetch không đổi không dirty giả hoặc xóa draft. Lưu lỗi giữ dirty, lưu thành công cập nhật baseline và thoát không dialog. Kiểm tra cả navigation và beforeunload.
- [ ] Run `node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin/form-baseline.test.ts tests/admin/editor-unsaved-guard.test.tsx tests/admin/editor-forms.test.tsx tests/admin/editor-draft-retention.test.tsx`; xác nhận RED.
- [ ] Implement pure fingerprint và baseline lifecycle; tách derived defaults/init khỏi user changes, không ép mọi setValue shouldDirty=false. Chỉ reset khi đổi editor session hoặc save thành công, không reset mỗi refetch/theme. Không thay sanitizer contract cho public bài viết.
- [ ] Run cùng lệnh GREEN, thêm `tests/admin/editor-content.test.ts tests/admin/editor-session.test.tsx`; commit `fix: track actual editor changes against baseline`.

### Task 3: Tên menu khi thu gọn

**Files:** Modify `shell/sidebar-navigation.tsx`, `shell/admin-layout.tsx`, `shared/ui/primitives.tsx`, `admin.css`; extend `tests/admin/navigation-groups.test.tsx`; create `tests/admin/sidebar-tooltips.test.tsx`.

**Interfaces:** Add optional `collapsed?:boolean` to SidebarNavigation (default false); parent truyền `collapsed && !drawer`. Extend existing Tooltip props backward compat với `side?:'top'|'right'|'bottom'|'left'` (default existing Radix default) và `enabled?:boolean` (default true). Portal theo theme hiện có, delay150ms; sidebar dùng side right. Link accessible name từ label dù span bị ẩn.

- [ ] RED: hover/focus collapsed “Khách truy cập” thấy `role=tooltip` đúng tên; Escape đóng; Enter/click vẫn đến route. Expanded không sinh tooltip dư; drawer mobile giữ chữ dù collapsed desktop trước đó. Group state/active/resizer không đổi.
- [ ] Run `node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin/sidebar-tooltips.test.tsx tests/admin/navigation-groups.test.tsx tests/admin/navigation-route-active.test.tsx tests/admin/sidebar-resize.test.tsx`; quan sát RED.
- [ ] Bọc Link bằng Tooltip asChild qua component hiện có, không thêm focus target thừa và không dùng mỗi native title. Không render CSS tooltip bị cắt trong sidebar overflow.
- [ ] Run cùng lệnh GREEN; để Task6 chứng minh overflow và bounding box bằng browser thật. Commit `feat: label collapsed admin navigation with tooltips`.

### Task 4: Readonly và disabled rõ nghĩa

**Files:** Modify `accounts/server-profile.tsx`, `accounts/account-form.tsx`, `shared/ui/primitives.tsx`, `admin.css`; extend `tests/admin/server-profile.test.tsx`, `tests/admin/server-account-ui.test.tsx`, `tests/admin/shared-ui.test.tsx`.

**Interfaces:** Preserve AccountForm readOnly/onSave/onDirtyChange và Button loading/disabled. Không đổi API hoặc `canCode`. Readonly profile có copy cố định “Tài khoản quản trị gốc được bảo vệ”; không có submit hoạt động. Dùng existing Field description khi đủ, không thêm global disable policy.

- [ ] RED: Master profile hiển thị lý do, các field không sửa được/có thể đọc, không gửi save và không dirty khi focus/copy. User hiện chưa có account.update không thấy Save hoạt động. Account non-Master được update vẫn lưu như cũ. Shared Button loading chặn double-submit; Hủy/Quay lại/Preview vẫn thao tác hợp lệ khi form chưa đổi.
- [ ] Run `node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin/server-profile.test.tsx tests/admin/server-account-ui.test.tsx tests/admin/shared-ui.test.tsx`; RED trước thay đổi cần thiết.
- [ ] Rà inventory common controls thật và ghi kết quả trong report Task6; sửa affordance/label/focus/disabled contrast có evidence. Không bọc disabled button bằng tooltip không nhận focus làm lý do duy nhất; không vô hiệu hóa nút Hủy vì pristine.
- [ ] Run cùng lệnh GREEN; commit `fix: clarify protected profiles and disabled controls`.

### Task 5: Màu badge có ngữ nghĩa

**Files:** Create `shared/ui/status-badges.ts`, `tests/admin/status-badges.test.tsx`; modify `shared/ui/primitives.tsx`, `admin.css` và call sites xác nhận bởi inventory. Liệt kê exact call sites trong report trước edit; scope `src/features/admin/` thôi.

**Interfaces:** Export `BadgeTone='neutral'|'success'|'warning'|'error'|'info'|'privilege'` từ status-badges; `statusBadgeTone(domain:string,state:string):BadgeTone` ánh xạ explicit domain/state, unknown→neutral. Badge dùng type này, default neutral; consumers không dịch nhãn sang key hoặc heuristic tìm substring “hủy”. Mapping: saved/active/published→success; pending/low-stock→warning; void/failed→error; inactive/draft→neutral; VAT true→info/false→neutral; full-access/protected→privilege. Dùng domain-specific stable states thật trong inventory.

- [ ] Lập inventory `Badge`/status tags gồm nhãn, stable state, domain, page, màu hiện có/đề xuất; không tự đổi meaning “Đã lưu” thành “Đã thanh toán”.
- [ ] RED table-driven assertions mỗi nhóm: `expect(statusBadgeTone('vat','false')).toBe('neutral')`, `expect(statusBadgeTone('vat','true')).toBe('info')`, `expect(statusBadgeTone('account','protected')).toBe('privilege')`; void phiếu error, inactive neutral và unknown neutral. Verify Badge vẫn có đầy đủ text; protected có icon+label ở call sites, không chỉ title.
- [ ] Run `node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin/status-badges.test.tsx tests/admin/shared-ui.test.tsx tests/admin/slip-report-ui.test.tsx tests/admin/server-account-ui.test.tsx`; quan sát RED.
- [ ] Implement map/tokens theo mockup đã duyệt, light/dark. Neutral nhạt nhưng readable; không đổi payload/service status. Áp dụng inventory, không broad search-replace text.
- [ ] Run cùng lệnh GREEN. Task6 đo contrast và kiểm tra badge wrap trên mobile. Commit `feat: standardize semantic admin status badges`.

### Task 6: Browser acceptance, preview và bàn giao

**Files:** Create `tests/e2e/admin-usability.spec.mjs`; modify `scripts/auth-ui-check.mjs` để chạy spec mới với pattern hiện có; create `docs/superpowers/reports/2026-11-06-admin-usability-wave1-acceptance.md`; update `docs/admin.md`/`docs/build-and-deploy.md` chỉ trạng thái local liên quan.

**Interfaces:** Node test + actual MariaDB auth fixture/compiled Express/React/Chromium theo `tests/e2e/auth.spec.mjs`; seed sales fixture riêng qua origin IndexedDB adapter hiện có, không đụng local DB/user store đang dùng. Chủ động tạo record number PMH-2026-0002 có primary ID khác số phiếu. Browser screens1440x1000 và390x844, evidence `.superpowers/e2e/admin-usability/`. API/private config test lấy từ fixture, không lấy env production.

- [ ] Viết browser acceptance cho actual TinyMCE mount+typing+revert+theme/navigation; deep-link edit phiếu và list→edit; collapsed hover/focus/Escape/scroll; readonly profile; badge light/dark/mobile. Không mock editor hoặc route page. Đây là task verification: nếu Tasks1–5 đã làm hành vi đúng thì ghi nhận initial GREEN, không tạo lỗi giả để có RED. Nếu tìm thấy lỗi integration, thêm assertion tái hiện RED trước bản sửa.
- [ ] Run `node --test tests/e2e/admin-usability.spec.mjs`; triển khai harness/wiring để GREEN. Không raise timeout khi root cause app chưa sửa. Assert horizontal document overflow absent at390px; tooltip bounds trong viewport và cạnh icon; badge text/background contrast >=4.5:1 ở cả light/dark; disabled vẫn nhận biết trong UI (không dùng contrast threshold như WCAG bắt buộc cho disabled).
- [ ] Run Node24 `npm run check`, `npm run build`, `node scripts/admin-bundle-report.mjs`; expected exit0, không test fail; public initial JS gzip delta<=10240bytes/CSS<=2048bytes theo budget hiện có và không admin module trong public initial graph. Đọc output, fix có regression trước khi rerun cần thiết.
- [ ] Mở compiled local preview đúng SHA, verify thao tác thật, xem screenshots loaded data/editor; ghi bug reproduction/root cause, file inventory common controls/badges, test counts/limits/ảnh và những gì chưa làm. Không gọi screenshot skeleton hoặc build pass là UI acceptance.
- [ ] Một fresh whole-branch review cuối, xử lý Important/Critical có RED→GREEN và required checks; ghi deferred/ruling rõ. Đợt1 không cần reviewer từng task nếu chọn Native. Không spawn implementer khi chưa chọn subagent method.
- [ ] Commit `test: verify admin usability wave one locally`; bàn giao preview/report cho owner review. Chưa deploy. Đợt2 vẫn cần plan riêng theo spec đã duyệt, không lén ghép vào task này.

## Self-review

Coverage: spec edit phiếu→Task1; dirty guards→Task2; sidebar→Task3; readonly/common controls→Task4; badge→Task5; local verification/bundle/mobile/screenshots→Task6. Auth/self-profile/phone/avatar/DB thuộc đợt2 đã tách rõ, không thiếu task trong scope đợt1. Review Focus1→T1,2/3→T2,4→T3/6,5→T4/5/6. Tooltip/Badge defaults giữ backward compatibility; không task nào đổi RBAC. Root cause chưa biết được để lại cho trace với evidence, không áp đặt giải pháp đoán trước. Standard check thêm real browser spec, không chỉ test tùy chọn. Plan đã tự rà coverage/type/interfaces/proportion, không cần subagent review plan.
