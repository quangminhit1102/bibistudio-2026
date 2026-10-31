# Production-only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, task by task.

**Goal:** Temporarily keep only manual production delivery and production rollback.
**Architecture:** Archive staging workflow; use an explicit shared release policy for CI-only promotion/checksums; preserve existing receiver and rollback behavior.
**Tech Stack:** Node24, GitHub Actions, existing Express/React/cPanel receiver.
**Spec:** docs/superpowers/specs/2026-10-31-production-only-design.md

## Global Constraints

- No automatic production on main push; retain production review/main restriction.
- Exact successful same-repository main-push CI artifact, no rebuild; SHA256 sidecar always checked.
- Keep prior successful release/baseline, automatic recovery, manual rollback and file-cache fix.
- Preserve staging hosting/credentials/history; no force push; keep three local commands.

## Review Focus

- CI-only promotion must not accidentally accept PR/fork/failed/expired artifacts.
- Empty staging checksum must not bypass archive/sidecar verification.
- Restoring staging must restore both workflow and checksum/evidence gate.
- Production and rollback must share the production concurrency lock/review environment.
- Live rollout must not be inferred from YAML/test success, and must not intentionally break production.

### Task 1: Release trust and checksum policy

Files: `scripts/release-policy.mjs`, `scripts/github-release.mjs`, `scripts/deploy-client.mjs`, `scripts/workflow-policy.test.mjs`.
Interface: `REQUIRE_STAGING_BEFORE_PRODUCTION = false`; `validateRelease` accepts an injected GitHub request/repository for tests. Checksum assertion always validates computed SHA256 against sidecar, and independent expected checksum when staging policy is enabled.

- [x] Write CI-only release validation/checksum regressions, run them RED.
- [x] Implement shared explicit policy and inject GitHub reads; retain existing staging evidence helper for restoration.
- [x] Run targeted tests GREEN, full `npm run check` GREEN. Commit.

### Task 2: Active workflows and operator documentation

Files: move `.github/workflows/staging.yml` to `.github/workflows-disabled/staging.yml`; modify production/rollback YAML and workflow tests; update `docs/build-and-deploy.md`.
Interface: production remains workflow_dispatch with release_id; rollback fixes environment/lock to production and accepts release_id only. Archived staging remains valid YAML.

- [x] Write active-workflow/manual-trigger/production rollback policy regressions, observe RED.
- [x] Archive staging, clarify production input/name, simplify rollback selector, document restore steps/tradeoffs and current accepted production20f9f2a.
- [x] Run policy tests/full check/actionlint GREEN. Commit. Fresh whole-change read-only review; fix material findings with regression tests.

### Task 3: Actual CI and production acceptance

- [x] Push feature branch, verify real Linux CI; fast-forward main only after passing checks/review.
- [x] Verify main CI artifact exists and no automatic staging or production run starts for it.
- [x] Manually run/review production for that exact CI-only artifact; verify workflow HTTP/browser/old-client checks and independent public metadata/images.
- [x] Verify production rollback remains available and previous successful release retained; preserve existing real rollback drill evidence, avoid an unhealthy production fixture.
- [x] Record actual run/release IDs and remaining limitations; never mark deploy complete at push/build.
