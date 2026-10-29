# BiBi Studio FE + API CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects that method. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local FE/BE development convenient through three commands, then deliver verified releases automatically to staging and explicitly promote them to production on the existing cPanel hosting.

**Architecture:** Preserve the root React application; add an isolated TypeScript/Express backend. CI produces a single immutable FE/BE artifact, SSH uses an environment-scoped forced-command receiver, and cPanel activates releases behind stable frontend routing and Passenger launchers. Runtime is Node major 24; MySQL is outside this iteration.

**Tech Stack:** Existing React/Vite/TanStack Router, TypeScript, Express, Node test runner, GitHub Actions, Bash/Node deploy receiver, cPanel Passenger. Choose supported dependency versions during implementation, record them in lockfiles, and use official documentation to resolve compatibility questions.

**Spec:** `docs/superpowers/specs/2026-10-30-bibistudio-cicd-design.md`

## Global Constraints

- Human-facing commands: `npm run dev`, `npm run check`, `npm run build`; initial install is `npm ci`, production-mode local preview is `npm run build -- --preview`.
- Preserve catalogue type/collection dimensions, images and journal behavior from AGENTS.md. Keep Lovable-compatible install, dev host/port and build outputs.
- Backend is public health/version/demo only. No database, authentication, admin or uploads.
- Full-dev must exercise `src/main.tsx`, the same CSR entry as cPanel. Default FE 5173, BE 3001, inspector loopback 9230.
- Windows PowerShell and Git Bash must clean up the entire owned process tree on Ctrl+C; a fatal child exit must stop its sibling.
- Staging auto-deploys trusted main releases. Production manually promotes the exact release that passed staging; never rebuild it for promotion.
- Preserve API Passenger config, `/node-test`, `.well-known`, secret files and vhplastic.com. Never rewrite published Git history.
- Credential creation/authorization, GitHub credential storage and production cutover require the applicable action-time confirmations. Design approval alone does not satisfy these.
- Do not report CI/CD complete until runner authentication, staging deployment, production promotion and rollback are actually verified.

## Review Focus

- A child watcher survives while its HTTP server is unavailable: distinguish transient restart from fatal process failure; show readiness/errors correctly.
- A development server silently chooses another port: fail clearly so proxy and debugger remain consistent.
- A cache contains old JS or a tab requests an old lazy chunk: retain hashed assets and verify both fresh and already-open clients after promotion.
- An archive or SSH command contains paths, links or shell syntax: reject before filesystem mutation and constrain all actions to one configured environment.
- An older staging job completes late or a failed first production deploy lacks a previous release: enforce monotonic staging activation and create a baseline before cutover.

## File ownership and execution setup

The current main checkout includes one local documentation commit and uncommitted approved spec/runbook revisions. Read and preserve them. Before implementation, checkpoint approved documentation and use the worktree skill to isolate feature work; keep necessary existing cPanel restoration files from main. Do not discard the user's files or overwrite the existing `/node-test` app.

Files are divided by responsibility below. Script names are internal implementation interfaces; they are not extra commands the user must memorize. Each task follows a red/green test cycle and ends with a scoped local commit. Do not push until the user authorizes publishing the implementation.

### Task 1: Express API with buildable Passenger entry

**Files:** Create `backend/package.json`, `backend/package-lock.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/release.ts`, `backend/test/api.test.ts`. Modify `.gitignore` to cover real env and backend output without hiding examples.

**Interfaces:** `ReleaseInfo = { releaseId: string; sourceSha: string }`; `createApp(release: ReleaseInfo): Express`; `startServer(options: { host: string; port: number; release: ReleaseInfo }): Promise<http.Server>`. App creation does not bind a port. Server CLI starts once when run as the application entry. CommonJS build lives in `backend/dist` and reads release metadata from its own bundle, not latest Git state.

- [ ] Write real HTTP tests with Node assertions and an ephemeral localhost port. Assert health returns JSON `{ ok: true }`, version returns the supplied release ID/SHA, demo returns deterministic data, `/api/unknown` is JSON 404, and POST on the GET-only demo is 405 with Allow. Assert responses expose no process env or filesystem paths.
- [ ] Run backend tests and observe expected missing-behavior failures; implement the interfaces and Express routing, with no database dependency.
- [ ] Add a compiled-runtime test: build CommonJS then start it as a child, fetch health/version and terminate cleanly. Confirm it works inside an ESM parent repository.
- [ ] Run backend tests and typecheck; require zero failures. Commit this task's files.

### Task 2: One-command local development, install and debugging

