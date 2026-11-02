import { it, expect, vi, afterEach } from "vitest";
import { componentCatalogue } from "../../src/features/admin/components/catalogue";
import { componentLabel } from "../../src/features/admin/components/labels";
import { presetRange } from "../../src/features/admin/analytics/aggregate";
import { userConfig } from "../../src/features/admin/accounts/config";
import { readFileSync } from "node:fs";
afterEach(() => vi.useRealTimers());
it("dashboard and visitor copy do not present the interface as simulated", () => {
  for (const path of ["dashboard/pages/dashboard.tsx", "analytics/pages/visitor-detail.tsx"]) {
    expect(readFileSync("src/features/admin/" + path, "utf8")).not.toMatch(/mô phỏng|giả lập/);
  }
});
it("account management describes its purpose and uses the agreed inactive label", () => {
  expect(userConfig.description).not.toMatch(/giả lập|production|demo/i);
  expect(userConfig.filters?.find((f) => f.field === "active")?.options).toContainEqual({
    value: "false",
    label: "Ngừng hoạt động",
  });
});
it("has Vietnamese display labels for every one of the 96 stable component entries", () => {
  const keys = Object.values(componentCatalogue).flat();
  expect(keys).toHaveLength(96);
  for (const key of keys) {
    expect(componentLabel(key)).not.toBe(key);
    expect(componentLabel(key).length).toBeGreaterThan(2);
  }
});
it("today preset follows the current Vietnam calendar day instead of the seed clock", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T18:00:00Z"));
  expect(presetRange("today")).toEqual({
    start: "2026-11-02T17:00:00.000Z",
    end: "2026-11-03T17:00:00.000Z",
  });
});
