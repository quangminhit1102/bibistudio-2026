# Customer import and inventory (batch 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins import many customers from an `.xlsx` file with preview, validation and duplicate handling, and the inventory page shows only product, stock and a manual adjustment whose history is stored on the server.

**Architecture:** Content migration 004 adds `customers.representative`, `customers.extra` and `stock_movements`. The browser parses the workbook and sends rows to `POST /api/customers/import` (dry run, then an atomic commit); stock changes go through `POST /api/products/:id/stock-adjustments`, which writes a movement and an audit row in the same transaction. Extra customer fields are declared in `site/customers.config.ts`.

**Tech Stack:** TypeScript, Express + mysql2 (MariaDB), React + TanStack Query, Vitest, node:test, Playwright; `read-excel-file` 9.3.20 and `write-excel-file` 4.1.1 (both MIT), loaded with dynamic `import()`.

**Spec:** `docs/superpowers/specs/2026-11-24-customer-import-inventory-design.md` (approved by Minh 2026-11-25).

## Global Constraints

- Nothing is deleted: `products.reserved` stays in the DB and in order logic; existing customer and product APIs keep their current fields and behaviour.
- `.xlsx` only, at most 2 MB and 1,000 data rows; blank rows ignored; unknown columns reported and ignored.
- VAT cell: "Có" → 8, "Không" → 0, a number stays that number; anything else is a row error.
- Missing kind: name containing "Công ty"/"CTY"/"TNHH"/"Cổ phần" → company; "Nhà sách"/"NXB" → bookstore; else individual (case- and accent-insensitive). Shown in preview, editable.
- Duplicate keys: name (trim, collapse spaces, case-insensitive), phone digits only, email lower-case; against existing customers and earlier rows in the file. Default action `skip`; also `update` (existing) or `create`.
- On `update`, a blank import cell keeps the existing value.
- Commit is all-or-nothing: any row error or revision conflict writes nothing.
- Stock after adjustment must be ≥ 0 and ≥ `reserved`; delta is a non-zero integer; reason required (≤ 500 chars).
- Permissions: import needs `customer.create` (and `customer.update` when any row updates); stock adjustment needs `product.update`; history needs `product.view`.
- Product deletion keeps its movements (no foreign key).
- Brand values only under `site/`; the blank site gets every new required site file; `npm run check` and `node scripts/check.mjs blank-site` pass.
- No force-push/rebase/amend on pushed commits.

## Review Focus

1. A workbook whose header row is not row 1 or has merged/blank header cells → header detected by matching known labels in the first 10 rows; otherwise a clear "Không tìm thấy dòng tiêu đề" error (Task 5 test).
2. The same customer twice in the file with different spelling of spaces/case → second row marked duplicate of the first (Task 2 test).
3. Two admins adjusting the same product at once → one succeeds, the other gets 409 and nothing is written for it (Task 3 test).
4. Phone cell read as a number (leading 0 lost, e.g. 912345678) → keep as text from the cell; a 9-digit mobile without leading 0 gets "0" prefixed (Task 5 test).
5. Import committed after another admin edited a matched customer → 409 `REVISION_CONFLICT`, no rows written, preview reloads (Task 2 test).

---

### Task 1: Migration 004 and deploy-tool metadata

**Files:**
- Create: `backend/content-migrations/004_customers_inventory.sql`
- Modify: `backend/src/content/schema.ts` (allTables, versionStepCounts `[4, 2]`, asset name list, fourth statement checks, version 4 asset; move `customers` from v1 `verifyTargets` to v4 `verifyTargets: ["customers","stock_movements"]`)
- Modify: `ops/content-metadata.cjs` (`MIGRATION_FILES` + comment)
- Modify: `backend/test/content-schema.test.mjs`, `scripts/content-release.test.mjs`, `docs/build-and-deploy.md`
- Create: `/home/ubuntu/bootstrap/bootstrap-deploy-tools.sh` regenerated for the merge commit (outside repo; pinned SHA + recomputed SHA256SUMS)

