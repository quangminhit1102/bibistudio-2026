# Temporary production-only delivery

The user requested temporarily hiding/disabling staging while retaining production rollback, and selected the existing manual Run workflow flow. This records that approved scope; production must not start automatically on a main push.

## Approach

Keep CI for PRs/main, archive staging YAML outside `.github/workflows`, and keep manual production deployment plus manual production rollback. Automatic production after CI was considered; the user selected manual operation. A skipped staging job was considered but would keep cluttering the active workflow list.

Production accepts an exact immutable artifact from successful same-repository main-push CI without requiring staging deployment evidence. A versioned release-policy module makes this temporary mode explicit; restoring staging also requires switching the policy back. Archive SHA256 is always compared with its sidecar from that trusted CI artifact. The former independent staging checksum is required again only when staging policy is restored.

Keep production environment approval/main restriction, pinned host/action identities, receiver locks, previous successful release/baseline, retention, HTTP/browser/old-client checks and automatic rollback on failure. Manual rollback selects a successful production release or baseline; hide the staging environment selector. Do not delete staging domains, files, credentials, or GitHub run history.

Update the runbook with the simplified flow, its tradeoff (no hosting preflight on staging before production), and exact restoration steps. Three local commands remain unchanged.

## Acceptance

Tests reject untrusted/failed/expired CI artifacts and corrupt archive checksums, accept main CI without staging evidence, and ensure only CI/production/rollback workflows are active. Existing rollback/cache regressions remain green. Verify real CI, no automatic staging/production run on main push, and a manual production deploy from a CI artifact with no staging evidence. Never intentionally deploy an unhealthy fixture to production.
