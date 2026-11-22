# Reusable Platform Phase 1 (Site Config, Theme, Brand Strings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move BiBi's brand, contact, domain, theme tokens and HTML head out of core code into `site/`, read through one typed entry point, with BiBi's site rendering unchanged.

**Architecture:** `site/` holds everything brand-specific. Core reads it only through `src/platform/site.ts`, typed by `src/platform/site-contract.ts`. `@site` is a path alias to `SITE_DIR` (default `site`). A boundary test stops brand strings from returning to migrated core folders.

**Tech Stack:** TypeScript strict, Vite (two configs), Tailwind v4 CSS tokens, Vitest (`tests/admin`), `node --test` (`scripts/*.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-22-reusable-platform-design.md` (sections 6, 7 "Giai đoạn 1", 8, 9).

## Global Constraints

- Lovable: no history rewrite; keep `vite.config.ts`, `src/routes/`, `src/main.tsx` in place; branch must build.
- Both builds (`vite.config.ts`, `vite.cpanel.config.ts`) must resolve `@site`.
- Core imports `@site/*` only in `src/platform/site.ts`.
- `site/` may import `src/components/**` and `src/lib/**`; never `src/features/admin/**` or `backend/**`.
- Backend does not read `site/`. No backend, `ops/`, workflow or migration change in this phase.
- Internal identifiers stay: `BIBI_*`, `VITE_BIBI_*`, `bibi_refresh`, `bibi_visitor`, `X-Bibi-*`, `_bibi`, `bibi-logo.svg`, `bibi-mark.svg`.
- Admin UI stays Vietnamese. No i18n library.
- Only intended behavior change: canonical/SEO URLs move from `https://bibistudio-2026.lovable.app` to `https://bibistudio.vn`.
- Out of this phase: page bodies of `src/routes/index.tsx`, `about.tsx`, `contact.tsx`, `src/data/catalogue.ts`, `src/data/blog.ts`, seeds, `src/features/admin/demo/legacy-presentation.json` (phases 2–4).
- `npm run check` and `npm run build` pass before the PR.

## Review Focus

1. Site URL with a trailing slash or path: canonical URLs must not contain `//` after the host. Test in Task 1.
2. Contact with no social links or no address: header, footer and floating contact render without empty links. Test in Task 2.
3. `SITE_DIR` pointing at a folder without `site.config.ts`: build fails with a message naming the missing file, not a blank page. Test in Task 4.
4. Site name containing `&`, `<` or quotes: `<title>` and meta description in the built HTML are escaped. Test in Task 4.
5. A brand string reintroduced in a migrated core folder: boundary test fails and names file and line. Test in Task 6.

---

### Task 1: Site contract, alias and BiBi config

**Files:**
- Create: `src/platform/site-contract.ts`, `src/platform/site.ts`, `site/site.config.ts`
- Modify: `tsconfig.json` (`paths`: `"@site/*": ["./site/*"]`; `include`: add `site/**/*.ts`, `site/**/*.tsx`), `vite.cpanel.config.ts`, `vite.local.config.ts`, `vitest.admin.config.ts` (alias `@site` → `process.env.SITE_DIR ?? "site"`)
- Test: `tests/admin/site-contract.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/platform/site-contract.ts
  export type NavItem = { to: string; label: string };
  export type SocialLink = { id: string; label: string; href: string };
  export type SiteLocation = { name: string; address: string; lat: number; lng: number; query: string };
  export type SiteConfig = {
    name: string; shortName: string; url: string;
    locales: string[]; defaultLocale: string;
    contact: { phone: string; phoneDisplay: string; email: string; social: SocialLink[]; location?: SiteLocation };
    seo: { titleSuffix: string; description: string; ogImage?: string };
    fonts: { href: string }[];
    admin: { title: string; modules: string[] };
  };
  export function defineSite(config: SiteConfig): SiteConfig; // validates, returns frozen config with url normalized (no trailing slash)
  export function siteUrl(site: SiteConfig, path?: string): string; // joins without double slashes
  // src/platform/site.ts
  export const site: SiteConfig; // default export of @site/site.config
  ```
- `site/site.config.ts` values copied verbatim from `src/data/contact.ts`, `src/lib/seo.ts` (`SITE_NAME`), `cpanel.html` (description, font href): `name: "BiBi Studio"`, `shortName: "BiBi"`, `url: "https://bibistudio.vn"`, `locales: ["vi", "en"]`, `defaultLocale: "vi"`, `admin.title: "BiBi Admin"`, `admin.modules`: all eight ids from spec phase 4. Social ids: `zalo`, `facebook`, `messenger`.

- [ ] **Step 1: Write failing tests** in `tests/admin/site-contract.test.ts`:
  - `defineSite` throws for empty `name`, non-`https://` `url`, empty `locales`, `defaultLocale` not in `locales`; error message names the field.
  - `defineSite({ ...valid, url: "https://example.com/" }).url === "https://example.com"`.
  - `siteUrl(site, "/blog/a") === "https://example.com/blog/a"`; `siteUrl(site, "blog/a")` gives the same; `siteUrl(site)` gives `"https://example.com"`.
  - The real `site` from `src/platform/site.ts` has `url === "https://bibistudio.vn"` and `contact.phone === "0392969000"`.
- [ ] **Step 2:** Run `npx vitest run --config vitest.admin.config.ts tests/admin/site-contract.test.ts`; expect FAIL (module not found).
- [ ] **Step 3:** Implement contract, `site.ts`, `site/site.config.ts`, aliases.
- [ ] **Step 4:** Run the test (PASS) and `npx tsc --noEmit -p tsconfig.json` (no errors).
- [ ] **Step 5:** Commit `feat(platform): add site contract and BiBi site config`.

### Task 2: Contact and location from site config

**Files:**
- Delete: `src/data/contact.ts`
- Modify: its 17 importers (`grep -rln "data/contact" src`), plus hard-coded copies in `src/components/floating-contact.tsx`, `src/features/admin/sales/print-draft.ts`, `src/features/admin/shared/forms/editor-preview.tsx`, `src/features/admin/settings/seed.ts`
- Create: `src/lib/site-contact.ts`
- Test: `tests/admin/site-contact.test.ts`

**Interfaces:**
- Consumes: `site`, `SiteConfig` (Task 1).
- Produces: `src/lib/site-contact.ts`: `telHref(site): string` (`tel:<phone>`), `socialLink(site, id): SocialLink | undefined`, `mapLinks(location): { embed: string; maps: string; directions: string }` (same URL formats as today's `studioLocation`).

- [ ] **Step 1: Failing tests:** `telHref` returns `tel:0392969000` for BiBi; `socialLink(site, "zalo")?.href === "https://zalo.me/0392969000"`; `socialLink` returns `undefined` for a site with `social: []`; `mapLinks` output for BiBi's location equals the three current URLs byte for byte.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement helpers; replace every use. Components skip a social button when `socialLink` is `undefined` and skip the map block when `location` is absent.
- [ ] **Step 4:** Run test (PASS); `grep -rn "0392969000\|bibistudio@gmail.com\|zalo.me\|bidiary" src --include=*.ts --include=*.tsx | grep -v "src/data/\|demo/legacy"` prints nothing.
- [ ] **Step 5:** Commit `refactor(site): read contact and location from site config`.

### Task 3: SEO and domain from site config

**Files:**
- Modify: `src/lib/seo.ts` (`SITE_URL`, `SITE_NAME` derive from `site`), `src/routes/blog.$slug.tsx:13` (remove local `SITE`, use `siteUrl`), `src/features/admin/analytics/components/visitor-session-list.tsx:18-19` (use `site.url`), `src/lib/content-seo.ts` if it builds absolute URLs
- Test: extend `src/lib/content-seo.test.ts`

- [ ] **Step 1: Failing test:** canonical and JSON-LD URLs built for slug `a` start with `https://bibistudio.vn/` and contain no `lovable.app`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Test PASS; `grep -rn "lovable.app" src --include=*.ts --include=*.tsx | grep -v "lovable-error-reporting\|test"` prints nothing.
- [ ] **Step 5:** Commit `fix(seo): derive canonical URLs from site config`.

### Task 4: Theme tokens and HTML head from site

**Files:**
- Create: `site/theme.css` (the `:root` and `.dark` token blocks and the two `--font-*` values, moved verbatim from `src/styles.css`), `scripts/site-html.mjs`
- Modify: `src/styles.css` (`@import "@site/theme.css"` equivalent relative import that both builds resolve), `cpanel.html` (placeholders), `vite.cpanel.config.ts` (plugin)
- Test: `scripts/site-html.test.mjs`

**Interfaces:**
- Produces: `renderSiteHtml(html: string, site: { name, defaultLocale, seo: { description }, fonts: { href }[] }): string` replacing `%SITE_LANG%`, `%SITE_NAME%`, `%SITE_DESCRIPTION%`, `%SITE_FONTS%` (HTML-escaped; fonts become `<link rel="stylesheet">` tags); `loadSiteConfig(siteDir: string): Promise<SiteConfig>` throwing `Site config not found: <path>` when missing; `siteHtmlPlugin(): Plugin` using `transformIndexHtml`.

- [ ] **Step 1: Failing tests:** rendering the current `cpanel.html` template with BiBi values equals today's `cpanel.html` head (title `BiBi Studio`, `lang="vi"`, same description, same font link); name `A & "B" <c>` is escaped in `<title>`; an unknown `%SITE_X%` placeholder left in the template throws; `loadSiteConfig("tests/missing")` rejects with the path in the message.
- [ ] **Step 2:** Run `node --test scripts/site-html.test.mjs`; expect FAIL.
- [ ] **Step 3:** Implement; move tokens.
- [ ] **Step 4:** Tests PASS; `npm run build:cpanel` succeeds; `diff` of built `dist-cpanel/index.html` head against the pre-change build shows only asset hashes; built CSS contains `--background: oklch(0.969 0.007 95)`.
- [ ] **Step 5:** Commit `refactor(site): move theme tokens and html head into site`.

### Task 5: Brand strings in core components and admin

**Files:**
- Modify: files under `src/components`, `src/lib`, `src/features/admin` (not `demo/legacy-presentation.json`, not `**/seed.ts` data rows), and `src/routes` except `index.tsx`, `about.tsx`, `contact.tsx`, that contain `BiBi`/`bibistudio` outside the allowed identifiers. Find with `grep -rIn "bibi" -i <dirs>`.
- Move: `src/components/brand-logo.tsx` → `site/assets/brand-logo.tsx`, re-exported from `src/platform/site.ts` as `BrandLogo`, `BrandMark`.

**Interfaces:**
- Consumes: `site.name`, `site.shortName`, `site.admin.title`, `site.seo.titleSuffix`.

- [ ] **Step 1:** Record baseline: `npm run check` output and screenshots of `/`, `/about`, `/contact`, `/products`, one product, `/blog`, one post, `/admin/login` at 1440 and 390 px from a local preview.
- [ ] **Step 2:** Replace strings. Page titles use `` `${title}${site.seo.titleSuffix}` `` with `titleSuffix: " — BiBi Studio"`.
- [ ] **Step 3:** Update tests that assert literal brand text only where the literal now comes from config; assertions keep the same expected text.
- [ ] **Step 4:** `npm run check` passes; screenshots match baseline (differences explained in the PR).
- [ ] **Step 5:** Commit `refactor(site): read brand strings from site config`.

### Task 6: Boundary test and docs

**Files:**
- Create: `scripts/site-boundary.test.mjs`
- Modify: `scripts/check.mjs` (add the test to the node test list), `AGENTS.md`, `docs/build-and-deploy.md` (one section: what `site/` is, `SITE_DIR`)

**Interfaces:**
- Produces: `findBoundaryViolations({ root, site, checkedDirs, allow }): { file: string; line: number; reason: string }[]`.
- `checkedDirs` for phase 1: `src/components`, `src/lib`, `src/platform`, `src/features/admin`, `src/routes`. Excluded paths: `src/routes/index.tsx`, `src/routes/about.tsx`, `src/routes/contact.tsx`, `src/routeTree.gen.ts`, `src/features/admin/demo/legacy-presentation.json`, `**/*.test.*`, `**/seed.ts`.
- Brand tokens derived from `site`: `name`, `shortName`, host of `url`, `contact.phone`, `contact.email`. `allow`: the internal identifiers in Global Constraints.

- [ ] **Step 1: Failing tests:** a temp tree with `src/lib/x.ts` containing `"BiBi Studio"` yields one violation with file and line; `import x from "@site/site.config"` in `src/lib/y.ts` yields a violation, the same import in `src/platform/site.ts` does not; `"X-Bibi-Request"` yields none; the real repo yields `[]`.
- [ ] **Step 2:** Run `node --test scripts/site-boundary.test.mjs`; expect FAIL.
- [ ] **Step 3:** Implement; fix any real violations it finds.
- [ ] **Step 4:** `npm run check` and `npm run build` pass.
- [ ] **Step 5:** Commit `test(platform): enforce site boundary in migrated folders`.

### Task 7: PR

- [ ] Push branch, open PR against `main` describing the one behavior change (canonical domain), before/after screenshots, and what phases 2–5 still cover. Do not merge.