**Files:** Create `scripts/install-backend.mjs`, `scripts/dev.mjs`, `scripts/process-group.mjs`, `scripts/process-group.test.mjs`, `vite.local.config.ts`, `.env.example`; modify `package.json`, lockfile as needed, and the shared cPanel Vite configuration only if sharing plugins is necessary.

**Interfaces:** `startDevelopment(options: { frontendPort: number; backendPort: number; inspectorPort: number }): Promise<{ close(): Promise<void> }>` in `scripts/dev.mjs`. `scripts/process-group.mjs` owns only child processes it created and exports `spawnOwned(command, args, options)` and `stopOwned(children): Promise<void>`. Root `postinstall` invokes the backend installer using npm's selected runtime, with no recursive root install.

- [ ] Write subprocess tests: an occupied requested port rejects startup; fatal child exit stops its sibling; SIGINT releases both listening ports; repeated close is safe. Tests must avoid killing unrelated processes.
- [ ] Run the tests red, then implement process ownership/cleanup with Windows behavior explicitly handled and output prefixed `[FE]`/`[BE]`. Use readiness polling with a timeout, not arbitrary sleeps. Keep restartable source errors visible without treating the environment as healthy.
- [ ] Configure local Vite to serve `cpanel.html` as the CSR document for `/` and deep React paths, generate/watch the TanStack route tree, use strict ports and proxy `/api` to the configured backend. Never send local API requests to production.
- [ ] Backend dev uses a TypeScript watcher with inspector bound to `127.0.0.1:9230`, not inspect-brk; support reattach after restart. Keep preview/production inspector disabled.
- [ ] Make root `npm run dev` orchestrate both processes. Preserve Lovable's required host/port arguments and verify its preview path separately; do not duplicate existing bundled plugins.
- [ ] Run `npm ci` from the root and confirm both lockfiles are respected. Verify dev on Windows: edit FE, edit BE, attach a TS breakpoint, Ctrl+C, immediately start again. Record exact results in the execution ledger and commit.

### Task 3: FE API test page and one check command

**Files:** Create `src/lib/api-demo.ts`, `src/lib/api-demo.test.ts`, `src/routes/api-test.tsx`, `scripts/check.mjs`; modify `src/routeTree.gen.ts` only through router generation, `eslint.config.js`, `package.json` and the appropriate existing navigation/footer component to expose a clearly named test-page link.

**Interfaces:** `loadApiDemo(signal?: AbortSignal): Promise<{ backend: ReleaseInfo; demo: unknown }>` uses same-origin `/api/version` and `/api/demo`; rejects HTTP errors or non-JSON responses clearly. FE release information comes from build-injected constants with a local fallback. Existing catalogue public interfaces stay unchanged.

- [ ] Write tests for successful fetch, API 503, HTML fallback and abort; watch them fail, then implement the client. Add browser scenarios for loading, success, failure and retry against the real local backend/proxy.
- [ ] Add the page using existing PageShell/style primitives, displaying FE/BE versions and demo payload. Keep technical details out of catalogue pages; add noindex metadata for the test page.
- [ ] Implement `npm run check`: root/backend typechecks, catalogue validation, all script/backend/client tests, and lint for the scoped maintained files. Report pre-existing lint problems explicitly; do not quietly claim a whole-repo clean lint when using scoped lint. Node backend/script globals belong in ESLint's server overrides.
- [ ] Run check green and verify `/api-test`, product deep-link refresh and representative images in local CSR mode. Commit.

### Task 4: Reproducible bundle build and local release preview

**Files:** Create `scripts/release-manifest.mjs`, `scripts/release-manifest.test.mjs`, `scripts/build.mjs`, `scripts/preview.mjs`, `scripts/build.test.mjs`, `scripts/preview.test.mjs`; modify `package.json`, Vite build defines and ignores. Add `backend/package-lock.json` to the backend runtime bundle, retaining only necessary runtime manifests/code.

**Interfaces:** Manifest `{ schemaVersion: 1; releaseId: string; sourceSha: string; ciRunId: string | null }`. `buildRelease({ sourceSha, ciRunId, outputDir }): Promise<{ archive: string; checksumFile: string; manifest: Manifest }>` emits FE, compiled BE and manifest under an ignored release output directory. `previewRelease(bundleDir, options): Promise<{ close(): Promise<void> }>` serves static FE plus the compiled API locally without an inspector.

