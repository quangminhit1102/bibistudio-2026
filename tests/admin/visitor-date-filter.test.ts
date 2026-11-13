import { expect, test } from "vitest";
import { resolveFilterDates } from "../../src/features/admin/analytics/visitor-date-filter";
test("visitor presets share Vietnam inclusive dates without time inputs", () => {
  const now = new Date("2026-11-13T03:00:00Z");
  expect(resolveFilterDates({ preset: "1m" }, now)).toEqual({
    from: "2026-10-14",
    to: "2026-11-13",
  });
  expect(resolveFilterDates({ preset: "6m" }, now).from).toBe("2026-05-14");
  expect(resolveFilterDates({ preset: "1y" }, now).from).toBe("2025-11-14");
  expect(
    resolveFilterDates({ preset: "custom", from: "2026-11-01", to: "2026-11-13" }, now),
  ).toEqual({ from: "2026-11-01", to: "2026-11-13" });
  expect(() =>
    resolveFilterDates({ preset: "custom", from: "2026-02-30", to: "2026-03-01" }, now),
  ).toThrow();
  expect(() =>
    resolveFilterDates({ preset: "custom", from: "2026-11-14", to: "2026-11-01" }, now),
  ).toThrow();
});
