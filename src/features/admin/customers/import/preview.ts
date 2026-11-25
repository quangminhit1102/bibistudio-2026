import type { ImportResult, ImportRow } from "../api";

export function reconcileImportRows(rows: ImportRow[], result: ImportResult): ImportRow[] {
  let changed = false;
  const next = rows.map((row): ImportRow => {
    const check = result.rows.find((entry) => entry.row === row.row);
    if (!check || row.actionChosen) return row;
    const action = check.matches.length || check.inFile ? "skip" : "create";
    if (action === row.action) return row;
    changed = true;
    return { ...row, action };
  });
  return changed ? next : rows;
}
