# Delivery Slip Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the approved editable delivery-slip preview and deploy it with current browser data.
**Architecture:** A typed read adapter maps linked records to a transient draft; pure validation/calculation/document modules feed a React editor and isolated printable iframe. The saved-slip detail mounts the editor without changing route or business records.
**Tech Stack:** Existing React, TypeScript, TanStack Query, Vitest; no dependencies or DB migration.
**Spec:** docs/superpowers/specs/2026-11-12-delivery-slip-print-design.md

## Global Constraints

- No business-record writes or report changes; current dump/browser data only.
- Preserve permissions and HTTP authentication; do not introduce fallback fixture login.
- Integer VND, editable 0–100% VAT with two decimals, maximum 100 lines.
- No force push or rewritten published history; release only through successful main CI.

## Review Focus

- Deleted/inaccessible relations use snapshots; unexpected failures remain visible.
- Empty numeric input, unsafe totals and invalid dates block printing.
- User text is escaped in the isolated HTML document.
- Long multi-page lines repeat headers and retain complete totals/signatures.
- Reset, close and print must never mutate the original records.

### Task 1: Draft/data boundary and printable document

**Files:** sales/print-draft.ts, sales/print-document.ts; tests/admin/slip-print.test.ts.
**Interfaces:** `SlipPrintSource` asynchronous customer/product readers; `loadPrintDraft`, `calculatePrintTotals`, `amountInWords`, `printDocument`.

- [ ] Write and run failing tests for linked data, fallback, immutability, VAT/words/escaping/validation.
- [ ] Implement typed source/draft, exact arithmetic and escaped A4 document; run tests green.

### Task 2: Integrated editor

**Files:** sales/components/slip-print.tsx, sales/print.css, sales/pages/slip-detail.tsx; tests/admin/slip-print-ui.test.tsx.
**Interfaces:** editor receives saved `PurchaseSlip` and close callback; uses runtime entity services through `SlipPrintSource`.

- [ ] Write failing interaction tests for changing VAT, numeric invalidity, reset and no writes.
- [ ] Implement responsive editor/preview, iframe readiness and native print; test green.
- [ ] Inspect desktop/mobile local UI and print output; fix observed problems.

### Task 3: Verify and release

- [ ] Run TypeScript/lint/admin tests/full check and production build; record actual outcomes.
- [ ] Request one whole-change review and address important findings with tests.
- [ ] Commit/push without rewriting history, obtain successful main CI artifact.
- [ ] Run manual production deploy, verify live version and browser print flow; record previous release/rollback target and remaining limitations.