- [ ] Test deterministic identity from SHA/run ID; local builds are marked local. Test missing image, missing BE build, mismatched FE/BE metadata and accidental secret/node_modules inclusion cause failure. Run red, then implement.
- [ ] Root `npm run build` builds cPanel CSR and backend, validates bundle and computes SHA-256. Preserve the original Lovable build output path through an internal build stage where that host requires it; explicitly verify `.output` compatibility rather than silently replacing it.
- [ ] Handle `--preview` as an option forwarded to the build runner: build then start local compiled FE/BE. Default build exits after packaging. Both entry points must propagate failures.
- [ ] Preview tests fetch FE, API version, deep React paths and a real catalogue image; assert versions match, API 404 is JSON, and no debugger is running. Run check/build/preview and commit.

### Task 5: Scoped upload receiver and release activation engine

**Files:** Create `ops/receiver.cjs`, `ops/deploy.cjs`, `ops/deploy-config.example.json`, `ops/passenger/app.cjs`, `ops/frontend.htaccess.template`, `scripts/deploy.test.mjs`, `scripts/receiver.test.mjs`. Credentials and real server config remain outside Git.

**Interfaces:** Receiver accepts only `check`, `upload <releaseId> <sha256>`, `deploy <releaseId>` and `rollback <releaseId>` through `SSH_ORIGINAL_COMMAND`; environment and paths come from the installed config, never command input. Upload is an artifact stream on stdin. Deploy exports `activateRelease(config, releaseId)`, `rollbackRelease(config, releaseId)` and `inspectRelease(config, releaseId)`; calls validate configured absolute path containment before writing. Receiver is bootstrap-owned and not overwritten by a release.

- [ ] Add tests before implementation for rejected shell metacharacters, invalid IDs, cross-environment paths, traversal archives, links escaping extraction, checksum mismatch, unexpected files, duplicate immutable release and missing release. Verify rejected input leaves the target unchanged.
- [ ] Implement archive inspection using a maintained archive parser with traversal/link validation before extraction, or a strict verified tar format; do not assume a raw tar extraction is safe. Require metadata and checksums to agree before release preparation.
- [ ] Test activation lock contention, older staging run rejection, successful activation, health timeout causing rollback, rollback failure reported distinctly, and first-cutover baseline behavior. Implement the engine using `flock` and current/previous pointers in the configured environment.
- [ ] Keep runtime bootstrap/routing stable. Explicitly reserve API mount, `/node-test` and `.well-known`; serve FE and shared hashed assets without exposing backend source. Test an already-open client's old chunk after changing current.
- [ ] Add retention/disk checks: preserve active/previous/five recent successful releases plus 30-day assets; refuse an upload if insufficient space and never clean another website. Test against temporary fixtures, not live hosting.
- [ ] Run all automated tests and document the required server layout/ownership. Commit without provisioning credentials.

### Task 6: Trusted CI artifacts and workflow validation

**Files:** Create `.github/workflows/ci.yml`, `.github/workflows/staging.yml`, `.github/workflows/production.yml`, `.github/workflows/rollback.yml`, `scripts/workflow-policy.test.mjs`, `scripts/smoke.mjs`, `scripts/smoke.test.mjs`. Add only necessary test dependencies and update lockfiles.

**Interfaces:** CI output is artifact identity/run ID, source SHA, release ID and archive checksum. `smoke({ baseUrl, expectedRelease, expectedSha }): Promise<void>` checks status/content types, matching FE/BE metadata, deep-link SPA and a known image. Browser smoke uses Playwright on Linux CI with the required browser runtime installed there.

- [ ] Write policy tests for workflow triggers, minimal token permissions, no deploy secrets on PRs, production validation of trusted successful main CI and successful staging, concurrency rules, and no rebuild during promotion. Verify tests fail before writing workflows, then implement their structure.
- [ ] CI runs the same check/build commands as local. Main uploads immutable artifacts; PR builds cannot be promoted. Retention target is 30 days subject to repository plan limits.
- [ ] Staging starts only after successful trusted main CI. Download artifacts from the verified run, run scoped SSH upload/deploy, then smoke/browser checks. Record staging success against that exact artifact/run, and prevent late older runs from winning.
- [ ] Production is workflow_dispatch on trusted default-branch workflow, takes a release ID and rejects missing/expired artifacts or absent staging evidence before any SSH action. Use the same archive/digest. Rollback selects an existing known successful host release.
- [ ] On smoke failure, invoke rollback through the receiver and verify recovery before reporting the original job as failed. Use workflow and server-side environment locks. Pin host verification and action dependencies to reviewed versions/commit SHAs.
- [ ] Validate workflows with policy tests and a YAML/workflow validator. Do not claim GitHub jobs ran merely because YAML validation passed. Commit.

