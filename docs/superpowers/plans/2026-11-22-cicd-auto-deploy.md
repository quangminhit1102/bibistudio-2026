# CI song song và tự deploy production — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push `main` → CI song song đạt → `Deploy production` tự chạy với đúng artifact của CI đó; deploy tay và rollback vẫn dùng được.

**Architecture:** `scripts/check.mjs` chia thành giai đoạn chọn được bằng tham số; `ci.yml` chạy mỗi giai đoạn trong một job riêng. `production.yml` thêm trigger `workflow_run` của CI và tự chọn bản CI đạt mới nhất khi chạy tay không nhập mã. Receiver, `deploy-client.mjs` và kiểm tra nguồn gốc artifact không đổi.

**Tech Stack:** GitHub Actions, Node 24 (`node --test`), package `yaml`.

**Spec:** `docs/superpowers/specs/2026-11-22-cicd-auto-deploy-design.md`

## Global Constraints

- Mọi `uses:` pin SHA 40 ký tự; dùng lại đúng các SHA đang có trong repo.
- `permissions.contents` là `read` ở mọi workflow; không `pull_request_target`.
- `ci.yml` không chứa chuỗi `secrets.`.
- `production.yml` không chạy `npm run build`; environment `production`; concurrency `deploy-production`, `cancel-in-progress: false`; chứa `github.ref == 'refs/heads/main'`.
- Thư mục `.github/workflows/` chỉ có `ci.yml`, `production.yml`, `rollback.yml`.
- Tên artifact release `release-<sha>-<run id>`, retention 30 ngày, `include-hidden-files: true`.
- `npm run check` không tham số chạy đủ và đúng thứ tự như hiện nay.
- Không rewrite lịch sử Git đã push. Nhánh backup của `main`: `backup/main-2026-11-22-before-cicd`.

## Review Focus

1. Thêm một bộ test trình duyệt mới nhưng quên thêm vào matrix CI → CI vẫn xanh. Test khóa: matrix `e2e` phải bằng `E2E_SUITES` (Task 1, 2).
2. Thêm một giai đoạn `check` mới nhưng không job CI nào chạy nó. Test khóa: mỗi phần tử `STAGES` có một job chạy `check.mjs <stage>` (Task 2).
3. CI của nhánh `codex/**`, của PR, của fork hoặc CI thất bại kích hoạt deploy. Test khóa điều kiện job `promote` (Task 3).
4. Chạy tay để trống mã khi chưa có CI main nào đạt → phải báo lỗi rõ, không deploy (Task 3).
5. Chạy tay để trống mã: bước deploy phải nhận mã đã được chọn, không phải chuỗi rỗng (Task 3).

---

### Task 1: `check.mjs` chạy theo giai đoạn

**Files:**
- Modify: `scripts/check.mjs`
- Test: `scripts/check-stages.test.mjs` (mới)

**Interfaces:**
- Produces: `export const STAGES = ["static", "admin", "backend", "e2e"]`, `export const E2E_SUITES = ["auth", "visitor-analytics", "admin-usability", "profile", "visitor-relay"]`, `export function selectStages(args: string[]): { stages: string[], suites: string[] }`.
- CLI: `node scripts/check.mjs [stage] [suite]`.

- [ ] **Step 1: Test thất bại** trong `scripts/check-stages.test.mjs`:
  - `selectStages([])` → `{ stages: STAGES, suites: E2E_SUITES }`.
  - `selectStages(["admin"])` → `{ stages: ["admin"], suites: E2E_SUITES }`.
  - `selectStages(["e2e", "profile"])` → `{ stages: ["e2e"], suites: ["profile"] }`.
  - Ném lỗi với `["nope"]`, `["e2e", "nope"]`, `["admin", "auth"]`, `["e2e", "auth", "x"]`.
  - Mỗi tên trong `E2E_SUITES` có file `tests/e2e/<tên>.spec.mjs`; mọi `tests/e2e/*.spec.mjs` trừ `visitor-context-bundle` nằm trong `E2E_SUITES`.