**Interfaces:** Produces columns `customers.representative VARCHAR(255) NULL`, `customers.extra JSON NULL`, table `stock_movements(id VARCHAR(36) PK, product_id VARCHAR(36), product_name VARCHAR(255), delta INT, stock_before INT, stock_after INT, reason VARCHAR(500), source VARCHAR(32), actor_id VARCHAR(36) NULL, actor_name VARCHAR(255) NULL, created_at DATETIME(3), KEY(product_id, created_at), KEY(created_at))`.

- [ ] Tests: empty DB migrates to 4 (checksum4, new columns, table); v3 DB with customers keeps rows and upgrades; dirty v4 resumes; "newer version" fixture becomes 5; v4 has 2 steps; release metadata accepts four files, count 4, rejects a gap/wrong name.
- [ ] Run `npm --prefix backend run build && node --test backend/test/content-schema.test.mjs scripts/content-release.test.mjs` → FAIL, then implement → PASS.
- [ ] Commit `feat(content): migration 004 adds customer representative/extra and stock movements`.

### Task 2: Customer fields and import API

**Files:**
- Modify: `backend/src/content/service.ts` (customerDto, create/update columns, new `importCustomers`)
- Create: `backend/src/content/customer-import.ts` (normalisers, duplicate matching — pure functions)
- Modify: `backend/src/content/routes.ts` (schemas add `representative?: string|null`, `extra?: Record<string,string|number|boolean|null>`; route `POST /customers/import` registered before the generic `/customers/:id` routes)
- Test: `backend/test/customer-import.test.mjs` (HTTP, MariaDB) and `backend/test/customer-import-unit.test.mjs`

**Interfaces:**
- `normalizeName(s: string): string`, `phoneDigits(s: string): string`, `normalizeEmail(s: string): string` in `customer-import.ts`.
- `importCustomers(input: { dryRun: boolean; rows: ImportRow[] }, actor): Promise<ImportResult>` where `ImportRow = { row: number; action: "create"|"update"|"skip"; targetId?: string; revision?: number; fields: CustomerInput & { representative?: string; extra?: Record<string, unknown> } }` and `ImportResult = { rows: { row: number; status: "ok"|"error"|"duplicate"; errors: { field: string; message: string }[]; matches: { id: string; name: string; revision: number; by: ("name"|"phone"|"email")[] }[]; inFile?: number }[]; created: number; updated: number; skipped: number; committed: boolean }`.
- Body limit: 1,000 rows (400 `TOO_MANY_ROWS`).

- [ ] Tests: dry run reports duplicates by each key and in-file duplicates without writing; commit creates/updates/skips and returns counts; blank cell on update keeps old value; any invalid row → 400 with per-row errors and zero writes; stale revision → 409 and zero writes; user without `customer.create` → 403; update rows without `customer.update` → 403; audit `customer.import` with counts; existing customer GET returns `representative` and `extra`.
- [ ] FAIL → implement (one `authorized()` transaction, `SELECT ... FOR UPDATE` on target rows) → PASS.
- [ ] Commit `feat(customers): representative, extra fields and atomic import API`.

### Task 3: Stock adjustment and movement history API

**Files:**
- Modify: `backend/src/content/service.ts` (`adjustStock`, `listStockMovements`; `updateProduct` writes a `source:"product_edit"` movement when `stock` changes)
- Modify: `backend/src/content/routes.ts` (`POST /products/:id/stock-adjustments` body `{revision:int≥1, delta:int≠0, reason:string 1..500}`; `GET /stock-movements?productId&page&pageSize`)
- Test: `backend/test/stock-movements.test.mjs`

**Interfaces:**
- `adjustStock(id: string, input: { revision: number; delta: number; reason: string }, actor): Promise<ProductDto>`; source `"manual"`.
- `listStockMovements(input: ListInput & { productId?: string }, actor): Promise<Page<StockMovementDto>>`, `StockMovementDto = { id, productId, productName, delta, stockBefore, stockAfter, reason, source, actorId, actorName, createdAt }`, newest first.

- [ ] Tests: adjustment updates stock, bumps revision, writes movement + audit `product.stock_adjust`; below 0 or below reserved → 400 `STOCK_BELOW_RESERVED`, nothing written; stale revision → 409; two concurrent adjustments → one 200, one 409; no `product.update` → 403; history filtered by product, sorted newest first; product delete keeps its movements; product edit changing stock writes a movement.
- [ ] FAIL → implement → PASS. Commit `feat(inventory): server stock adjustments with movement history`.

