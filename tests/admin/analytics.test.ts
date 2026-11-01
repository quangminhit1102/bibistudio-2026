import { it, expect } from "vitest";
import { aggregateAnalytics, aggregateOrders,conversionRate } from "../../src/features/admin/analytics/aggregate";
import { seedBase } from "../../src/features/admin/demo/clock";
it('conversion counts distinct linked visitors rather than multiple orders',()=>{expect(conversionRate([{visitorId:'v',status:'Delivered'},{visitorId:'v',status:'Delivered'},{visitorId:'other',status:'Cancelled'}],['v','other'])).toBe(50);expect(conversionRate([],[])).toBe(0);});
it("date windows are half-open and empty denominators yield zero", () => {
  const range = { start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z" };
  const visitor = {
    ...seedBase("v"),
    anonymousId: "demo",
    ipAddress: "192.0.2.***",
    country: "Việt Nam",
    city: "Hà Nội",
    deviceType: "Mobile",
    browser: "Chrome",
    operatingSystem: "Android",
    firstSeenAt: range.start,
    lastSeenAt: range.start,
    sessionCount: 1,
    pageViewCount: 1,
  };
  const s = {
    ...seedBase("s"),
    visitorId: "v",
    startedAt: range.start,
    endedAt: "2026-10-01T00:01:00Z",
    landingPage: "/",
    exitPage: "/",
    referrer: "Google",
    pages: [{ path: "/", at: range.start }],
  };
  const result = aggregateAnalytics(
    [visitor],
    [s, { ...s, id: "end", startedAt: range.end }],
    range,
  );
  expect(result.visits).toBe(1);
  expect(result.uniqueVisitors).toBe(1);
  expect(result.newVisitors).toBe(1);
  expect(result.bounceRate).toBe(100);
  expect(result.countries.reduce((n, p) => n + p.value, 0)).toBe(1);
  expect(aggregateAnalytics([], [], range).bounceRate).toBe(0);
  expect(aggregateOrders([], range).revenue).toBe(0);
});
