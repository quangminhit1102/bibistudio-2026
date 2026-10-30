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