- [ ] **Step 2:** `node --test scripts/check-stages.test.mjs` → FAIL (không có export).
- [ ] **Step 3: Sửa `check.mjs`.** Bọc phần chạy trong `if (isMain(import.meta.url))`. Nội dung từng giai đoạn:
  - `static`: `prepareCountryDataset`, `tsc --noEmit`, compile BE, ESLint (danh sách đường dẫn giữ nguyên), `catalogue-images.mjs`.
  - `admin`: vitest admin.
  - `backend`: `prepareCountryDataset`, compile BE, `ensureTestDatabase`, `node --test` scripts + backend + `api-demo`, rồi `dev.test.mjs`, `dev-relay.test.mjs`.
  - `e2e`: `prepareCountryDataset`, compile BE, `ensureTestDatabase`, rồi `node --test tests/e2e/<suite>.spec.mjs` lần lượt cho từng suite.
  - Khi chạy đủ bốn giai đoạn trong một tiến trình, `prepareCountryDataset`, compile BE và `ensureTestDatabase` mỗi thứ chỉ chạy một lần.
  - Xóa `scripts/auth-ui-check.mjs` và `scripts/visitor-relay-ui-check.mjs` (không còn nơi nào gọi).
- [ ] **Step 4:** `node --test scripts/check-stages.test.mjs` → PASS; `node scripts/check.mjs static` → exit 0.
- [ ] **Step 5:** Commit `ci: split check script into selectable stages`.

### Task 2: CI song song

**Files:**
- Modify: `.github/workflows/ci.yml`, `scripts/workflow-policy.test.mjs`

**Interfaces:**
- Consumes: `STAGES`, `E2E_SUITES`, CLI của Task 1.
- Produces: job `build` chứa step upload artifact release.

- [ ] **Step 1: Test thất bại** trong `workflow-policy.test.mjs`:
  - Step upload release (tên bắt đầu `release-`) nằm trong `jobs.build`, `include-hidden-files === true`.
  - `jobs.e2e.strategy.matrix.suite` deepEqual `E2E_SUITES`; `fail-fast === false`.
  - Với mỗi stage trong `STAGES`: tồn tại job có step `run` chứa `scripts/check.mjs <stage>`.
  - Không còn `jobs.verify`.
- [ ] **Step 2:** `node --test scripts/workflow-policy.test.mjs` → FAIL.
- [ ] **Step 3: Viết lại `jobs` của `ci.yml`** (trigger, permissions, concurrency giữ nguyên). Mọi job: `ubuntu-latest`, checkout `persist-credentials: false`, setup-node 24 với cache npm trên ba lockfile, `npm ci`.

  | Job | timeout | fetch-depth | MariaDB service + `BIBI_TEST_DB_*` | Chromium | Image PHP | Lệnh |
  |---|---|---|---|---|---|---|
  | `static` | 10 | 1 | không | không | không | `node scripts/check.mjs static` |
  | `admin` | 10 | 1 | không | không | không | `node scripts/check.mjs admin` |
  | `backend` | 15 | 0 | có | không | có | `node scripts/check.mjs backend` |
  | `e2e` (matrix `suite`) | 15 | 1 | có | có | có | `node scripts/check.mjs e2e ${{ matrix.suite }}` |
  | `build` | 15 | 0 | không | có | có | `npm run build`, `node scripts/visitor-context-bundle-check.mjs` |

  - Job dùng MariaDB truyền `BIBI_TEST_DB_CONTAINER: ${{ job.services.mysql.id }}` như hiện nay.
  - `e2e` upload `browser-evidence-<suite>-<sha>-<run id>` (`if: always()`, 7 ngày); `build` upload `browser-evidence-bundle-<sha>-<run id>` cho `.superpowers/e2e/visitor-context-bundle/*.png`.
  - `build` upload artifact release với điều kiện, tên, đường dẫn, retention, compression như hiện nay.
  - Nếu một job thiếu công cụ khi chạy thật trên CI (Chromium, PHP, DB, lịch sử Git), thêm đúng thứ thiếu vào job đó và cập nhật bảng này.
- [ ] **Step 4:** `node --test scripts/workflow-policy.test.mjs` → PASS.
- [ ] **Step 5:** Commit `ci: run checks as parallel jobs`.

