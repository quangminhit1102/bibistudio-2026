<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Catalogue data lives in `src/data/catalogue.ts` with product type and collection as separate dimensions; `/products/$slug` resolves type slugs to listings, otherwise product detail. Why: brand catalogue, not a shop — no prices/cart.
- Product imagery is normalized into `public/catalogue` with ASCII filenames; polished images lead and matching photographs follow in detail galleries. Why: predictable URLs, lighter pages, and consistent presentation.
- Journal imagery is bundled from `src/assets/blog` and assigned in `src/data/blog.ts`; listing cards stay square while article images render in a 3:2 frame. Why: reliable editorial imagery with consistent crops and no remote placeholders.
- Showcase motion primitives (Parallax, ScrollExpand, SplitWords, Tilt, FilmStrip, Magnifier) live in `src/components/brand/motion.tsx`; transform/opacity only and disabled under reduced motion. Why: one place for consistent, cheap, accessible effects.
- For local development, CI changes, deployment or rollback, read `docs/build-and-deploy.md` first; its status separates tested local tooling from live hosting acceptance. Why: a passing build does not prove a production deployment.
- Brand-specific values (name, domain, contact, SEO, fonts, theme tokens, logo) live in `site/` and core reads them only through `src/platform/site.ts`; `scripts/site-boundary.test.mjs` fails `npm run check` when a site value or a direct `@site/*` import appears in migrated core folders. Why: the core must stay reusable for other brands (`SITE_DIR` selects the site at build time).
- Product attributes (label, type, select options) and per-collection grouping are declared in `site/catalogue.config.ts` and read through `src/lib/catalogue-attributes.ts`; a product type or collection outside the known lists is shown by its own slug. Why: another brand declares its own attributes without editing core pages.
- Product types and collections are database records managed in the admin (`/admin/products/types`, `/admin/products/categories`); a product stores its type's `code` (never renamed) and its collection's `slug`, and the type's `slug` is only the public URL. Pages and admin forms read both lists from the API through `src/lib/catalogue-taxonomy.ts` and `useRelationOptions`, with `src/data/catalogue.ts` as the fallback when the API has none; the boundary test fails when core code names one of the site's types or collections. Why: a new type or collection is added in the admin, not in code.
