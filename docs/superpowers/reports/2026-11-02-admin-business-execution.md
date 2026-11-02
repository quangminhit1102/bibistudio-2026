# BiBi Admin business workflow — execution 02/11/2026

Scope: local branch `codex/admin-dashboard`; no push, merge or deployment. Implements the approved design and nine-task plan. Admin remains an IndexedDB demo, not Express/MySQL authentication or a production sales database.

## Implementation and semantics

- DB v2 adds customers, purchaseSlips and notificationReads without resetting legacy records, blobs or custom roles. Sample business records never claim newly created custom products.
- Customers represent bookstores, individuals and companies; archive instead of hard-delete. VAT is a yes/no default only.
- Saved slips retain customer/product/SKU/price/VAT snapshots. Total is integer quantity × unit price; transaction reserves the yearly number and audit atomically. Void is terminal, needs reason, preserves history and number. No stock/reserved/payment mutation.
- Recorded revenue uses saved non-void slips by Vietnam creation time. Customer/year filters apply to the complete aggregate, tables and CSV; charts explicitly show Top 10. No fabricated visitor conversion.
- Visitors use one page and an on-page session dialog, with mobile cards; known product URLs are deduplicated from existing demo sessions. No new tracking or geolocation calls.
- Notifications use a bell-anchored popup, per-user receipts, optimistic read count and rollback on failure. Navigation follows persistence; no-link rows keep popup open. Pending operations cannot restore old-user cache after session switch.
- Sidebar/search use only current business modules; old book/order IDs redirect to new lists without being reinterpreted as new entity IDs. Old notification URL redirects to dashboard.

## Evidence status

Tasks 1–9 completed. Targeted RED→GREEN gates, actual browser acceptance, one independent final review and one verified fix pass are complete. Source is committed locally; no push, merge or deployment.

The first full check found a real sample-seed bug: deleting an unused custom product caused business initialization to reference it. Regression failed first, then passed after limiting samples to the original demo product IDs and keeping line IDs unique with a single surviving product. Product/upgrade tests: 9/9 pass.

A full-check watcher recovery fixture timed out once under the parallel tooling run. The isolated fixture passed without implementation changes. The subsequent complete checks passed; this transient failure is retained here rather than erased from the evidence history.

## Final verification and artifact

- Source commit `9552afa36d9005f69212e1015795eecb629dcc79`; branch `codex/admin-dashboard`. Documentation was finalized afterward, with no further source changes.
- Full `npm run check`: exit0, **43 files /98 admin tests**, **54 tooling/API pass**, **1 POSIX permission skip on Windows**. ESLint0 errors/7 existing Fast Refresh warnings. Full `npm run build`: exit0; existing >500kB chunk and vite-tsconfig-paths warnings remain.
- Artifact `.releases/local-9552afa36d9005f69212e1015795eecb629dcc79.tgz`; SHA256 `c48a7bc7f11d99ab90b396df6a51d9aed3d638e3af68615f9c43ff11168f9fac`.
- Final preview `http://127.0.0.1:4181/admin/analytics/visitors`; actual `/api-test` FE/BE match this exact release. Missing slip edit now shows a retryable not-found after default query retries; real editor shows its correct customer. No error console logs in final smoke.
- Public initial gzip: JS174289→181738 (+7449 ≤10240); CSS11206→11265 (+59 ≤2048). Complete measured graph in `docs/admin-performance.json`.
- Actual business flows, twelve responsive cases, notification placement/account isolation, aliases/basepath and public asset inventories are recorded in `docs/admin-acceptance.md`. Those initial full browser flows used artifact90244f3; after the review fixes,9552afa was rebuilt and smoked as described above. No claim of production hosting acceptance.

## Independent review and one fix pass

A fresh gpt-6-astra reviewer checked the full execution range738add3..2d7c90f read-only, including all five plan Review Focus items. Initial verdict: do not ship because of one Critical and three Important findings. The executor accepted all four, added five failing integration regressions, then fixed them in one pass; no second review was requested.

