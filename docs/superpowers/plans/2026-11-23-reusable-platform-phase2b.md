# Reusable Platform Phase 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Product types become rows in the database, products carry a free-form `attributes` JSON, and the public pages and the admin read product types and collections from the API instead of lists written in core.

**Architecture:** Content migration 3 is additive: a `product_types` table, `translations` and `image` on `product_categories`, `attributes` on `products`. The seed step, which runs on every deploy, fills the new columns once from the bundled catalogue. The backend writes the legacy attribute columns and `attributes` together. The frontend keeps the bundled lists only as the value shown before the API answers and when it is unavailable; they leave the repo in phase 3.

**Tech Stack:** MySQL/MariaDB, Express, zod, TypeScript, React, TanStack Router, node:test, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-reusable-platform-design.md`, section "Giai đoạn 2".

## Global Constraints

- Migrations only add. The release at `05b7b9e` (phase 2a) must keep working on the migrated database: it is the rollback target.
- This PR must not merge before the deploy tools on the host are bootstrapped from a commit that contains phase 2a (`docs/build-and-deploy.md`, section 6). The host tools reject a release with a third migration file otherwise.
- The backend never reads `site/`. Site data reaches it through `backend/content-seed.json`.
- Existing columns stay. Legacy attribute columns (`dimensions`, `pages`, `material_vi`, `material_en`, `format_vi`, `format_en`, `occasion`) and `attributes` are written together.
- No force-push, rebase, amend or squash (Lovable).
- `npm run check`, `npm run test:admin`, `cd backend && npm test`, `npm run build` must pass.

## Decisions the spec leaves open

- `products.product_type` stores the type id (`notebook`), which differs from the URL slug (`notebooks`). `product_types` therefore has both `code` (stored on products, unique, not editable after creation) and `slug` (URL segment, unique). The spec says "slug" for both; one column cannot hold both values.
- `products.collection` stores the `product_categories.slug` (equal for all 7 current collections).
- `attributes` is keyed by the site's attribute key: `{ "dimensions": "A5", "material": { "vi": "...", "en": "..." }, "occasion": "birthday" }`. Empty values are omitted.
- While the legacy columns exist they win on read for their five keys. An older release that edits a product after a rollback only writes the legacy columns; reading them first keeps that edit visible.
- Seed backfill is idempotent and never overwrites admin edits: product types are inserted only when `product_types` is empty; a category's `translations` and `image` are set only when both are NULL; `products.attributes` only when NULL.
- Deleting a product type that a product uses is refused, like a category in use.
- Out of scope, follow-up PR: generating the admin product form's attribute fields from `site/catalogue.config.ts`. The admin form keeps its fixed attribute fields here. `src/routes/index.tsx` keeps the bundled collections: the home page moves to `site/pages` in phase 3.

## Review Focus

- A rollback to `05b7b9e` after migration 3: content API must answer, not 503.
- A deploy that stops between migration steps: status is `dirty`, the next deploy resumes only with the explicit recovery path, older releases refuse.
- Production data: 74 products with NULL `attributes` and 12 greeting cards with NULL `occasion` must come out of the backfill with exactly their legacy values.
- A product whose type or collection no longer exists (deleted or renamed): public pages show the stored value as plain text, admin can still open and re-save it after choosing a valid value.
- The API being unavailable or answering with an empty list: public pages show the bundled lists, never an empty menu.

---

### Task 1: Migration 3 and schema checks

**Files:**
- Create: `backend/content-migrations/003_content_catalogue.sql`
- Modify: `backend/src/content/schema.ts`
- Test: `backend/test/content-schema.test.mjs`, `scripts/content-release.test.mjs`

**Produces:** tables/columns below; `versionStepCounts` has `[3, 3]`.

- [ ] Write failing tests: after `migrateContent`, `product_types` exists with columns `id, code, name, slug, description, position, active, translations, image, created_at, updated_at, revision`; `product_categories` has `translations`, `image`; `products` has `attributes`; status is `complete` with a checksum for `003_content_catalogue.sql`; a database migrated with only files 1 and 2 (copy the two files to a temp directory is not possible because `assets()` checks names, so build that state by running the three files and asserting the ledger has 3 rows, plus one test that inserts rows 1 and 2 by hand through the old two-file path preserved in git history `05b7b9e`) upgrades to 3 on the next `migrateContent`.
- [ ] Migration file, three statements in this order: `CREATE TABLE product_types (...)` with `UNIQUE KEY uq_product_types_code (code)`, `UNIQUE KEY uq_product_types_slug (slug)`, `KEY idx_product_types_active (active)`, `code VARCHAR(50) NOT NULL`, `translations JSON NULL`, `image VARCHAR(500) NULL`; `ALTER TABLE product_categories ADD COLUMN translations JSON NULL, ADD COLUMN image VARCHAR(500) NULL`; `ALTER TABLE products ADD COLUMN attributes JSON NULL`.
- [ ] `schema.ts`: accept the three file names; version 3 steps target `product_types` (create), `product_categories`, `products`; `verifyTargets` become v1 `content_categories, customers`, v2 `posts, media`, v3 `product_types, product_categories, products`; `allTables` gains `product_types`.
- [ ] Run `cd backend && npm test`; commit.

### Task 2: Seed data and backfill

**Files:**
- Modify: `scripts/generate-content-seed.mjs`, `backend/src/content/seed.ts`, `src/data/content-seed.generated.json` (regenerated)
- Create: `backend/src/content/legacy-attributes.ts`
- Test: `scripts/generate-content-seed.test.mjs`, `backend/test/content-seed.test.mjs`

**Produces:**
- `ContentSeedData.productTypes: SeedProductType[]` with `{ code, slug, name, description, position, translations, image }`; `SeedCategory` gains `translations?`, `image?`.
- `legacy-attributes.ts`: `type Attributes = Record<string, string | { vi: string; en: string }>`; `attributesFromLegacy(row): Attributes`; `legacyFromAttributes(a): { dimensions, pages, material_vi, material_en, format_vi, format_en, occasion }` (null when absent); `mergeAttributes(stored: unknown, row): Attributes` (legacy columns win for the five keys).
- `translations` shape: `{ vi: { name, plural?, tagline?, intro? }, en: { ... } }`.

- [ ] Failing tests: generator emits 6 product types (`notebook` → slug `notebooks`) and 7 categories with translations; an image that is not a string literal is emitted as `null`. Seed: on a database that already has posts and products with NULL `attributes`, `seedContent` fills product types, category translations and `attributes`, and a second run changes nothing; an admin-edited category image is not overwritten; a product with `occasion = NULL` gets no `occasion` key.
- [ ] Implement; `seedContent` runs the backfill before the "posts is empty" guard and also writes `attributes`, `translations`, `image` on first-time inserts.
- [ ] Run tests; commit.

### Task 3: Product types service, attribute dual-write, validation

**Files:**
- Modify: `backend/src/content/service.ts`, `backend/src/content/routes.ts`
- Test: `backend/test/content-service.test.mjs`, `backend/test/content-http.test.mjs`

**Produces:** `service.listProductTypes/getProductType/createProductType/updateProductType/deleteProductType`; routes `/api/product-types` under permission `product`; `ProductInput.attributes?`, `ProductDto.attributes`; `CategoryInput`/`CategoryDto` gain `translations`, `image`; `ProductTypeDto` is `CategoryDto` without `parentId` plus `code`.

- [ ] Failing tests: CRUD of a product type with the four `product.*` permissions; `code` cannot be changed; deleting a type used by a product returns the same error as a category in use; creating or updating a product with an unknown `productType` or `collection` returns 400; a product written with legacy fields returns matching `attributes` and the reverse; an extra attribute key round-trips.
- [ ] Implement; commit.

### Task 4: Public API

**Files:**
- Modify: `backend/src/content/public-service.ts`, `backend/src/content/public-routes.ts`
- Test: `backend/test/content-public-http.test.mjs`

**Produces:** `GET /api/public/product-types` → `[{ code, slug, name, tagline, translations, image }]`, active rows by `position`; `GET /api/public/collections` items gain `translations`, `image`; product shapes gain `attributes`. `image` goes through `resolveImage`.

- [ ] Failing tests, implement, commit.

### Task 5: Public pages read the taxonomy from the API

**Files:**
- Create: `src/lib/catalogue-taxonomy.ts`, `src/lib/catalogue-taxonomy.test.ts`
- Modify: `src/lib/content-api.ts`, `src/lib/content-adapter.ts`, `src/lib/catalogue-attributes.ts`, `src/data/catalogue.ts`, `src/routes/products.$slug.tsx`, `src/routes/products.index.tsx`, `src/routes/collections.index.tsx`, `src/routes/collections.$slug.tsx`, `src/components/site-header.tsx`, `src/components/site-footer.tsx`, `src/components/catalogue-card.tsx`, `src/components/quick-search.tsx`

**Produces:** `getPublicProductTypes()`; `loadTaxonomy(): Promise<void>` (one request per page load, never throws); `useTaxonomy(): { productTypes, collections }`; `getProductType`, `getProductTypeBySlug`, `getCollection`, `getCollectionBySlug` read the store; `Product.attributes?`.

- [ ] Failing tests: store starts with the bundled lists; after `loadTaxonomy` with an API answer it holds the API lists in API order, with the bundled image when the API has none; unavailable API or an empty list keeps the bundled lists; a type the API adds resolves by slug; `attributeValue` prefers `attributes`.
- [ ] Implement; `/products/$slug` loader awaits `loadTaxonomy()` before deciding between listing and detail.
- [ ] Compare `/`, `/products`, `/products/notebooks`, `/collections`, `/collections/greeting-cards`, one product page against `main` at 390px and 1440px; commit.

### Task 6: Admin

**Files:**
- Create: `src/features/admin/products/pages/product-types.tsx`, `src/routes/admin.products.types.tsx`
- Modify: `src/features/admin/products/config.tsx`, `src/features/admin/services/http-entity-service.ts`, `src/features/admin/services/contracts.ts`, `src/features/admin/shell/navigation.ts`, `src/features/admin/shared/forms/editor-preview.tsx`, `src/features/admin/products/taxonomy-seed.ts`
- Test: `src/features/admin/services/http-entity-service.test.ts`, the admin product config tests

- [ ] Failing tests: the HTTP service for categories of kind `type` calls `/api/product-types`; the product form's type and collection options come from the loaded lists; a stored value outside the lists stays selectable as its own value.
- [ ] Implement the "Loại sản phẩm" page with `categoryConfig("type", ...)` (no parent field, `code` field on create), menu entry under products; remove the hard-coded `productTypes` and `collectionOptions`.
- [ ] `npm run test:admin`; commit.

### Task 7: Guard, docs, PR

- [ ] `scripts/site-boundary.test.mjs`: the admin product config must not contain BiBi type or collection values.
- [ ] `docs/build-and-deploy.md`: migration 3, bootstrap as merge condition, rollback target. Spec section "Giai đoạn 2": the `code` column and the follow-up. `AGENTS.md`: one line.
- [ ] `npm run check`, `npm run test:admin`, `cd backend && npm test`, `npm run build`; open the PR; do not merge.
