import type { ImportResult, ImportRow } from "../api";

export function reconcileImportRows(rows: ImportRow[], result: ImportResult): ImportRow[] {
  let changed = false;
  const next = rows.map((row): ImportRow => {
    const check = result.rows.find((entry) => entry.row === row.row);
    if (!check) return row;
    const action = check.matches.length || check.inFile ? "skip" : "create";
    if (row.action === "update" && !check.matches.some((match) => match.id === row.targetId)) {
      changed = true;
      return { ...row, action, targetId: undefined, revision: undefined, actionChosen: false };
    }
    if (row.actionChosen) return row;
    if (action === row.action) return row;
    changed = true;
    return { ...row, action };
  });
  return changed ? next : rows;
}
