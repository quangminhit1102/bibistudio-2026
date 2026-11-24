# Reusable platform, phase 3b: seeded image references and the tool that changes them

Spec: `docs/superpowers/specs/2026-11-22-reusable-platform-design.md`, "Giai đoạn 3".
Stacked on phase 3a (PR #9). No migration. This PR changes no production data; the data
change is a separate, approved step described in `docs/content-image-refs.md`.

## What production holds today (read on 2026-11-23)

- `/api/public/products`: 74 products, the same slugs as the bundled catalogue. 68 of them
  carry 77 image references of the form `/api/media/catalogue-image-<slug>-N`; every one
  returns HTTP 400. The same images are served at `/catalogue/*.webp` (HTTP 200). Six
  products have no image in the catalogue either.
- `/api/public/posts`: 10 posts, the same slugs as the bundled journal. Every cover is
  `/api/media/journal-cover-<slug>` and returns HTTP 400. The bundled covers are built from
  `src/assets/blog`, so their URL carries a hash that changes with each build; a database
  row cannot name them.
- Pages look right only because `src/lib/content-adapter.ts` replaces the API's images with
  the bundled ones for every slug it knows.

Changing the seed file does not repair this: `backend/src/content/seed.ts` inserts posts and
products only into an empty database.

## Why 3b is split again

The spec orders the work: fix the data, check production, then drop the bundled data. The
first two need a deploy and an approval between them, so they cannot be one PR.

- **3b-1 (this plan):** everything that is safe to deploy before the data changes.
- **Data change (not code):** run the generated SQL on production after the owner approves
  it. Runbook: `docs/content-image-refs.md`.
- **3b-2 (next plan):** once `verify` reports READY on production, move
  `src/data/catalogue.ts`, `src/data/blog.ts`, `public/catalogue` and `public/journal` into
  `site/seed` and `site/public`, and stop using bundled data when the API fails (security
  item S4).

## Design of 3b-1

1. **Journal covers get a stable address.** The ten files move from `src/assets/blog` to
   `public/journal`; `src/data/blog.ts` names them as `/journal/<file>.jpg`. The rendered
   pages keep the same images.
2. **The seed stores public paths.** `scripts/generate-content-seed.mjs` writes
   `/catalogue/...` for product images and `/journal/...` for post covers, so a new site's
   database is correct from its first deploy. The API already returns a value that starts
   with `/` unchanged (`backend/src/content/public-service.ts`). A post's cover goes to
   `image_id`, the column the admin's cover picker edits, and `cover_image_id` stays empty:
   the public API prefers `cover_image_id`, so a path kept there would hide every cover an
   editor picks later. `image_id` is `VARCHAR(64)`; a longer path stops the generator.
3. **The admin shows a public path.** `resolveMedia` returns an id that is a public path as
   the image URL instead of asking `/api/media/` for it, so the product and post forms keep
   showing the image after the data change.
4. **`scripts/content-image-refs.mjs`.** `plan` reads the seed and a site's public API and
   writes a report and three SQL files (preview, apply, rollback); `verify` checks that every
   seed entry is in the API and every image the API names loads. The tool never writes to a
   database. A row is planned only while it still holds exactly what a seed stored (the
   placeholder, or for a cover the `/assets/blog/<file>` path of the seed before this one),
   and only when its new file is already served. `verify` requests only the site's own
   addresses, without following redirects; it expects an image where the seed had one, so a
   post an editor published without a cover does not fail it.

## Tasks

1. `content-image-refs.mjs` with tests for planning, the SQL guards, escaping and `verify`.
2. Move the journal covers; update `src/data/blog.ts`.
3. Seed generator writes public paths; regenerate both seed files.
4. `resolveMedia` accepts a public path.
5. Trial of the generated SQL on a scratch MariaDB: preview, apply twice, rollback twice, a
   row edited between apply and rollback.
6. Runbook `docs/content-image-refs.md`, `AGENTS.md`, `npm run check`, `npm run build`, open
   the PR (no merge).

## Not in this PR

- Running any SQL on production.
- Removing the bundled fallback or moving data into `site/` (3b-2).
- Inline images of the seeded posts (`journal-inline-<slug>-N`): the public article already
  leaves them out; they are an admin media question for phase 4.
