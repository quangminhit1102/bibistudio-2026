# SDD ledger — plan: docs/superpowers/plans/2026-10-30-bibistudio-cicd.md

## Setup

- Base implementation commit: 6346525. Approved spec, runbook and plan checkpointed. No implementation pushed yet.
- Baseline: `node --test scripts/*.test.mjs`: 14/14 pass.
- Ruling: native managed worktree was created but sandbox denies Git access there. Following worktree skill fallback, implement in original writable checkout on branch `codex/fullstack-cicd`. Main stays untouched after documentation checkpoint. Cost: development checkout now displays the feature branch.
- Runtime: bundled Node v24.22.1, same as hosting. System default is Node v25.9.0; all validation commands explicitly select bundled Node 24.
- Pre-flight interfaces: API ReleaseInfo feeds FE/version, build manifest and deployment smoke; shared schema is releaseId/sourceSha. Local runner and preview both own child lifecycle. Upload receiver and CI use check/upload/deploy/rollback. Root install hook installs backend once; backend runtime installation has no root hook. No conflicts found.
- Browser confirmed GitHub repository is public and signed-in account owns it; Settings and Actions available. SSH runner authentication and staging are still unproven.

## Tasks

- Task 1: complete — compiled backend tests 3/3 pass on Node 24.22.1, using actual HTTP and a compiled server subprocess. Sandbox blocked localhost fetch initially; rerun with authorized network access passed.
- Ruling: backend tests use .mjs against compiled CommonJS instead of a TS test loader, so tests exercise deployed output directly. No runtime behavior changed.
- Finding: original root package-lock.json was stale relative to package.json; npm ci failed before any new install hook. Synchronized the root lockfile with declared package versions using npm on Node 24. Will commit with local tooling.
- Task 2: local FE/BE tested in browser, BE reload observed, Node inspector attached with pause/resume and TS script discovery; Ctrl+C released ports 5173/3001/9230 on Windows. Process tests 3/3 pass. Full npm ci after install hook remains to verify.
- Task 3: API client tests 3/3 pass; browser /api-test showed FE/BE local versions matched. npm run check passes 33 total tests, types and scoped lint.
- Task 4: actual Lovable .output and CSR dist-cpanel builds passed and generated a 187 MB release archive. Compiled preview test fetched FE, API and real image successfully. Manifest/bundle tests passed.
- Ruling: restored lockfile exposed loader inference errors in two existing blog pages. Added explicit types from existing data functions, without changing runtime behavior; root tsc is now green.
- Finding: browser reported nested html from existing SSR shell inside CSR root. Added a CSR-only shell branch; SSR output stays unchanged. Browser verification of the fix is pending.
- Ruling: deployment tooling has its own package/lockfile (tar parser), installed by the same root npm ci hook. This keeps the forced-command receiver independent of application releases; user-facing command count stays three.
- Continuation: recovered all 43 in-progress files from original checkout into the now-accessible managed workspace on `codex/fullstack-cicd-continue`, based on a97122b. Original checkout preserved.
- Verified root npm ci on Node 24 including backend/ops hooks. First attempt selected Node 25 for npm lifecycle due PATH; corrected PATH and full install passed.
- Fresh npm run check: 40/40 tests passed, both typechecks, scoped lint and offline catalogue validation. Fresh full build produced Lovable .output and cPanel CSR + compiled API archive successfully. Actual browser preview /api-test shows matching FE/BE; no console warnings/errors. Visible product images loaded, offscreen lazy images intentionally not fetched.
- Task 5: receiver/activation fixture tests pass, including a newly reproduced first-deploy failure that left routing changed (RED); fixed restoring original routing/removing current (GREEN). Baseline restoration and distinct rollback failure tested. Added successful-release retention and immutable archive/quota tests; actual host lock/routing still pending.
- Task 6: four workflows and deploy client implemented. Trust checks reject fork/PR/failed/non-main/wrong SHA/wrong workflow runs; production requires successful staging evidence for exact artifact. Policy/smoke tests pass. GitHub jobs have NOT run yet.
- Ruling: shared hashed assets are retained indefinitely rather than automatically deleted after 30 days, avoiding removal of unknown pre-cutover files; hard quota refuses new uploads. Cost: operator may eventually need to review storage and remove verified expired assets.
- Actual cPanel created staging.bibistudio.vn with /home/vhplasti/staging.bibistudio.vn. Zone Editor confirms A 103.130.217.103; local public lookup still NXDOMAIN and direct ns1 lookup timed out. HTTPS not proven; production unchanged.
- Task 7: pending real provisioning and runner tests.
- Task 8: pending real production release and verification.

## Review and continuation evidence

- Independent read-only review of 6346525..be3e50d: no Critical, six Important findings, no deferred Minor findings. One fix pass follows; no second review planned.
- Final: fixed public routing permissions — `.htaccess` now explicitly 0644, private state stays 0600. Regression is POSIX-only, skipped on Windows; Linux CI must verify it before live activation. Windows tests cannot certify Apache permission bits.
- Final: fixed production activation without prior recovery target — regression rejected the old implementation (RED); guard now requires a valid successful prior release/baseline before mutation (GREEN).
- Final: fixed preview homepage GET/HEAD — HTTP regression observed 404 (RED), now serves index and empty HEAD (GREEN).
- Final: fixed dev watcher readiness — actual orchestrator regression failed missing unavailable state (RED); temporary source crash now reports UNAVAILABLE, restored source reports READY, close frees all three ports (GREEN). Regression also caught `/api-test` matching the API proxy when no HTML Accept; tightened API prefix matching.
- Final: fixed storage accounting — counts retained assets outside release root and reserves expansion/copy/runtime headroom; quota/free-space regressions RED→GREEN.
- Final: fixed old-client acceptance — new two-release HTTP regression checks an uncached old script after promotion, missing asset is rejected. Deploy client now keeps a real browser open across activation, verifies old assets and navigation, then fresh browser smoke. Real hosting observation still pending.
- Fresh suite after fix pass: npm run check on Node24 → 47 tests, 46 pass, 0 fail, 1 POSIX permission skip on Windows; both typechecks/scoped lint/catalogue pass.
- Ruling: increase per-environment quota example to 4 GiB because real site is 431 MB and five retained releases plus extraction need more than 2 GiB. Account is 5.46/15 GB; hard disk checks still apply. Cost: more disk may be allocated, operator must watch account-level quota.
- Final: Ruling: SSH/DNS/HTTPS/Passenger/symlink/Linux lock behavior set aside by reviewer remains live acceptance work, not inferred from fixture tests. Cost if unverified: CD cannot be declared complete.
- Final: Ruling: production baseline creation remains a provisioning step; code guard prevents cutover without it. Cost if baseline verification fails: production promotion must wait.
- Final: Ruling: GitHub protections/hosted workflows/promotion/rollback require actual run evidence. Cost if unavailable: corresponding CD deliverables remain pending.
- Final: Ruling: indefinite asset retention stands with repaired quota accounting. Cost: later operator storage review may be needed.
- Final: Ruling: database/authentication/tenant isolation stay outside this API demo iteration. Cost: future features need their own design.
- Actual hosting: staging Passenger created at `/api`, Node24.22.1 production; app root `/home/vhplasti/bibi-deploy/staging/app`, nodevenv matches that nested path. Existing /node-test unchanged. AutoSSL explicitly failed DNS DCV/HTTP DCV because staging does not resolve publicly; only self-signed certificate currently. Tino account login is required to inspect public DNS outside cPanel.
