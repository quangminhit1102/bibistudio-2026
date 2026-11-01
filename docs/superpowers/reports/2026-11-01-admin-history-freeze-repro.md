# Admin history freeze — before-fix reproduction

## Scope and baseline

- Requested by the user: reproduce History → Transactions before fixing it.
- Source HEAD: `fb2498c` (`docs: record verified admin preview and performance evidence`). Working tree was clean before this investigation.
- Existing local preview: `http://127.0.0.1:4181`, existing browser demo data and session. No reset, installation, application code changes, push or deployment performed.
- VAT clarification for the pending redesign: a yes/no label only; no tax calculation or tax rate.

## Actual observations

### Reproduction 1 — existing tab 4

1. Dashboard responded to input.
2. Opened navigation → expanded Đơn hàng → selected Lịch sử đơn hàng.
3. The route became `/admin/sales/order-history`; the accessibility tree displayed the heading, 180 records and page 1 / 9.
4. Reading the captured warning/error log returned `[]` at this point. This does not prove that no JavaScript error exists.
5. Clicking Mở menu quản trị failed with `Timed out running CDP command "Input.dispatchMouseEvent" for tab 4`.
6. A subsequent accessibility read failed with a focus-emulation CDP timeout.

Result: the page stopped responding while History was open, before Transactions could be clicked.

### Control and reproduction 2 — temporary tab 7, same origin/data

1. Opened `/admin/sales/transactions` directly.
2. Giao dịch mô phỏng rendered 100 records.
3. Clicked Trang sau successfully: URL became `/admin/sales/transactions?page=2&size=10`, the table showed different payment rows and page 2 / 10.
4. Selected Lịch sử đơn hàng from the visible sidebar. The DOM showed the history heading and its initial loading state.
5. Executed the actual navigation attempt:

   ```js
   await transactionControlTab.playwright
     .getByRole('link', { name: 'Giao dịch', exact: true })
     .click({ timeoutMs: 4000 });
   ```

   Actual result:

   ```text
   Error: Timed out running CDP command "Input.dispatchMouseEvent" for tab 7
   waiting on click for selector internal:role=link[name="Giao dịch"s]
   ```

Result: input stopped responding after entering History a second time; direct Transactions navigation/pagination had worked immediately beforehand.

## Evidence limits

- Reproduced loss of responsiveness twice. A process crash or a particular exception has not been established.
- The earliest observed failure is on History; it is not yet established that Transactions code causes the problem.
- A screenshot request on the frozen tab timed out and reset the UI automation session. No screenshot is claimed or attached as evidence.
- An attempted close of the temporary tab and restoration of the main tab also timed out; recovery was not verified.
- Code inspection points to client-side table rendering/state as an investigation area, not a confirmed root cause. History builds new event/column arrays each render and uses the shared DataTable in client pagination mode. The installed table library schedules page resets when row models change. A controlled failing test or profile is still required before asserting a render loop.

## Next verification

Before a fix: minimize a reproduction of the real History component/shared DataTable path; distinguish unstable table inputs, repeated query updates, and navigation/overlay behavior with a controlled probe. After a fix: rerun direct Transactions → next page and History → Transactions using the original persisted dataset, including the mobile menu path, and confirm further navigation remains responsive. Keep the failure case as a regression test where the real component chain can be exercised.

## Follow-up: isolated failure and minimal fix

The new `tests/admin/history-responsiveness.test.tsx` renders the actual shared DataTable with stable input rows/columns, the History default date sorting, client pagination, and a navigation button. A Profiler/error boundary cuts off more than 40 commits so the test reports the update loop instead of hanging. It yields to queued updates before asserting responsiveness; the older table test did not explicitly check that updates settled.

Before changing production code, this command failed:

```text
node node_modules/vitest/vitest.mjs run --config vitest.admin.config.ts tests/admin/history-responsiveness.test.tsx
1 test failed: expected document not to contain "Table exceeded render budget"
```

This isolates the failure from data fetching, IndexedDB and the router/menu. The shared DataTable supplied a freshly allocated `state.sorting` array on every render. The installed TanStack client sorted-row model invalidated its memo and queued a page reset, which updated the React table state and allocated another sorting array. The resulting queued updates starved UI interaction.

Minimal change: memoize the sorting array by `state.sort` in the shared DataTable. Keep actual sorting changes functional; do not disable pagination resets globally or remove the History route to hide the problem.

After this change, the same regression and existing DataTable test passed (2 files, 2 tests). Full checks/build and browser acceptance are recorded below when completed. No redesign modules have been implemented as part of this fix.

## After-fix acceptance

- `npm run check`: exit 0 outside the socket-restricted sandbox. 32 admin test files / 50 tests passed; tooling/API tests: 54 passed, 1 POSIX-permission test skipped on Windows. TypeScript passed; lint had 0 errors and the 7 existing Fast Refresh warnings. The initial sandbox run passed admin tests but was interrupted after socket-dependent API/deployment tests failed; that attempt is not counted as a passing full check.
- `npm run build`: exit 0, including SSR, cPanel CSR, backend compilation and archive. Local artifact `.releases/local-fb2498cab7eb06ba67a250b51a332431317d3d66.tgz` was built from the current working tree with the uncommitted fix. Its HEAD label is not a claim that the fix is committed at that SHA.
- Restarted the owned preview on the same origin `http://127.0.0.1:4181` with the new bundle. The preview needed escalation on Windows for its temporary dependency junction and localhost server.
- Fresh browser tab, same persisted demo session/data: Dashboard still showed 51 products and 100 orders (including the previously added local product); no demo reset.
- Desktop: Dashboard → History (180 records) → next page (2 / 9) → Transactions (100 records) → next page (2 / 10, including `payment-order-18`) all responded. No warning/error console entries were captured.
- Mobile 375 × 812: Transactions → mobile menu → History (180 records) → reopen mobile menu → Transactions (100 records) worked; menu closed after navigation. No warning/error console entries were captured. Temporary viewport override was reset after testing.
- Desktop evidence: `C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/admin-history-transactions-fixed-desktop.jpg`.
- Mobile evidence: `C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/admin-history-transactions-fixed-mobile.jpg`.
- No commit, push or production deployment. Pending customer/slip/analytics/notification redesign remains a design discussion.
