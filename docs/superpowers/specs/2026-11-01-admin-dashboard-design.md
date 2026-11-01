# BiBi Admin — thiết kế tích hợp và phạm vi đầy đủ

Ngày:2026-11-01. Trạng thái: kiến trúc và mockup đã được người dùng duyệt; tài liệu này đã được người dùng duyệt để lập implementation plan. Chưa triển khai admin vào ứng dụng.

## 1. Ý định và quyết định của người dùng

Giữ đầy đủ module/chức năng trong [master prompt](2026-11-01-admin-master-prompt.md), dùng Lovable thiết kế, áp dụng stack source hiện tại. Ưu tiên website đẹp, nhanh, dễ dùng và tránh source/phụ thuộc quá nặng. Người dùng chọn admin tích hợp dưới /admin trong cùng ứng dụng. Mockup Modern Minimalist đã được chấp nhận: sidebar nhóm chức năng, bảng gọn, nền trung tính, hành động charcoal, theme sáng/tối và drawer mobile.

Hai phạm vi phải tách biệt: master prompt là tiêu chí ứng dụng hoàn chỉnh; mockup chỉ duyệt hướng hình ảnh, bốn KPI/five-row table trong mockup không rút gọn yêu cầu six KPI, module hay component showcase của master prompt.

## 2. Các phương án

1. Cùng app, /admin và lazy-load từng module (người dùng chọn): giữ quy trình dev/check/build/cPanel; cần kiểm chứng ranh giới import/CSS.
2. App admin riêng trong cùng repo: cô lập bundle mạnh hơn nhưng thêm cấu hình build, router và phát hành; không chọn.

Không đổi sang React Router, ASP.NET hoặc Supabase. Khuyến nghị công nghệ trong master prompt nhường cho stack hiện có theo yêu cầu trực tiếp của người dùng.

## 3. Stack và ranh giới tích hợp

React19/TypeScript strict, TanStack Router đang có, TanStack Query5, Tailwind4, Zod3, Lucide. Backend Express/Node24 hiện chỉ health/version/demo; vẫn giữ tương thích. Database/auth/upload/server CRUD thật chưa thuộc bản admin demo này. Khi kết nối thật sau này dùng HTTP adapter đến Express; contract không phụ thuộc framework server.

Giữ npm run dev (FE+BE), npm run check, npm run build và preview artifact hiện tại. Không cần dịch vụ cloud hoặc DB để chạy admin demo. Không đổi CI/CD hay receiver hosting. Trong đợt phát triển chỉ preview local; push/merge/deploy cần theo yêu cầu riêng của người dùng.

Router admin layout riêng tại /admin, index chuyển /admin/dashboard. Tất cả đường dẫn master prompt nằm dưới /admin để tránh chiếm /products, /blog và /. Links phải tôn trọng router basepath / và /~vhplasti. Không gắn public PageShell vào admin. Root chỉ chặn FloatingContact/ImageFade trên admin qua ranh giới route, không import module admin vào root công khai. Trang admin/đăng nhập demo thêm noindex, không đưa vào sitemap; đây không phải bảo vệ truy cập.

CSS/tokens admin scoped ở .admin-root, theme .admin-root.dark; không đổi :root, font Lora public hoặc áp dark lên html dùng chung. Admin dùng Inter hiện có. State theme ở khóa riêng. Public catalogue/productType và collection, ảnh ASCII, journal và responsive refinements đã push ở codex/local-ui-refinements phải giữ nguyên.

## 4. Hiệu năng — yêu cầu có thể kiểm chứng

Lazy import admin layout, từng module/trang, charts/editor/showcase và seed data. TanStack route generator hiện không tự đảm bảo cPanel build split theo trang; implementation phải cấu hình lazy-route hoặc dynamic import thực tế cho Vite CSR, kiểm tra manifest/network, không suy luận từ tên router.

Không export chung từ barrel kéo tất cả module, seed hoặc showcase vào entry. Dashboard chỉ query dữ liệu tổng hợp cần thiết; seed khởi tạo theo dataset, không tải200 sessions khi mở landing page. Dùng chung table, form, dialog và service contracts thay vì nhân bản theo module.

Chọn package có vai trò rõ: TanStack Table cho bảng, React Hook Form+Zod cho form, accessible Radix primitives cần dùng, một thư viện chart lazy-load nếu cần. State dùng React/context trước; Zustand chỉ thêm khi chứng minh cần. Không cài tất cả thư viện vì xuất hiện trong prompt; không tự làm lại focus management của dialog phức tạp để giảm vài kB.

