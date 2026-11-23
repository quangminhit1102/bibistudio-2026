# Reusable platform, phase 3a: site pages and interface texts

Spec: `docs/superpowers/specs/2026-11-22-reusable-platform-design.md`, "Giai đoạn 3".
Stacked on phase 2b (PR #8). No database change, no data change, no visual change.

## Why phase 3 is split

Phase 3 in the spec has two halves with different risk:

- **3a (this plan):** move the brand's page bodies and interface texts out of core. Pure code
  move; the rendered pages must stay identical.
- **3b (next plan):** move the bundled catalogue, journal and images into `site/seed` and
  `site/public`, and stop using bundled data when the API fails. The spec makes this depend on
  a production data change (`image_ids` of the 74 seeded products, covers of the 10 posts) and
  on a script that compares bundled slugs with the production database. That needs its own
  PR, its own deploy and a check on production.

## Goal

After this PR another brand can replace the home, about and contact pages and every text of
the public interface by editing `site/` only.

## Design

1. **Site pages.** `site/pages/home.tsx`, `site/pages/about.tsx`, `site/pages/contact.tsx`
   hold the page bodies. Each reaches its route through one module of `src/platform/pages/`
   (`home.ts`, `about.ts`, `contact.ts`), so a page loads with its own route only; importing
   the pages from `src/platform/site.ts` would put all three in the chunk every route loads.
   The routes `src/routes/index.tsx`, `about.tsx`, `contact.tsx` keep the loader and the head
   (title and description are message keys) and render the site page. Site pages may import
   core components (`@/components/*`, `@/lib/*`); core never imports a site page except
   through `src/platform/pages/`. Images used only by these pages (`src/assets/hero-desk.jpg`,
   `src/assets/about/*`) move to `site/assets/`.
2. **Interface texts.** `site/messages/vi.ts` exports one flat object of texts. Its type
   `Messages` lives in `src/platform/site-contract.ts`, so a site that misses a key fails
   type checking. `src/lib/messages.ts` exports `t(key, values?)`, which fills `{name}`
   placeholders. Public core components (header, footer, quick search, catalogue card,
   contact band, floating contact, back to top, product contact bar, language switcher) read
   their texts through `t()`. No i18n library; the language switcher keeps its behaviour.
3. **Boundary.** `scripts/site-boundary.mjs`: drop the exclusion of
   `src/routes/(index|about|contact).tsx`. The exclusion of `collections.$slug.tsx` from the
   taxonomy check stays until 3b unless its site-specific part is small enough to move here.

## Tasks

1. `Messages` type, `site/messages/vi.ts`, `t()` with unit tests (placeholder filling, a
   missing value keeps the placeholder).
2. Move each public component's texts to `t()`; one commit per component group.
3. `site/pages/*` and the three thin routes; move page-only assets.
4. Boundary test: remove the route exclusion, run `npm run check`.
5. Compare the three pages and the header, footer and search against `main` at 390px and
   1440px (screenshots must match).
6. `npm run check`, `npm run build`, update `AGENTS.md` and `docs/`, open the PR (no merge).

## Not in this PR

- Bundled data, images and the API fallback (3b).
- Texts inside the admin (phase 4 looks at admin modules).
