# Visitor Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship permission-controlled analytics deletion, IP exclusions and the approved UI changes, then verify production.

**Architecture:** Extend the existing visitor domain, RBAC registry and MySQL schema with an additive controls ledger. Collector checks rules before analytics writes; mutations serialize with existing visitor locks. Existing manual production CI artifact/rollback flow remains authoritative.

**Tech Stack:** React, React Query, Express, MySQL, existing test runners and cPanel Passenger.

**Spec:** `docs/superpowers/specs/2026-11-21-visitor-controls-design.md`

## Global Constraints

- Separate `customer_access.delete` / `customer_access.manage_exclusions`; require view too, no default grants to User.
- At most 200 rules; exact IPv4/IPv6 or four-octet IPv4 wildcard; reject universal wildcard.
- At most 100 unique visitor UUIDs per deletion; probe records protected.
- No cron, architecture rewrite, arbitrary forwarded-header trust or production data deletion for tests.
- UI approval and instruction to implement/deploy received; execute inline without another approval round.

## Review Focus

- Collector and deletion racing: stable visitor locks, consistent associations and counters.
- Concurrent configuration edits: revision conflict, retain editor draft.
- Missing/malformed/untrusted IP: no invented address or wildcard bypass.
- Selection after paging/filtering: clear it rather than delete invisible rows.
- Rollback compatibility: additive schema and backup assets remain usable by previous release.

### Task 1: IP rule contract and schema

**Files:** new `backend/src/visitors/exclusions.ts`, controls SQL/schema module and tests; extend registry/seed and deployment migration/backup wiring as needed.
**Interfaces:** `normalizeExclusionRules(input: string[]): string[]`, `isExcludedIp(ip: string | null, rules: string[]): boolean`; revisioned singleton `{revision, rules}` in DB.
- [ ] Write/run failing tests for wildcard bounds, mapped IPs, deduplication and malformed/universal patterns.
- [ ] Implement normalization using installed ipaddr.js and add additive migration with status verification; seed new permissions only to system-admin.
- [ ] Verify tests and migration repeatability, fail closed when controls configured but unavailable; commit.

### Task 2: Exclusion-aware collector and visitor mutations

**Files:** new `backend/src/visitors/controls-service.ts`, `controls-routes.ts`; modify collector/routes/app; add backend tests.
**Interfaces:** GET/PUT exclusions, POST bulk-delete, DELETE visitor and nested session; service actor is existing AuthPrincipal, checks current authorization inside write transaction.
- [ ] Write/run failing integration tests for no-write excluded batches, independent permissions, conflict revisions, exact deletion, probe rejection and concurrency.
- [ ] Implement settings transaction and audits, collector early return with security receipts preserved, deletion under visitor locks and counter reconciliation.
- [ ] Run domain and HTTP tests, including expired/revoked actor and invalid input; commit.

### Task 3: Approved admin UI

**Files:** visitor HTTP API/components/server-visitors, common refresh component and relevant admin reload controls, styles; `tests/admin/visitor-controls*.test.tsx`.
**Interfaces:** consume Task 2 endpoints; permission checks use existing canCode; React Query invalidation reconciles list/report/detail.
- [ ] Write/run failing UI tests for selections/confirmation/cancel/errors/permissions and copy.
- [ ] Implement IP editor, selection and per-row/session deletion, common refresh, italic notes, empty product label and inset modal scroll body.
- [ ] Verify focused UI tests, desktop/mobile browser and screenshot evidence; commit.

### Task 4: Release readiness and production

**Files:** build/receiver/backup lifecycle tests if controls ledger requires them; deployment docs and acceptance record.
- [ ] Run `npm run check` and `npm run build`; independent whole-change review and address important findings.
- [ ] Start FE/BE locally, migrate/verify local DB, verify Admin/User and exclusions/deletion on disposable fixtures.
- [ ] Commit/push without history rewrite; obtain successful main CI artifact and run manual production workflow.
- [ ] Ensure production DB backup and additive migration completed before activation. Verify version/ready, view-only restrictions, IP rule UI and public site without destructive production tests.
- [ ] Record exact release/workflow/check evidence; use existing automatic/manual rollback if activation fails. Do not claim deployment if blocked or checks fail.

