import type { ImportResult, ImportRow } from "../api";

export function reconcileImportRows(rows: ImportRow[], result: ImportResult): ImportRow[] {
  let changed = false;
  const next = rows.map((row): ImportRow => {
    const check = result.rows.find((entry) => entry.row === row.row);
    if (!check) return row;
    const action = check.matches.length || check.inFile ? "skip" : "create";
    const targetMatches = check.matches.some((match) => match.id === row.targetId);
    if (row.action === "update" && (row.resetUpdate || !targetMatches)) {
      changed = true;
      return {
        ...row,
        action: "skip",
        targetId: undefined,
        revision: undefined,
        actionChosen: true,
        resetUpdate: undefined,
        updateNotice: !targetMatches,
      };
    }
    if (row.actionChosen) return row;
    if (action === row.action) return row;
    changed = true;
    return { ...row, action };
  });
  return changed ? next : rows;
}
