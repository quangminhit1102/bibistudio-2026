# SDD ledger — plan: docs/superpowers/plans/2026-10-31-production-only.md

- Base:20f9f2a. User explicitly requested temporarily disabled/hidden staging with production rollback and selected keeping manual Run workflow. Short design records that approved scope; no automatic production is authorized.
- Existing managed worktree reused; branch codex/production-only. No staging hosting/credentials/history deletion, no credential or environment approval changes required.
- Pre-flight: production currently depends on staging twice: validateRelease's deployment evidence and deploy-client EXPECTED_CHECKSUM. Both must share one explicit policy; sidecar comparison must remain mandatory. Rollback environment/lock become fixed production together.
- Task1: in progress, write release validation/checksum regressions first.
- Task1 trust policy regression RED with unexpected staging dependency; shared false policy GREEN, sidecar/malformed/provided-mismatch checksum checks RED→GREEN. Task2 active workflow assertion RED with staging.yml present; archived workflow and production-only rollback GREEN. Existing staging evidence helper retained for restoring policy=true.
- Tasks1–2 local complete: Node24 full check51 tests/50pass/1WindowsPOSIXskip, types/lint/catalogue green. Actionlint passed active workflows and archived staging. Runbook rewritten around CI→manual production and production rollback; archived staging restoration requires policy=true and re-enabling workflow. No hosting tool changes.