### Task 4: Site customer field config and customer forms

**Files:**
- Create: `site/customers.config.ts`, `tests/fixtures/site-blank/customers.config.ts`
- Modify: `src/platform/site-contract.ts` (`CustomerFieldConfig`, `defineCustomers`), `src/platform/site.ts` (export `customers`)
- Modify: `src/features/admin/services/contracts.ts` (`representative?: string; extra?: Record<string, string|number|boolean|null>`), `src/features/admin/customers/config.tsx`, `pages/detail.tsx`
- Test: `tests/admin/customer-fields.test.tsx`

**Interfaces:** `CustomerFieldConfig = { extraFields: { key: string; label: string; type: "text"|"number"|"boolean"; importHeaders?: string[] }[] }`; BiBi default `extraFields: []`. Core import headers (Tên khách hàng, Loại, Địa chỉ, Điện thoại, Email, Người đại diện, VAT, Thông tin/Ghi chú) live in core; site adds only extra fields.

- [ ] Tests: form shows "Người đại diện" and every configured extra field; detail shows them; saving sends `extra`; blank site builds with empty extra fields.
- [ ] FAIL → implement → PASS (+ `node scripts/check.mjs blank-site`). Commit.

### Task 5: Excel import screen

**Files:**
- Create: `src/features/admin/customers/import/parse.ts` (workbook rows → `ImportRow[]` + header/cell errors; pure apart from the lazy library call), `import/sample.ts` (sample workbook download built from the same header list), `import/import-dialog.tsx`
- Modify: `src/features/admin/shared/entity-manager.tsx` (`EntityConfig.headerActions?: ReactNode`), `customers/config.tsx` or `pages/list.tsx`
- Modify: `src/features/admin/customers/api.ts` (or existing client) `importCustomers(body)`; browser/demo mode runs the same validation locally against the store
- Test: `tests/admin/customer-import-parse.test.ts` (fixture workbook generated with `write-excel-file`, modeled on Minh's 29-row image), `tests/admin/customer-import-dialog.test.tsx`

**Interfaces:** `parseCustomerWorkbook(file: File, fields: CustomerFieldConfig): Promise<{ rows: ImportRow[]; errors: { row: number; field: string; message: string }[]; unknownColumns: string[] }>`.

- [ ] Tests: 29-row fixture parses to 29 rows; VAT/kind rules; email/phone extracted from "Thông tin" into empty columns; header found below a title row; numeric phone keeps leading 0; >1,000 rows or >2 MB rejected; dialog: preview table with status badges, change duplicate action, edit a cell, confirm disabled while errors exist, success toast shows counts and list refreshes; button hidden without `customer.create`.
- [ ] FAIL → implement → PASS. Commit.

### Task 6: Simplified inventory page on the server

**Files:**
- Modify: `src/features/admin/shared/inventory-page.tsx` (columns: Sản phẩm, Số lượng tồn, "Điều chỉnh thủ công"; history from `/api/stock-movements` in HTTP mode), `src/features/admin/products/inventory-service.ts` (HTTP branch calls the new endpoint; browser branch unchanged), `src/features/admin/products/module.ts` (drop `browserOnly`), dashboard low-stock uses `stock`
- Test: `tests/admin/inventory-page.test.tsx`, update existing inventory tests

- [ ] Tests: table has exactly the three columns; adjusting calls the endpoint and refreshes row + history; 400/409 messages shown in the dialog; button disabled without update permission; demo mode still works; order reservation tests still pass.
- [ ] FAIL → implement → PASS. Commit.

### Task 7: Verify, document, PR

- [ ] Update `docs/build-and-deploy.md` (migration 004, bootstrap before approving), `docs/new-site.md` (customers.config), AGENTS.md line.
- [ ] `npm run check`, `npm run build`, `node scripts/check.mjs blank-site`.
- [ ] Local run with MariaDB: import the 29-row file (preview, duplicates NGỌC ANH THƯ/BA SAO, confirm), adjust stock, view history; recorded.
- [ ] Push, open PR into `main`, send Minh the regenerated bootstrap script; merge and deploy only after Minh runs it.