### Task 3: Tự deploy và chạy tay không cần mã

**Files:**
- Modify: `scripts/github-release.mjs`, `.github/workflows/production.yml`, `.github/workflows/rollback.yml`, `scripts/workflow-policy.test.mjs`

**Interfaces:**
- Produces: `export async function latestReleaseId({ request = github } = {}): Promise<string>` — gọi `actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=1`, trả `<head_sha>-<id>` của `workflow_runs[0]`, ném `No successful main CI run` khi rỗng.

- [ ] **Step 1: Test thất bại** trong `workflow-policy.test.mjs`:
  - `latestReleaseId` trả `${sha}-123` với request giả; ném `/No successful main CI run/` khi `workflow_runs: []`.
  - `Object.keys(production.on).sort()` deepEqual `["workflow_dispatch", "workflow_run"]` (thay khẳng định cũ).
  - `production.on.workflow_run` deepEqual `{ workflows: ["CI"], types: ["completed"], branches: ["main"] }`.
  - `production.on.workflow_dispatch.inputs.release_id.required === false`.
  - `jobs.promote.if` chứa từng chuỗi: `github.ref == 'refs/heads/main'`, `github.event.workflow_run.conclusion == 'success'`, `github.event.workflow_run.event == 'push'`, `github.event.workflow_run.head_repository.full_name == github.repository`, `vars.AUTO_DEPLOY != 'false'`, `[skip deploy]`.
  - Step chạy `deploy-client.mjs` trong `production.yml` có `env.RELEASE_ID === "${{ steps.trusted.outputs.releaseId }}"`.
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3: `github-release.mjs`.** Thêm `latestReleaseId`; phần main dùng `process.env.RELEASE_ID || (await latestReleaseId())`.
- [ ] **Step 4: `production.yml`.**
  - `on` như test mô tả; mô tả input: `Release ID from successful main CI; empty = latest`.
  - `jobs.promote.if`: `github.ref == 'refs/heads/main' && (github.event_name == 'workflow_dispatch' || (<năm điều kiện workflow_run ở Step 1> && !contains(github.event.workflow_run.head_commit.message, '[skip deploy]')))`.
  - Job env `RELEASE_ID`: `${{ github.event_name == 'workflow_run' && format('{0}-{1}', github.event.workflow_run.head_sha, github.event.workflow_run.id) || inputs.release_id }}`.
  - `setup-node` thêm `cache: npm`, `cache-dependency-path: package-lock.json` (cả `rollback.yml`).
  - Sau bước `trusted`: ghi `Release: <id>` vào `$GITHUB_STEP_SUMMARY`, lấy giá trị qua `env`, không nội suy `${{ }}` trong lệnh shell.
  - Bước deploy: `RELEASE_ID: ${{ steps.trusted.outputs.releaseId }}`.
- [ ] **Step 5:** `node --test scripts/workflow-policy.test.mjs scripts/release-policy.test.mjs` → PASS.
- [ ] **Step 6:** Commit `ci: deploy production automatically after successful main CI`.

### Task 4: Tài liệu và kiểm tra toàn bộ

**Files:**
- Modify: `docs/build-and-deploy.md` (tiêu đề chế độ hiện tại, mục 2, 3, 4, đoạn staging)

- [ ] **Step 1:** Viết lại theo luồng mới: tự deploy sau CI main; deploy tay (để trống hoặc nhập mã); tạm dừng bằng `AUTO_DEPLOY=false` hoặc `[skip deploy]`; reviewer của environment là tùy chọn của chủ repo; các job CI; xử lý khi tự deploy lỗi (rollback tự động, chạy lại, rollback tay).
- [ ] **Step 2:** `npm run check` → exit 0. `npm run build` → exit 0.
- [ ] **Step 3:** Commit `docs: describe automatic production deploy`, push nhánh, mở PR, đợi CI của PR và ghi thời gian từng job vào PR.

Nghiệm thu mục 2–5 của spec (deploy thật) chỉ làm được sau khi merge và sau khi chủ repo gỡ reviewer.
