import { expect, it } from "vitest";
import { reconcileImportRows } from "../../src/features/admin/customers/import/preview";
import type { ImportResult, ImportRow } from "../../src/features/admin/customers/api";

const row: ImportRow = {
  row: 2,
  action: "update",
  actionChosen: true,
  targetId: "old",
  revision: 1,
  fields: { name: "Customer" },
};
const result: ImportResult = {
  rows: [{ row: 2, status: "ok", errors: [], matches: [] }],
  created: 0,
  updated: 0,
  skipped: 0,
  committed: false,
};
it("keeps an invalidated update skipped across rechecks until the user chooses again", () => {
  const next = reconcileImportRows([row], result);
  expect(next[0]).toMatchObject({ action: "skip", actionChosen: true, updateNotice: true });
  expect(next[0].targetId).toBeUndefined();
  expect(next[0].revision).toBeUndefined();
  expect(reconcileImportRows(next, result)).toBe(next);
  const chosen = [{ ...next[0], action: "create" as const, updateNotice: false }];
  expect(reconcileImportRows(chosen, result)).toBe(chosen);
});
it("keeps conflict resets skipped even when the target still matches", () => {
  const next = reconcileImportRows([{ ...row, resetUpdate: true }], {
    ...result,
    rows: [
      {
        ...result.rows[0],
        matches: [{ id: "old", name: "Customer", kind: "individual", revision: 2, by: ["name"] }],
      },
    ],
  });
  expect(next[0]).toMatchObject({ action: "skip", actionChosen: true, updateNotice: false });
  expect(next[0].resetUpdate).toBeUndefined();
});
it("does not change empty previews", () => {
  const rows: ImportRow[] = [];
  expect(reconcileImportRows(rows, { ...result, rows: [] })).toBe(rows);
});
