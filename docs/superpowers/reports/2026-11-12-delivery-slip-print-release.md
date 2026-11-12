# Editable delivery-slip printing — production acceptance

Status: deployed and independently verified on 12 November 2026.

## Release

- Feature commit `abef3d7`; merge/source `3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf`. Main and Lovable-connected branch updated by ordinary merge/push, no rewritten history. Rejected homepage redesign remains reverted; no public catalogue changes.
- [Main CI 43259550001](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43259550001) Success, 7m2s. Artifact `release-3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf-43259550001`, ID `13963157958`; GitHub ZIP digest `ab21ac262786d5ca57511374b3195a23cebae0577959ff5b95d32708eb51c740`. This ZIP digest is distinct from the contained release archive checksum verified by deploy tooling.
- [Production #15 / 43261003682](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43261003682) completed successfully. Observed `deployed` receipt with release ID `3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf-43259550001` and previous `da41998cafcce0feee301e168995874c590303bb-42356811515`.
- Independent `/api/version` and `/version.json` matched that exact release/source; `/api/ready` returned 200. Existing workflow checksum, hosting/old-client smoke and automatic recovery gates remained enabled.
- Rollback target: `da41998cafcce0feee301e168995874c590303bb-42356811515` through the existing manual Rollback production workflow. No schema, hosting permission, receiver or credential changes; no new rollback drill or database restore claimed.

## Behavior and data boundary

Owner explicitly selected current browser/dump business data for this release. Opening **In phiếu** reads existing customer/product records through typed `SlipPrintSource`, keeps quantities/prices and VAT flag from the saved slip, and falls back to historical snapshots with a notice for missing/inaccessible relations. Dataset initializers are deliberately excluded from this read path, since their presentation upgrades can write existing records. Future API/MySQL adapters replace these two readers; no MySQL CRUD is introduced here.

The transient editor permits sender/customer/date/number/line/unit/signature changes, adding/removing lines and VAT selection/rate. Default template rate is 8%, editable before printing. Integer VND calculations use exact intermediate arithmetic and round VAT once at subtotal level. The amount in words uses the final total. Closing the editor discards its temporary changes. Reports and original customer/product/slip records are not written by the print feature.

The A4 document is isolated in a script-free iframe and contains no admin controls. Gray header, yellow totals, centered signatures, repeating table headings and non-splitting row/signature styles follow the reviewed template. New code is lazy-loaded: cPanel build JS about 6.02 KiB gzip and CSS 0.77 KiB gzip; no dependency added.

## Verification

- TDD: missing draft/document module tests failed before implementation; then 5 pure tests passed. New source-boundary regression reproduced unwanted initializer calls before removal and passed afterwards. Readiness regression reproduced premature re-enabling after reset, then passed after invalidating the loaded document on every edit. Editor/source/pure tests total 7.
- Full admin rerun: 103 files / 277 tests passed. A pre-existing dashboard test initially failed because a rolling 30-day date range moved beyond fixed November fixtures; the test now fixes only the Date clock to `DEMO_NOW`, preserving its expected count and business logic.
- TypeScript/lint/catalogue validation passed; 255 Node/backend/tooling cases on Windows: 249 passed / 6 POSIX skips; dev watcher passed. Initial local check stopped at browser stage because the manually opened dev server occupied port 5173. After stopping that server, all four remaining real MySQL/Chromium suites passed (auth 208.7s, access logs 63.8s, usability 65.8s, profiles 82.3s), exit0. Main Linux CI ran the full check/build successfully, including 255 Node cases without Windows skips.
- Local production artifact build exited0. Its pre-commit local manifest is not the deployed artifact; production used only the successful main CI artifact above.
- Authenticated local browser: open saved slip, edit customer, VAT on/off, show print preview, return to original detail. Original total remained 280,000 VND. Responsive viewport checks had equal document client/scroll width; mobile edit/preview toggle worked. Edge native print preview showed one-page PDF document with just the delivery slip.
- Production browser: reloaded existing admin tab, opened `PMH-2026-0002`, loaded linked product/customer fields, edited print-only customer and enabled VAT. Verified 280,000 + 22,400 VAT = 302,400 and matching Vietnamese words. Returning to detail preserved original customer snapshot, no-VAT flag and 280,000 total. Reopening discarded transient customer edits. Native Edge print preview from the HTTPS production URL showed one page, all 7 columns, VAT/totals and both centered signature blocks; canceled without physical printing.
- Public smoke: Đà Lạt product heading and visible product image loaded after release. No public content edits.

Local evidence (ignored): `.superpowers/slip-print-check.log`, `slip-print-browser-check.log`, `slip-print-build.log`, `slip-production-preview.jpg`, `slip-production-native-print.jpg`. Native preview verifies browser PDF rendering; no saved PDF file, physical printer output or long multi-page print acceptance is claimed.

## Files and remaining scope

New `sales/print-draft.ts`, `print-document.ts`, `print.css`, `components/slip-print.tsx`; updated `pages/slip-detail.tsx`; three print test files and deterministic `dashboard-access.test.ts`; admin guide, design and implementation plan. All paths are under the existing admin feature/test/document structure. The current business store remains per-browser; persistent print drafts and MySQL business-module integration are future work.
