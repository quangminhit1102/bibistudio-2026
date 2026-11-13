import { expect, test } from "vitest";
import { createVisitorApi } from "../../src/features/admin/analytics/http-api";
import { createAdminHttp } from "../../src/lib/admin-http";
import { grant, json, immediateLock, profile } from "./helpers/http-client";
import { resolveVisitorWindow } from "../../backend/src/visitors/date-window";

test("scoped reports reject old-backend and mismatched-window responses after rollback", async () => {
  let response: unknown = { totalVisitors: 9, totalSessions: 17, products: [] };
  const client = createAdminHttp({
    origin: "http://localhost",
    refreshLock: immediateLock,
    fetch: async (input) =>
      new URL(String(input)).pathname.endsWith("refresh")
        ? json(grant("memory-user"))
        : new URL(String(input)).pathname.endsWith("profile")
          ? json(profile)
          : json(response),
  });
  await client.restore();
  const api = createVisitorApi(client),
    scope = { from: "2020-01-01", to: "2020-01-31" };
  await expect(api.report(undefined, scope)).rejects.toThrow(/tải lại trang/i);
  response = {
    totalVisitors: 1,
    totalSessions: 1,
    totalInterestedVisitors: 0,
    totalProducts: 0,
    products: [],
    bucketUnit: "day",
    series: [{ startUtc: "2026-10-31T17:00:00Z", label: "01/11/2026", sessions: 1 }],
    window: {
      fromDate: "2026-11-01",
      toDate: "2026-11-13",
      startUtc: "2026-10-31T17:00:00Z",
      endUtcExclusive: "2026-11-13T17:00:00Z",
      asOf: "2026-11-13T03:00:00Z",
    },
  };
  await expect(api.report(undefined, scope)).rejects.toThrow(/tải lại trang/i);
  const window = resolveVisitorWindow(scope, new Date("2026-11-13T03:00:00Z"));
  response = {
    totalVisitors: 1,
    totalSessions: 1,
    totalInterestedVisitors: 0,
    totalProducts: 0,
    products: [],
    bucketUnit: "day",
    series: [{ startUtc: window.startUtc, label: "01/01/2020", sessions: 1 }],
    window,
  };
  await expect(api.report(undefined, scope)).resolves.toMatchObject({ totalSessions: 1, window });
});
