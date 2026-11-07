# BiBi editorial homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement approved “Bàn giấy BiBi” homepage locally for desktop/mobile review.
**Architecture:** Keep React/TanStack catalogue routes and local assets. Homepage presentation is isolated from catalogue source; shared contact/footer changes apply to public pages only.
**Tech Stack:** React, TypeScript, Tailwind, Lucide, existing Vitest/Testing Library.
**Spec:** `docs/superpowers/specs/2026-11-07-homepage-editorial-design.md`

## Global Constraints

- Keep EN selector and its existing behavior on desktop/mobile.
- No admin/backend changes, dependencies, remote placeholder assets, prices/cart or fabricated claims.
- No push/deploy. Preserve contact destinations and catalogue route semantics.
- Use Lora/Inter, existing palette, reduced motion, ≥44px targets.

## Review Focus

- A card crop must not cut product artwork; inspect real screenshots.
- Missing type/collection artwork must retain readable, usable navigation.
- Opening menu/search must dismiss floating contact rather than overlap.
- Keyboard dismissal returns focus appropriately, outside click must not steal focus.
- Mobile long labels/safe-area must not overflow or cover footer controls.

## Task 1: Homepage composition

**Files:** Modify `src/routes/index.tsx`; create `src/components/homepage.tsx`, `src/data/homepage.ts`, `src/styles/homepage.css`; create `vitest.public.config.ts`, `tests/public/homepage.test.tsx`.
**Interfaces:** `Homepage(): ReactElement` consumes existing catalogue/contact; `homeSelection` identifies explicit product slugs/images/kinds, without mutating catalogue. Route keeps SEO and mounts Homepage inside PageShell.

- [ ] Add behavioral tests: six type links precede featured; six featured link to real products; only nonempty occasions; static hero CTA, no slider controls. Stub router Link only, render real content/data.
- [ ] Run public tests, observe expected red assertions against current homepage behavior.
- [ ] Implement static compact hero, type tiles, 3×2/2×3 featured grid, collection lead + six smaller cards, four existing occasions, merged story/images, compact contact. Explicit image selection and safe contain/crops. Keep EN shared header intact.
- [ ] Run public tests and catalogue validation; expect all pass. Inspect asset choices and empty artwork fallback.

## Task 2: Shared public contact/footer

**Files:** Modify `src/components/floating-contact.tsx`, `src/components/site-header.tsx`, `src/components/site-footer.tsx`; create `tests/public/floating-contact.test.tsx`.
**Interfaces:** `FloatingContact()` remains same public API. A public-overlay-open custom event dismisses contact on header menu/search opening; route location change closes it. Existing global SearchOverlay must be checked for proper integration.

- [ ] Test initially collapsed, all four preserved destinations on open, Escape close + return focus, outside click closes, route/overlay close. Observe red against current bar.
- [ ] Implement disclosure popover using native buttons/links and React effects, named actions, no added package; close on navigation/menu/search, reduced-motion styles, safe-area positioning.
- [ ] Remove only `/api-test` footer link, improve public footer target sizing/bottom room. Preserve map/privacy controls and EN.
- [ ] Run public tests; expect pass.

## Task 3: Validation and review

**Files:** Create `docs/superpowers/reports/2026-11-07-homepage-local-review.md`; update plan progress.
**Interfaces:** Local preview from built frontend; no hosting mutations.

- [ ] Run project check/build with Node24 and capture actual outcomes. Fix failures within scope.
- [ ] Verify local homepage at 360/390/768/1024/1440 and 1280×720, images loaded, no overflow, first-fold hero/CTA, type links, product/collection/destination routes.
- [ ] Verify contact keyboard/outside dismissal, search/menu conflicts, EN retained on desktop/mobile, privacy/map/footer, listing/detail/contact shared-shell smoke and reduced motion.
- [ ] Save desktop/mobile screenshots and report actual evidence/remaining limits; no claim user-test5seconds or measured live Core Web Vitals.
- [ ] Fresh reviewer checks final diff/spec and documented edge cases. Address important findings, rerun appropriate checks. Commit reviewed changes locally, no push/deploy.

Execution choice: inline/native, following user's explicit “Duyệt implement”; no additional implementation approval gate. Visual review stays local.