### Task 7: Provision and prove staging on actual hosting

**Files:** Update `docs/build-and-deploy.md` with actual settings and observed evidence; real server config is provisioned outside the repo. Update deployment script configuration/examples only if verified hosting behavior requires it.

**Interfaces:** Staging document root `/home/vhplasti/staging.bibistudio.vn`; release root `/home/vhplasti/bibi-deploy/staging`; API mounted at `/api`. SSH host `h217103.tino.org:22`, account `vhplasti`, verified ED25519 fingerprint from the spec. These values are facts/proposals as individually marked in the spec, not permission to bypass access confirmations.

- [ ] Inspect GitHub repository visibility/plan and available environment protections; inspect current hosting state again. `gh` was not found in the inspected local shell: use the authenticated browser or an available connector instead of assuming the CLI is installed.
- [ ] Create staging DNS/domain with its own document root and valid SSL after the applicable approval. Confirm public DNS/HTTPS before attempting app smoke tests.
- [ ] Bootstrap the stable launcher, routing and receiver through the existing authorized cPanel administration session. Prove internal symlink serving, deep-link fallback and Passenger restart on staging. If any prerequisite fails, stop before production and revise activation design with evidence.
- [ ] At action time, request the necessary explicit confirmation for creating/authorizing the dedicated staging deploy key and storing its private part in the specified GitHub environment. Use a secure credential flow; never print private key material or place it in code, logs, clipboard output or chat.
- [ ] Install the key with forced-command restrictions and no PTY/forwarding. Verify the exact pinned host key. Run a GitHub-hosted preflight through the check action; require authentication, environment containment and required tools.
- [ ] Push the reviewed implementation only when authorized; run a real main CI/staging release. Verify metadata, browser behavior, invalid API paths, pictures and absence of accidental production mutation.
- [ ] Deliberately deploy a controlled unhealthy staging fixture and demonstrate verified rollback. Confirm an older run cannot overwrite a newer deployment. Record actual run/release IDs and sanitized results; commit documentation changes.

### Task 8: Production baseline, promotion, rollback and documentation handover

**Files:** Finalize `docs/build-and-deploy.md`, `docs/cpanel-artifact-deploy.md`, and add a concise deployment-doc pointer to `AGENTS.md` using the writing-for-agents skill. Update approved spec only for evidence-backed necessary deviations, recording them in the ledger.

**Interfaces:** Production release root `/home/vhplasti/bibi-deploy/production`; keep document root `/home/vhplasti/bibistudio.vn`; fixed API mount `/api`; existing `/node-test` stays intact. Separate production SSH key/environment config uses the same restricted receiver protocol.

- [ ] Prepare and verify a baseline of the current static site, original routing and representative image checks. First-cutover rollback must restore the old site even though it has no production API release.
- [ ] At action time request explicit confirmation for production key authorization/storage and the first production cutover. Record the approved destination/release, without storing secret material in the ledger.
- [ ] Register the production Passenger app/receiver with stable paths and routing; confirm no changes to vhplastic.com or `/node-test`. Keep old deploy/cpanel-prod from running concurrently after cutover and document that restriction without deleting its history.
- [ ] Promote the exact artifact already verified on staging, through the production workflow. Verify FE/BE versions, public API responses, existing product pages/imagery and technical test page; do not call the task complete at the push/build stage.
- [ ] Verify the production rollback path for baseline/current metadata, and perform a reversible rollback/re-promotion if explicitly included in the approved cutover window. Staging's destructive fixture is never used on production.
- [ ] Replace proposed workflow names and commands in the runbook with implemented source links. Mark each environment's actual status, include known hosting limits and a short operator checklist. Keep three human-facing commands and optional editor debug instructions.
- [ ] Run the final whole-code review, fix important findings with red/green tests, and rerun check/build plus relevant hosting smoke tests. Report local commit(s), published run/release IDs, actual staging/production state and any remaining manual or blocked steps. Commit final documentation when permissions allow; obtain publication authorization where required.

## Self-review of this plan

- Coverage: API/local ergonomics in tasks 1–3; immutable build/preview in task 4; scoped deploy, routing, cache and rollback in task 5; trusted artifact workflows in task 6; real access/staging validation in task 7; baseline/production/docs in task 8.
- Every Review Focus condition has tests or a required actual-host observation in its owning task.
- Provisioning prerequisites remain explicit gates, not assumed completed. Failed SSH or unsupported routing blocks the corresponding CD deliverable, not unrelated local development work.
- No infrastructure has been provisioned by writing this plan. Local commands and workflow names remain planned until implemented and verified.
