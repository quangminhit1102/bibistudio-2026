# Homepage editorial — local acceptance

**Superseded — user requested reverting this UI on2026-11-07 because it did not meet their expectations. Implementation `bbf047f` was reverted by `4d90e21`. This report records the discarded local iteration, not the current UI. No part of this iteration was pushed or deployed.**

Revert verification: source under `src` and `scripts/check.mjs` matches pre-implementation `c4525f0`; TypeScript and full build exit0. Final preview uses `local-4d90e213073ab592c380159bf58d00a5d7ecbc91` at port4198. Browser confirms original English hero, five slide controls, brand statement and four contact links restored. Screenshot: `.superpowers/home-restored.jpg`. No push/deploy.

Date: 2026-11-07. Implementation commit: `bbf047ff5757a9918d5996d4cd2fce31349b0600`.
Scope: approved direction A, public homepage/shared contact/footer; EN selector retained. No push, merge or deployment.

## Implemented

- Static Vietnamese hero using existing hero-desk asset; product type links immediately below.
- Six curated product cards, natural scrolling; seven collection links including a deliberate text/icon treatment for missing artwork.
- Occasions only when published catalogue products have images. Current catalogue provides one eligible occasion; layout expands accordingly instead of inventing three more.
- Short merged studio story and contact CTA. Preserve catalogue source/routes and all contact destinations.
- Floating contact disclosure: named channels, keyboard/Escape, outside click, route/overlay dismissal, safe-area offsets. Existing global modal-hide behavior preserved.
- Public footer removes the technical API test link, retains privacy/map and adds room below controls. EN still has its pre-existing Soon status, not a newly implemented English site.
- Public behavioral tests included in standard `scripts/check.mjs`.

## Evidence

- Public tests: RED 3 homepage + 3 contact failures against previous behavior, then GREEN 6/6 after implementation, repeated after final layout polish.
- Frontend TypeScript: exit0. Offline catalogue image validation passed.
- Full local build from committed source: exit0; `.releases/local-bbf047ff5757a9918d5996d4cd2fce31349b0600.tgz` and checksum produced. Existing large-chunk warnings remain; this is not a deployment artifact approved for production.
- Browser: homepage observed at 360×800, 390×844, 768×1024, 1024×768, 1280×720, 1440×900. No horizontal overflow in those observations.
- 1280×720: main CTA bottom approximately584px, visible within first screen. 390×844: CTA bottom389px, hero image413–664px; type section starts700px.
- Images inspected directly and in rendered cards; loaded visible product images and no completed broken images found after scrolling homepage.
- Product type Sổ tay → `/products/notebooks`; first featured → `/products/da-nang-map-notebook`; occasion → `/collections/greeting-cards#womens-day-83`, observed matching 12-product target; contact page loaded with shared shell.
- Desktop language dropdown shows English Soon; mobile menu shows English/Sắp ra mắt. Search dialog and mobile menu hide contact (`display:none`); panel state resets closed. No browser console errors captured during these navigation checks.
- Footer layout has room below controls; map link/privacy retained. Map iframe content itself was not established as loaded in the captured frame.
- Screenshots: `.superpowers/home-desktop.jpg`, `.superpowers/home-mobile.jpg` (local ignored evidence, not shipped assets).

## Review / limitations

Fresh reviewer `homepage_final_review` found no Important defects. An initial stacking concern was withdrawn after confirming existing `body:has([aria-modal="true"]) .floating-contact` hide rule and direct browser verification.

Deferred minors: homepage Reveal inherits existing900ms duration rather than proposed200–350ms; secondary story photograph repeats the pressed-flower collection photograph. These are polish items, not broken navigation/data.

No five-second user study, real-device safe-area test, measured Lighthouse baseline/comparison, or live Core Web Vitals claim. Reduced-motion rules were checked in source; no OS/browser emulation was available in the used browser API. No production verification was attempted.

## Full-check status — not green

Initial check passed270 admin tests, then stopped because isolated test MySQL was unavailable. After starting Docker Desktop, the complete check passed TypeScript/lint,270 admin tests,6 public tests,249 backend/tooling tests (6 skipped by configuration), and the development watcher test. It then failed `tests/e2e/auth.spec.mjs:222`: timed out waiting for “Đã lưu vai trò và thu hồi các phiên cũ”. Later auth-UI suites were not reached by that command.

Admin source and the auth E2E test have no diff from base `c4525f0`; the failure is not yet established as pre-existing or caused by this change. An isolated rerun first could not connect to test MySQL after Docker stopped. Restarted Docker/test container and reran with `ensureTestDatabase()` (TEST_DB_READY); the isolated auth E2E hit its overall240000ms timeout, cancelled1. Logs: `.superpowers/home-check-final.log`, `.superpowers/home-auth-rerun3.log`. Never used hosting/production DB for tests. Do not describe the overall check as passing or this branch as production-ready while this remains unresolved. Homepage preview and behavioral checks are available for local visual review; overall acceptance remains incomplete.

Preview was interrupted between turns, leaving its temporary backend/node_modules junction. Verified it was a symbolic link to this workspace's backend/node_modules, removed only that link, then restarted the final artifact preview as a hidden background process. Re-observed the homepage and verified keyboard Tab/Escape behavior. No dependencies or bundle content were deleted.
