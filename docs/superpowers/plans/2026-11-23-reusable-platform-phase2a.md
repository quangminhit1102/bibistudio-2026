# Reusable Platform Phase 2a (Schema Forward-Compatibility, Site Catalogue Config) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current release a safe rollback target for the phase-2 content migration, and move product attribute declarations and collection grouping out of core into `site/`, with no database change.

**Architecture:** Phase 2 of the spec is split in two because the migration cannot ship in one release (see "Why split"). This PR (2a) teaches the backend readiness and status checks, and the deploy tooling, to accept a content schema one version newer than the packaged one. It adds `site/catalogue.config.ts`, read through `src/platform/site.ts`, and removes the core's hard-coded occasion list, `greeting-cards` branch and type/collection fallbacks. PR 2b adds migration 3, `product_types`, the API and admin CRUD.

**Tech Stack:** TypeScript strict, Express + mysql2 (MariaDB), Vite, Vitest (`tests/admin`), `node --test` (`scripts/*.test.mjs`, `backend/test/*.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-22-reusable-platform-design.md` (section 4 "Migration", section 7 "Giai đoạn 2", sections 8 and 9).

## Why split

Verified in code on `main` (`4b49f9f`):
- `backend/src/content/schema.ts` `assertContentReady` requires exactly two ledger rows. With a version-3 row, the current backend answers 503 `CONTENT_NOT_READY` for every content route.
- `contentSchemaStatus` reports `incompatible` for an unknown ledger row; `ops/content-lifecycle.cjs` then throws `Unknown content schema`, so rollback to the current release fails.
- `ops/content-metadata.cjs` runs from the tools installed on the host (`/home/vhplasti/bibi-deploy/tools`) and accepts only `001_content.sql` and `002_content_v9.sql`. A release carrying a third file is rejected until the tools are bootstrapped through cPanel.

Spec section 4 requires that the previous release keeps working on the new schema. So: 2a must be deployed, and the tools bootstrapped, before 2b can merge.

## Global Constraints

- No DDL, no new migration file, no seed change in this PR.
- Lovable: no history rewrite; keep `vite.config.ts`, `src/routes/`, `src/main.tsx` in place; branch must build.
- Core imports `@site/*` only in `src/platform/site.ts`.
- Backend does not read `site/`.
- Internal identifiers with `bibi` stay.
- Admin UI stays Vietnamese.
- The third migration file name is fixed now: `003_content_catalogue.sql`.
- Public pages render the same text and layout as `main` for BiBi's data. Only intended behaviour change: a product whose type or collection is not in the known list shows that slug as its label instead of being relabelled "Sổ tay" / "Explore Vietnam".
- Reading product types and collections from the API is 2b: the existing `GET /api/public/collections` has no `intro`, `image` or translations, so switching now would drop content from collection pages.
- `npm run check` and `npm run build` pass before the PR.

## Review Focus

1. Ledger has a newer row that is not `complete`: status must not report `complete`, readiness must answer 503. Test in Task 1.
2. Ledger has a newer complete row and a known row is missing or dirty: still not ready. Test in Task 1.
3. Product with an attribute value that is not one of the declared `select` options: the value is dropped from grouping, the product still renders in its collection. Test in Task 3.
4. `groupBy` naming an attribute that is not declared or not a `select`: `defineCatalogue` throws, naming the collection and the key. Test in Task 2.
5. `SITE_DIR` without `catalogue.config.ts`: build fails with a message naming the missing file. Test in Task 2.

---

### Task 1: Backend accepts a newer complete content schema

**Files:**
- Modify: `backend/src/content/schema.ts` (`contentSchemaStatus`, `assertContentReady`)
- Test: `backend/test/content-schema.test.mjs`

**Interfaces:**
- Produces (unchanged signatures, new behaviour). "Newer row" = ledger row whose `version` is greater than the highest packaged version.
  - `assertContentReady`: passes when every packaged version has a `complete` row with its expected step count and every other row is a newer row with `state='complete'`.
  - `contentSchemaStatus`: when all newer rows are `complete`, they are ignored: `migrationChecksums` lists packaged files only, checksum comparison still applies to packaged rows, and DDL fingerprint verification is skipped (the newer migration owns those tables). Step counts and states of packaged rows still decide `complete`/`dirty`. A newer row that is not `complete` gives `incompatible`. An unknown row that is not newer gives `incompatible` as today.
  - `migrateContent`: unchanged; still throws on a newer row.

- [ ] **Step 1: Write failing tests** in `backend/test/content-schema.test.mjs`:
  - `"a newer complete schema version keeps the packaged release ready"`: migrate; `INSERT INTO content_schema_migrations(version,checksum,state,completed_steps,ddl_hashes,applied_at) VALUES(3,REPEAT('a',64),'complete',1,'{}',UTC_TIMESTAMP(3))`; `ALTER TABLE products ADD COLUMN attributes JSON NULL`; assert `assertContentReady` resolves, status is `{ state: "complete", version: 8 }` with exactly the two packaged checksum keys, and `migrateContent` rejects with `/newer/i`.
  - `"a newer incomplete schema version is not ready"`: same with `state='dirty'`; assert `assertContentReady` rejects with `{ status: 503, code: "CONTENT_NOT_READY" }` and status state is `incompatible`.
  - `"a newer complete version does not hide a dirty packaged version"`: newer complete row plus `UPDATE content_schema_migrations SET state='dirty' WHERE version=2`; assert readiness rejects and status state is `dirty`.
- [ ] **Step 2:** `node scripts/check.mjs backend` → the three new tests fail.
- [ ] **Step 3:** Implement in `schema.ts`.
- [ ] **Step 4:** `node scripts/check.mjs backend` → pass.
- [ ] **Step 5:** Commit `feat(content): accept a newer complete content schema version`.

### Task 2: Deploy tooling accepts the third migration file; catalogue contract

**Files:**
- Modify: `ops/content-metadata.cjs` (`MIGRATION_FILES`, `knownFiles`), `scripts/content-release.test.mjs`
- Modify: `src/platform/site-contract.ts`, `src/platform/site.ts`, `scripts/site-html.mjs` (existence check)
- Create: `site/catalogue.config.ts`
- Test: `tests/admin/catalogue-contract.test.ts`, `scripts/site-html.test.mjs`

**Interfaces:**
- `ops/content-metadata.cjs`: `knownFiles` accepts the first one, two or three names of `["001_content.sql","002_content_v9.sql","003_content_catalogue.sql"]`, in order. Nothing else changes.
- Produces in `src/platform/site-contract.ts`:
  ```ts
  export type Localized = Record<string, string>;
  export type AttributeOption = { value: string; label: Localized; note?: Localized };
  export type ProductAttribute =
    | { key: string; label: Localized; type: "text" | "localized-text" }
    | { key: string; label: Localized; type: "select"; options: AttributeOption[] };
  export type CatalogueConfig = {
    attributes: ProductAttribute[];
    /** Collection slug -> key of the `select` attribute its products are grouped by. */
    groupBy: Record<string, string>;
  };
  export function defineCatalogue(config: CatalogueConfig): CatalogueConfig; // validates, returns frozen
  ```
  `defineCatalogue` throws `Invalid catalogue config: <field> <reason>` for: empty or duplicate attribute `key`; key not matching `/^[a-z][a-zA-Z0-9]*$/`; `select` with no options or duplicate option `value`; `groupBy` key not declared or not `select`.
- `src/platform/site.ts` adds `export const catalogue` from `@site/catalogue.config`.
- `site/catalogue.config.ts` (BiBi): attributes in display order `dimensions` (text, "Kích thước"), `material` (localized-text, "Chất liệu"), `pages` (text, "Số trang"), `format` (localized-text, "Định dạng"), `occasion` (select, "Dịp lễ", the eight options moved verbatim from `occasions` in `src/data/catalogue.ts`, `name` → `label`); `groupBy: { "greeting-cards": "occasion" }`.

- [ ] **Step 1: Failing tests.** `scripts/content-release.test.mjs`: `validateContentMetadata` accepts three checksums keyed by the three names and rejects `003_other.sql` and the pair `001`+`003`. `tests/admin/catalogue-contract.test.ts`: one test per `defineCatalogue` error above; BiBi config has keys `["dimensions","material","pages","format","occasion"]` and eight occasion options. `scripts/site-html.test.mjs`: site dir without `catalogue.config.ts` throws `/catalogue\.config\.ts/`.
- [ ] **Step 2:** `node scripts/check.mjs static` and `node scripts/check.mjs admin` → new tests fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Both commands pass.
- [ ] **Step 5:** Commit `feat(platform): site catalogue contract; deploy tooling accepts content migration 3`.

### Task 3: Core reads attributes and grouping from the site catalogue

**Files:**
- Create: `src/lib/catalogue-attributes.ts`
- Modify: `src/data/catalogue.ts`, `src/lib/content-adapter.ts`, `src/routes/collections.$slug.tsx`, `src/routes/products.$slug.tsx`, `src/routes/index.tsx`, `src/features/admin/products/config.tsx`
- Test: `tests/admin/catalogue-attributes.test.ts`, `tests/admin/content-adapter.test.ts` (extend if present, else create)

**Interfaces:**
- Consumes: `catalogue` from `@/platform/site`, types from Task 2.
- Produces in `src/lib/catalogue-attributes.ts`:
  ```ts
  export function selectOptions(key: string): AttributeOption[];            // [] when not a select
  export function groupAttribute(collectionSlug: string): Extract<ProductAttribute, { type: "select" }> | undefined;
  export function attributeValue(product: Product, key: string): string | undefined; // localized values resolved with tx
  export function attributeRows(product: Product): [label: string, value: string][]; // text and localized-text attributes with a value, in config order
  ```
- `src/data/catalogue.ts`: remove `OccasionId`, `Occasion`, `occasions`, `productsByOccasion`; `Product.occasion?: string`; `Product.productType: string`; `Product.collection: string`; `getProductType(id: string): ProductType` and `getCollection(id: string): Collection` return, for an unknown id, an entry whose `id`, `slug` and every localized label equal the id, with empty tagline/intro and no image. Keep `ProductTypeId`/`CollectionId` as the types of the static lists.
- `src/lib/content-adapter.ts`: delete `asType`, `asCollection`; pass `api.product_type` and `api.collection` through; `occasion` kept only when it is a declared option value.
- `collections.$slug.tsx`: replace `c.id === "greeting-cards"` and `occasions` with `groupAttribute(c.slug)` and its options. `index.tsx`: occasion strip uses `selectOptions("occasion")`.
- `products.$slug.tsx`: the spec table (lines 162-165) becomes `attributeRows(p)`.
- `src/features/admin/products/config.tsx`: `occasionOptions` comes from `selectOptions("occasion")`. The other attribute form fields stay as they are: the admin store and API still have fixed columns, so generating the form from the config waits for `products.attributes` in 2b.
- `collections.$slug.tsx` also lists, under the usual "Sản phẩm trong bộ sưu tập" heading, products of a grouped collection that carry none of the declared options (empty for BiBi's data today).

- [ ] **Step 1: Failing tests.** `catalogue-attributes.test.ts`: `groupAttribute("greeting-cards")?.key === "occasion"`; `groupAttribute("motivation") === undefined`; `attributeRows` on a product with `dimensions: "A5"`, `material: { vi: "Giấy", en: "Paper" }` and no pages returns `[["Kích thước","A5"],["Chất liệu","Giấy"]]`. Adapter test: API product with `product_type: "sticker"`, `collection: "summer"`, `occasion: "unknown-day"` maps to `productType "sticker"`, `collection "summer"`, `occasion undefined`; `tx(getProductType("sticker").name) === "sticker"`; `tx(getCollection("summer").name) === "summer"`.
- [ ] **Step 2:** `node scripts/check.mjs admin` → fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `node scripts/check.mjs admin` and `node scripts/check.mjs static` → pass.
- [ ] **Step 5:** Commit `refactor(platform): product attributes and collection grouping come from site/catalogue.config`.

### Task 4: Docs, visual parity, PR

**Files:**
- Modify: `AGENTS.md` (one line: attributes and grouping live in `site/catalogue.config.ts`), `docs/build-and-deploy.md` (bootstrap is required before a release with a third content migration), spec section 7 (note the 2a/2b split).

No new boundary rule in this PR: the existing guard already forbids `@site/*` imports outside `src/platform/site.ts`. A rule against catalogue vocabulary in core would have to exempt the admin type and collection lists, which only leave core in 2b; it is added there.

- [ ] **Step 1:** `npm run check` and `npm run build` pass.
- [ ] **Step 2:** Visual parity against `main`: home, `/collections/greeting-cards`, `/collections/explore-vietnam`, `/products/notebooks`, one product detail, at 390 and 1440 px wide; rendered text identical. Record the result in the PR.
- [ ] **Step 3:** Commit, push, open the PR against `main`. Do not merge.
