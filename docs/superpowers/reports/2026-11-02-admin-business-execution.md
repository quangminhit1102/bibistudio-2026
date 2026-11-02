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

Tasks 1–8 were committed after targeted RED→GREEN gates. Task 9 acceptance and independent final review are in progress; browser and artifact evidence will be appended only after observation.

The first full check found a real sample-seed bug: deleting an unused custom product caused business initialization to reference it. Regression failed first, then passed after limiting samples to the original demo product IDs and keeping line IDs unique with a single surviving product. Product/upgrade tests: 9/9 pass.

A full-check watcher recovery fixture timed out once under the parallel tooling run. The isolated fixture passed without implementation changes. The full check is rerun; this transient failure is retained here rather than erased from the evidence history.