Ghi baseline compressed/uncompressed entry JS/CSS public trước admin. Cổng nghiệm thu: network tải / và một public detail không tải admin route/charts/editor/seed chunks; public initial JS gzip tăng tối đa10KiB do route integration; không thêm global admin CSS vào public critical payload (token scaffold tối đa2KiB gzip nếu build buộc dùng stylesheet chung). Nếu vượt, tối ưu trước; chưa coi đạt chỉ vì build pass. Admin heavy libraries không được gom vào entry chung. Các ngưỡng này là đề xuất của người triển khai để cụ thể hóa yêu cầu nhanh, chưa phải số người dùng đưa ra.

Route code splitting, debounce search, pagination, lazy media, hợp lý caching; không memo hóa/virtualize tràn lan. Benchmark local ghi rõ máy/mạng mô phỏng; không hứa điểm Lighthouse khi chưa đo.

## 5. Thiết kế tương tác

Ngôn ngữ mặc định tiếng Việt như mockup; tên kỹ thuật và example code có thể tiếng Anh. Đây là lựa chọn người triển khai dựa trên mockup, không bao gồm hệ i18n toàn app. Admin light/dark riêng; mobile375, tablet768, laptop1024, desktop1440, large1920. Desktop sidebar232–240px thu gọn, tablet icon rail mở rộng khi cần, mobile drawer có focus trap/Escape/restore focus. Header có breadcrumb, tìm kiếm thực thể demo, notification menu, theme và profile/logout demo.

Giữ toàn bộ nhóm nav master prompt nhưng không đổ mọi trang con lên sidebar cùng lúc; collapsible groups và active breadcrumbs. Có tìm kiếm module và thực thể. Bảng cuộn trong container, không cuộn ngang cả trang; mobile vẫn vào được actions/detail, có nhãn icon, mục tiêu bấm44px cho nút icon/navigation.

KPI, data/chart và loading/empty/error/retry đều có; phản hồi thao tác thực tế, xác nhận xóa/cancel/reset, validation và cảnh báo unsaved changes. Không toast thành công khi mock service/persistence lỗi. Skeleton không giữ spinner vĩnh viễn. Những control chưa triển khai không trình bày như hoàn tất.

## 6. Danh sách route và chức năng bắt buộc

Tất cả bên dưới có prefix /admin; mỗi route phải có tác vụ/nội dung thực tế trong demo, không chỉ tiêu đề.

| Nhóm | Routes | Chức năng |
|---|---|---|
| Dashboard | /dashboard |6 KPI Revenue/Orders/Products/Visitors/Active Users/Conversion, so sánh kỳ trước/tooltip;6 charts theo master; recent orders/activity/low stock/top products/recent visitors/notifications; preset/custom date range |
| Analytics | /analytics→overview; /analytics/overview, /visitors, /visitors/$id, /sessions, /pages, /traffic-sources |Visits/unique/sessions/pageviews/duration/bounce/new-returning/country/device/browser; visitor table/detail/timeline, search ID/maskedIP/filter country-device-browser-date, sort/exportCSV; country/device/browser/page/source views |
| Products | /products→list; /products/list, /create, /$id/edit, /$id, /categories, /inventory |Search/filter/sort/page/page-size/select/bulk/status/export/add/edit/detail/delete/duplicate. Form đầy đủ master gồm SKU/slug/descriptions/type/collection/price/compare-at/stock/status/images/tags/SEO, local preview multi-image, draft/publish/cancel và unsaved guard |
| Bookstore | /bookstore→books; /books, /books/create, /books/$id, /books/$id/edit, /authors, /publishers, /genres, /inventory |Book CRUD/ISBN/filter/relations/stock, author/publisher CRUD, genre management, stock adjustments/history; dùng shared table/forms |
| Sales | /sales→orders; /sales/orders, /orders/$id, /order-history, /transactions, /reports |Sales KPIs, order/payment statuses, consistent totals/discount/shipping, timeline/notes, valid transitions, cancel confirmation, filters/search/export/print |
| Accounts | /accounts→users; /accounts/users, /roles, /permissions |User CRUD/detail/activate/deactivate/assignrole,5 demo roles, typed permissions matrix/view-create-update-delete-export-settings, hide/disable unauthorized UI |
| Content | /content→posts; /content/posts, /posts/create, /posts/$id/edit, /posts/$id, /categories, /tags, /media |Post CRUD/publish/unpublish/preview/draft, author/tags/category/date/SEO, editor headings/bold/italic/link/list/quote/code/image; sanitize rendered content; hierarchical category CRUD/order/no cycles; media grid/list/search/filter/select/local upload/delete metadata |
| Audit/notification | /audit-logs, /notifications |Search/filter and meaningful event details; notifications read/unread/bulk state backed by demo records |
| Settings | /settings→general; /general, /appearance, /security, /profile |Validated demo forms/persistence/theme/profile; security settings clearly simulated, no production credentials |
| UI showcase | /components→overview; /overview, /actions, /forms, /data-display, /navigation, /overlays, /feedback, /charts |Every component/variant/state in master sections13–14, interactive example, description, typed usage/copy code; separate lazy route for each category |
| Demo access | /login |Clearly labelled demo role/session selection; logout clears demo session; no hardcoded production credentials or claim of security |

