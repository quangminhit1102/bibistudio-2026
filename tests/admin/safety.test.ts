import { it, expect } from "vitest";
import { normalizeSearch, makeCsv } from "../../src/features/admin/shared/lib/text";
it("normalizes Vietnamese and safely quotes CSV cells and formulas", () => {
  expect(normalizeSearch("ĐÀ NẴNG")).toBe("da nang");
  const csv = makeCsv([["=SUM(A1)", 'a,"b"', "x\ny"]]);
  expect(csv).toContain("'=SUM(A1)");
  expect(csv).toContain('"a,""b"""');
  expect(csv).toContain('"x\ny"');
});