1. Critical: switching between cached edit IDs could put slip A's draft into B and save it with B's revision. The entire snapshot/draft owner is now keyed by route ID and waits for its matching snapshot. Regression saves B and confirms B's original customer/items, then opens a blank create form.
2. Important: refetch errors could unmount dirty slip/customer forms. Cached forms now remain mounted with retryable error UI beside them. Two regressions preserve typed notes/name through failure and successful retry.
3. Important: a missing slip ID could remain a skeleton forever. Completed lookup errors now take precedence over initial loading. Regression and real browser verify error/retry.
4. Important: same-route URL navigation could leave the old customer/search/export scope. List state now derives from router search, and shared table input follows external search changes. Regression verifies customer2 CSV, absence of customer1 data, and Back restoring customer1/query.

All five tests were observed RED before implementation and GREEN after it; targeted suite16/16 and full suite98/98 +54/54 passed. These tests gate the fixes; the reviewer has not issued a second verdict on the fixed commit.

## Rulings made during execution

- Ruling: Existing dependencies and managed worktree are already installed/isolated; do not npm install or create another worktree — avoids unnecessary lockfile/environment changes — cost if wrong: missing dependency would surface during checks and be installed only then.
- Task 2: Ruling: add shared internalTarget URL splitter and explicit checkbox aria-labels — query-return navigation and stable labels need these small shared changes — cost if wrong: query/focus regression in old forms, covered by existing edit-snapshot/form tests.
- Task 5: Ruling: add countTrend/report-choice metadata and optional DateFilter preset resolver; dashboard anchors to actual Vietnam day rather than frozen seed day — keeps newly entered slips visible and preserves volume chart from one aggregate — cost if wrong: demo KPI range differs from old frozen labels; tests pin the new day boundary.
- Task 6: Ruling: shared DataTable gets an optional mobileRow slot and readonly lists disable selection — one query/table state supplies both desktop and mobile cards instead of duplicate visitor fetches — cost if wrong: shared table layout regression, covered by table settlement/pagination tests and final responsive checks.
- Task 7: Ruling: serialize notification read mutations per QueryClient/user/generation across header and dashboard — avoids optimistic snapshot rollback races between two consumers — cost if wrong: short pending writes temporarily disable other read actions; explicit pending tests cover it.
- Task 8: Ruling: extract permission-filtered searchAdmin service alongside the global search UI — tests can prove new entity lookup without rendering a debounce/modal and no legacy seed activation — cost if wrong: a small extra lazy module; no dependency added.
- Task 9: Ruling: business samples reference only the original product-1..50 demo IDs and use one unique line when only one survives — full check exposed accidental links to newly created custom products, blocking deletion; avoid manufacturing business history for user records — cost if wrong: a legacy DB containing only custom products gets customers but no sample slips.
- Task 9: Ruling: inject quota/pending/no-link/250-session failure modes only in isolated integration tests, and combine shared snapshot evidence from desktop with mobile save/reload/void — avoids corrupting the users review DB or repeatedly changing catalogue records — cost if wrong: real-browser failure presentation or device-specific snapshot issue could remain; UI rollback and same service are integration-tested.
- Final: Ruling: production auth/MySQL/live tracking/hosting acceptance remain outside this local demo — explicit DEMO disclosure matches approved scope — cost if wrong: this cannot safely replace a production administration backend.
- Final: Ruling: literal quoted-name search remains a preexisting minor — ordinary name/diacritic search still works and expanding search normalization is separate polish — cost if wrong: an exact query containing quotes may miss a record.
- Final: Ruling: older detail Viewer Edit buttons retain the preexisting access-denied behavior — service rejects writes and new business editor enforces permissions — cost if wrong: an unnecessary navigation for Viewer.
- Final: Ruling: older attachment picker remains file-button based — media library already supports drag/drop and this plan adds no upload workflow — cost if wrong: an extra click for attachment selection.

## Deferred minors

- Final: minor (deferred): visible unread badge is a dot rather than a numeric count (accessible label contains full count).
- Final: minor (deferred): same-named customers in slip list filter lack a distinguishing short ID (form/report pickers include it).
- Final: minor (deferred): report tables have no full-dataset reconciliation footer; aggregate KPI and complete CSV remain available.
- Final: minor (deferred): baseline literal quoted-name search, older Viewer Edit affordances and older attachment picker drag/drop remain deferred.
