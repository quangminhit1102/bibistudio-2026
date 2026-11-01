# Responsive fixes and hero dots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Improve verified responsive issues locally, show four Explore Vietnam products and refine hero controls without redesigning BiBi Studio.

**Architecture:** Keep existing React/Tailwind components and catalogue data. Use Lovable source-review findings and hero recommendation as input; validate suspected issues in a browser before applying minimal changes. Keep all application changes local for review.

**Tech Stack:** React19, TanStack Router, Tailwind4, Node24, existing check/build scripts, connected browser.

**Spec:** docs/superpowers/specs/2026-11-01-responsive-fixes-design.md (approved by user).

## Global Constraints

- Four products in catalogue order, two columns/two rows in the Explore Vietnam home section.
- Remove hero image caption only; retain main hero headline, images/alt text,5500ms autoplay and reduced motion.
- Circular bottom-centred indicators; tap targets at least44×44 CSSpx, accessible names/current state/keyboard focus.
- Keep Lora/Inter, palette, content, zoom3×, bidiary, footer treatment, API and CI/CD; no dependency additions.
- No production push/deploy; deliver a new local preview with real evidence.

## Review Focus

- Long Vietnamese headings at360px must wrap without horizontal overflow (Task2).
- Header/navigation at1024px must not collide; mobile menu/filter/search must stay operable at360×640 (Task2).
- Product fixed contact bar, floating contacts, back-to-top and fullscreen must not overlap controls or obscure final content (Task2).
- Hero dots over bright/dark slides must remain visible, focusable and select the correct image; reduced-motion state must stop autoplay (Tasks1/3).
- Lazy images must be distinguished from failed images; route navigation and current production social/zoom changes must remain intact (Task3).

## Files and boundaries

- Modify src/routes/index.tsx: four-product limit/grid and HeroSlides caption/indicator presentation.
- Candidate files only when a runtime defect is reproduced: src/components/site-header.tsx, back-to-top.tsx, floating-contact.tsx, product-contact-bar.tsx, quick-search.tsx, src/routes/products.index.tsx, products.$slug.tsx, contact.tsx, blog.index.tsx, src/styles.css.
- Create docs/responsive-local-review-2026-11-01.md: audit matrix, Lovable provenance, confirmed/not-reproduced findings, fixes, verification and preview reference.
- Do not extract new components or add tests that merely assert Tailwind source strings for these reversible UI edits; use before/after browser assertions.

### Task1: Homepage products and hero controls

**Interfaces:** Home reads productsByCollection("explore-vietnam"); HeroSlides({slides: Slide[]}) keeps its current API and state.

- [ ] Capture baseline home mobile: Explore Vietnam has3 cards and hero still has caption/line indicators.
- [ ] Apply Lovable recommendation from message umsg_01m6as0502fqhbbef7d8rnzc20 locally: remove caption/link and unused cur variable; centre a subtle dark translucent rounded indicator backing;6px outline inactive dots,8px solid ivory active dot,44px buttons, group label Chọn ảnh, existing Ảnh N labels and aria-current, visible focus, motion-reduce transition disabled. Use bottom20px mobile/24px desktop. Keep main headline and timer logic.
- [ ] Change Explore Vietnam selection slice(0,4), remove sm:grid-cols-3 from its grid, retaining grid-cols-2 and existing gap.
- [ ] In browser verify exactly4 product links in that section,2 distinct column positions and2 row positions. Select first/last hero dots and verify active image/current state; inspect44px bounds and keyboard focus, check bright/dark slides.
- [ ] Commit homepage change locally after checks.

### Task2: Verify and fix responsive defects

**Interfaces:** Existing route/component APIs remain unchanged. Findings must include URL, viewport, observed defect and screenshot/DOM evidence before a candidate file is modified.

- [ ] Run baseline route matrix at CSS widths360,390,768,1024,1440: /, /products, /products/notebooks, /collections, /collections/explore-vietnam, /collections/greeting-cards, /products/da-nang-map-notebook, /blog, a real article discovered from listing, /about, /contact, /api-test. Measure scrollWidth<=innerWidth and inspect headings/controls; scroll for lazy content.
- [ ] On360×640 exercise menu open/navigation/close, search input/results/close, product filters apply/clear/close and focus accessibility. At1024 inspect desktop header collision. On product mobile inspect contact bar/back-to-top at page bottom and fullscreen open/close; do not send messages or calls.
- [ ] Reproduce Lovable suspects: What we make text overflow, tablet contact map/button wrapping and fixed bottom overlap. Do not standardize gutters or change breakpoint just for stylistic consistency when no defect exists.
- [ ] For each confirmed defect apply smallest CSS/markup fix in its owning file, then repeat the exact failing viewport/action and adjacent breakpoint. If it needs a main-layout redesign, report it instead of expanding scope.
- [ ] Record confirmed fixes and not-reproduced suspects in review document. Commit fixes locally when their targeted checks pass.

### Task3: Build and deliver local review

**Interfaces:** Existing npm run check/build; scripts/preview.mjs accepts built release-directory path, PREVIEW_PORT sets new free port.

- [ ] Use bundled Node24; run npm run check and require exit0. If sandbox prevents HTTP test servers, rerun with proper escalation; report actual results.
- [ ] Commit source locally; npm run build must exit0 and create local-<SHA> bundle. Start preview via separate scripts/preview.mjs command on a free port; do not use broken build --preview shortcut or replace user's older preview without notice.
- [ ] On built preview repeat route overflow checks and targeted interaction tests. Verify Lora loaded, bidiary hrefs, zoom3×, absent giant footer wordmark, working product images and FE/BE API-test version. Check reduced-motion autoplay behavior using browser-supported emulation if available; otherwise state limit explicitly and verify source guards without claiming runtime coverage.
- [ ] Capture final home mobile2×2, hero desktop/mobile dot controls and evidence of other fixed defects; reset viewport overrides. Update review document with exact matrix, results, preview URL and limitations.
- [ ] Deliver local preview link and concise change/test summary. Keep production unchanged and do not push.

## Self-review

Spec coverage: all requirements map to Tasks1–3. No new cross-task interfaces or dependencies. Browser checks cover all five review-focus conditions; source inference is never reported as runtime proof. Existing automated check/build supplement the UI evidence.