Routes in table are relative to their group when abbreviated; master route tree remains source of truth. Extra create/edit/detail routes support required workflows without dropping original routes.

## 7. Reusable component inventory

Master sections13–14 are a required checklist, not optional examples. Include actions (8 kinds,6 variants,4 sizes); all listed form controls/field states; data display/timeline/code/image preview; typed advanced DataTable with client+server pagination/filter/sort interfaces, selection/bulk/visibility/resizing where appropriate/actions/loading-empty-error-export; navigation including command palette/stepper/context menu; disclosure/tree; accessible overlays including dialog/alert/confirmation/drawer/sheet/popover/hovercard/tooltips; toast/alerts/progress/spinner/skeleton/retry feedback;7 chart wrappers. Each has real interactive demo and TypeScript usage copy. Reuse these across management modules. Full verbatim inventory retained in master file; plan must map every item to a task/example and report missing items honestly.

## 8. Data, persistence and contracts

Typed domain models and Zod validation per feature. Mock promise services implement same list/get/create/update/delete/bulk/filter/sort/pagination/AbortSignal/error contracts as a future HTTP adapter; pages use services through Query hooks, not localStorage directly. Query keys include filters, sort, page and entity; successful writes invalidate dependent summaries/details.

Deterministic seed defaults follow master volumes:50 demo products,30 books,15 authors,10 publishers,100 orders,30 users,40 posts,200 sessions plus related categories/genres/roles/permissions/visitors/events/audit/notifications. Order items reference known products/books, totals derived, charts aggregate dataset for selected dates; active/new/returning/unique metrics have documented definitions. No unrelated random KPI values. Clock fixed per seed/reset for reproducibility, date range defaults to seed latest date; labels say simulated, not live.

Admin product schema separates productType and collection. Can seed a representative copied catalogue sample plus demo commerce fields; admin price/stock/sales are demo only and never introduce prices/cart on public site. Public data remains immutable src/data/catalogue.ts/blog.ts; no silent writeback/website publishing.

IndexedDB stores versioned entity data and image Blobs; localStorage only small admin preferences/demo session. No base64 multi-image dumps. Media preview object URLs cleaned up; reload restores stored blobs. In-app quota/unsupported-storage errors visible with retry/reset/export where feasible, never fake success. Reset confirmed, clears only bibi-admin namespaced storage/query cache, restores deterministic seed and preserves public browser data. File allowlist/size cap values left to builder with documented limits and tests.

Generic category parent tree prevents self/descendant cycles, deleting referenced parents requires explicit reassignment or blocking. Order status transition map and permission map centralized and tested; refund after delivery supported according to documented flow, invalid jumps rejected by mock service as well as UI.

Lựa chọn của người triển khai cho demo: Super Admin có toàn quyền; Administrator toàn quyền trừ thay đổi Super Admin; Manager quản lý catalogue/bookstore/sales/export, chỉ xem analytics; Editor quản lý content/media, xem catalogue; Viewer chỉ xem các module được phép. Tài khoản Super Admin cuối cùng không được xóa/hạ quyền. Role switching ở demo session, không phải production login; profile/logout/preferences hoạt động thật trong demo storage. Global search tối thiểu products/books/orders/posts/users, kết quả có loại thực thể và navigation; nhãn chỉ rõ dữ liệu demo và không tìm kiếm người truy cập thật.

State machine order: Pending→Confirmed hoặc Cancelled; Confirmed→Processing hoặc Cancelled; Processing→Shipped hoặc Cancelled; Shipped→Delivered; Delivered→Refunded. Cancelled/Refunded terminal; không nhảy ngược. Payment Pending→Paid hoặc Failed; Failed→Pending khi retry; Paid→Refunded khi refund hợp lệ; cancel đơn chưa thu tiền không tự tạo refund. Demo không charge tiền, cần rejection/error rõ cho transition không hợp lệ; audit records ghi trạng thái trước/sau.

