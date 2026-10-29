# SDD ledger — plan: docs/superpowers/plans/2026-10-30-bibistudio-cicd.md

## Setup

- Base implementation commit: 6346525. Approved spec, runbook and plan checkpointed. No implementation pushed yet.
- Baseline: `node --test scripts/*.test.mjs`: 14/14 pass.
- Ruling: native managed worktree was created but sandbox denies Git access there. Following worktree skill fallback, implement in original writable checkout on branch `codex/fullstack-cicd`. Main stays untouched after documentation checkpoint. Cost: development checkout now displays the feature branch.
- Runtime: bundled Node v24.22.1, same as hosting. System default is Node v25.9.0; all validation commands explicitly select bundled Node 24.
- Pre-flight interfaces: API ReleaseInfo feeds FE/version, build manifest and deployment smoke; shared schema is releaseId/sourceSha. Local runner and preview both own child lifecycle. Upload receiver and CI use check/upload/deploy/rollback. Root install hook installs backend once; backend runtime installation has no root hook. No conflicts found.
- Browser confirmed GitHub repository is public and signed-in account owns it; Settings and Actions available. SSH runner authentication and staging are still unproven.

## Tasks

- Task 1: complete — compiled backend tests 3/3 pass on Node 24.22.1, using actual HTTP and a compiled server subprocess. Sandbox blocked localhost fetch initially; rerun with authorized network access passed.
- Ruling: backend tests use .mjs against compiled CommonJS instead of a TS test loader, so tests exercise deployed output directly. No runtime behavior changed.
- Finding: original root package-lock.json was stale relative to package.json; npm ci failed before any new install hook. Synchronized the root lockfile with declared package versions using npm on Node 24. Will commit with local tooling.
- Task 2: pending.
- Task 3: pending.
- Task 4: pending.
- Task 5: pending.
- Task 6: pending.
- Task 7: pending real provisioning and runner tests.
- Task 8: pending real production release and verification.
