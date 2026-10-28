# Local Catalogue Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the 29 catalogue images on cPanel and prevent builds from shipping broken local image references.

**Architecture:** Copy validated original JPEGs from the existing published Lovable asset URLs to `public/catalogue` and update descriptor URLs. Run offline image validation before builds; resolve these descriptor URLs against the Vite base for temporary hosting.

**Tech Stack:** Existing Node.js ESM, node:test, Vite, React and TanStack Router; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-catalogue-local-images-design.md`

## Global Constraints

- Preserve existing ASCII filenames and original JPEG contents.
- Update only descriptor `url` fields; preserve IDs and provenance.
- No catalogue redesign, replacement images, journal changes or hosting changes.
- Stop on unavailable originals; never substitute images or save HTML as an image.
- Do not rewrite published Git history.
- Deliver repaired source and verified production artifacts; report publishing status separately.

## Review Focus

- A successful HTTP response can contain HTML: test rejection by content type and image signature.
- A descriptor filename can escape its target directory: test rejection of unsafe filenames.
- An interrupted download must not leave metadata pointing at absent images: stage validated files before updating descriptors.
- Temporary hosting uses `/~vhplasti/`: test that descriptor URLs resolve beneath this prefix.
- Images can disappear after localization: test that build validation rejects missing or invalid files without network access.

### Task 1: Localize and validate catalogue originals

**Files:** Create `scripts/catalogue-images.mjs`, `scripts/catalogue-images.test.mjs`; modify 29 `src/assets/catalogue/*.asset.json`; add matching files in `public/catalogue`.

**Interfaces:** `validateImage(bytes: Buffer, contentType?: string): void` rejects invalid image signatures and incompatible supplied content types. `validateCatalogue(root: string): Promise<void>` checks descriptors and files offline. `localizeCatalogue(root: string, fetchAsset = fetch): Promise<void>` validates safe filenames, stages all downloads and updates URLs only after downloads succeed. CLI accepts `--localize`; default operation is validation.

- [ ] Write node:test fixture cases for unresolved `/__l5e/` URLs, missing files, HTML bytes, JPEG bytes, unsafe filenames, HTTP failure, and failed download leaving descriptors unchanged.
- [ ] Run `node --test scripts/catalogue-images.test.mjs`; confirm failures demonstrate missing required behavior.
- [ ] Implement the interfaces and CLI using built-in filesystem, path and fetch APIs. Derive the original asset path from preserved descriptor IDs and original filenames on `https://bibistudio-2026.lovable.app`.
- [ ] Run the test suite and the validator against the current project; confirm project validation fails for the existing unresolved descriptors.
- [ ] Run localization, validating response content types and signatures before accepting bytes. Run offline validation; require all 29 files and local URLs to pass.

### Task 2: Guard builds and verify browser rendering

**Files:** Modify `package.json`, `src/data/catalogue.ts`, `docs/cpanel-artifact-deploy.md`; create a small base-path URL helper and test if needed by the existing catalogue implementation.

**Interfaces:** Preserve all catalogue public exports. Resolve descriptor URLs with `import.meta.env.BASE_URL` at the existing asset access points. Add `validate:catalogue` and `test:catalogue` scripts; invoke validation before normal, development and both cPanel builds.

- [ ] Write tests asserting `/catalogue/example.jpeg` resolves unchanged for `/` and to `/~vhplasti/catalogue/example.jpeg` for `/~vhplasti/`.
- [ ] Run tests to confirm the temporary-base regression is caught, then implement the minimal shared URL resolver and integrate descriptor usages.
- [ ] Wire validation into all build entry points and document localization, offline checking and rebuilding.
- [ ] Run `npm run test:catalogue` and `npm run test:deploy`; require zero failures. Run temporary and production cPanel builds; require successful validation and Vite exit status.
- [ ] Inspect generated files: all 29 images present; affected image URLs no longer contain `/__l5e/`; temporary URLs have the correct prefix. Leave production output in `dist-cpanel`.
- [ ] Serve the repaired build locally and inspect representative product, collection and related-product images in the browser. Report exact checks and any blockers; do not claim live hosting has changed.
- [ ] Review the diff for unrelated changes and retain the user's existing uncommitted restoration work. Commit only task-owned files if Git permissions permit; never force-push or deploy live as part of source verification.