Demo auth/roles enforce UX and mock-service restrictions only; no frontend promise of real security. User data, orders, visitors and masked IPs are synthetic; no visitor tracking script, geolocation lookup or production secret collection. IPs use reserved documentation ranges. Login/settings must clearly show demo; no hidden write to hosting/API.

## 9. Tổ chức source

src/routes/admin* thin route adapters with nested admin layout and lazy pages; src/features/admin/{shell,shared,services,demo,dashboard,analytics,products,bookstore,sales,accounts,content,audit,notifications,settings,showcase}. Each feature owns pages/components/hooks/models/schemas/service; shared admin components only genuinely reused patterns. Avoid giant switch by pathname or monolithic page generators. Existing public source not refactored wholesale.

Source master prompt and this design live in docs/superpowers/specs. README/admin developer guide covers start/test/build, mock/reset/persistence, connecting future Express REST adapter, which actions are simulated, authorization limitations and module/component acceptance checklist. docs/build-and-deploy.md updated only for actual admin bundle/preview implications, not false hosting acceptance.

## 10. Triển khai và nghiệm thu theo giai đoạn

1. Foundation/layout/theme/lazy router/mock API/persistence boundaries and baseline public bundle measurement.
2. Reusable UI/forms/table/navigation/overlay/feedback/charts + interactive showcase.
3. Dashboard/products/categories/accounts/content/media with full workflows.
4. Bookstore/inventory/sales/orders/transactions/reports and invariants.
5. Analytics/visitors/session/page/source views, audit/notifications/settings complete.
6. Cross-feature persistence/errors/permissions/search/a11y/responsive/performance/tests/docs and final local review.

Mỗi giai đoạn có preview/check/test thật trước khi chuyển, nhưng không tự kết thúc sau giai đoạn1 và gọi cả app hoàn tất. Không yêu cầu người dùng bấm duyệt từng phase trừ khi phát hiện quyết định thay đổi thiết kế. Đây là một dự án nhiều module cùng dùng shell/data/components; implementation plan chia task/phase, không tách thành các sản phẩm ngoài phạm vi người dùng đã chọn.

Automated tests ưu tiên routing, CRUD products/books/users/posts, relations/categorycycles, valid/invalid order transitions/totals, roles/permissions, formvalidation, table search/filter/sort/pagination/export, date analytics consistency, theme/persistence/reset/IDB errors and API adapter contracts. Browser tests full core workflows including refresh/reload, unsaved guard, modal focus/keyboard/Escape and mobile table/actions. Tests phải kiểm tra hành vi, không mirror CSS implementation.

Run tsc/lint/npm run check/build thực tế. Browser375/768/1024/1440/1920 for shell, dashboard, product forms/table, rich editor/media, rolematrix and showcase; no pageoverflow, tables scroll within bounds; loading/empty/error states and reducedmotion. Compare before/after public bundle/network with section4 budgets, regression public products/images/zoom/bidiary/footer/API-test. Record exact test counts, failed/unrun checks and screenshots; passing build is not deployed production.

## 11. Lovable và mockup đã duyệt

Lovable project a92fe95d-ba22-47c3-be74-9ed93eadfc00; integration review umsg_01m6ax83j3fd8anbwcge64qepj; HTML mockup umsg_01m6axjv97ewqvwem17c5cx0q6. Local throwaway HTML at .superpowers/brainstorm/43-1793515466/content/admin-direction.html, screenshots admin-dashboard-mockup.png/admin-products-dark-mockup.png/admin-mobile-drawer-mockup.png in session visualization folder. Tested prototype search/dialog/theme/mobile drawer; these checks do not prove application functionality or performance.

Use Lovable for design/patch guidance, apply implementation to local feature branch through review; avoid cloud auto-edits/publish that can race shared main. Preserve pushed Git history, no force push/rebase/amend of shared commits.

## 12. Chưa thuộc phạm vi và lựa chọn để builder quyết

Không xây backend production auth/MySQL/migrations/tracking/payments/public catalogue editor publication trong dự án demo này. Không deploy website thật hay bỏ module để tiết kiệm context. Builder quyết library versions sau kiểm tra tương thích, exact component APIs, module chunk names, file size caps, detailed synthetic records and pagination defaults; phải giữ behavior/master checklist và ghi tradeoff. Mở rộng quyền truy cập/credentials hoặc kết nối dữ liệu thật cần thiết kế riêng.
