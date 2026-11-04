import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VisitorTracking } from "../../src/components/visitor-tracking";
import { AnalyticsPrivacyControl } from "../../src/components/analytics-privacy-control";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it("StrictMode cleans timers/listeners, tracks committed public routes and footer opt-out clears only analytics", async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockResolvedValue({ status: 204 });
  vi.stubGlobal("fetch", send);
  const view = render(
    <StrictMode>
      <VisitorTracking pathname="/products/da-lat-map-notebook" />
      <AnalyticsPrivacyControl />
    </StrictMode>,
  );
  await act(() => vi.dynamicImportSettled());
  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toBe("/api/analytics/collect");
  expect(send.mock.calls[0][1].credentials).toBe("include");
  expect(send.mock.calls[0][1].headers.Authorization).toBeUndefined();
  view.rerender(
    <StrictMode>
      <VisitorTracking pathname="/admin/accounts" />
      <AnalyticsPrivacyControl />
    </StrictMode>,
  );
  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(send).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("checkbox"));
  await act(async () => {});
  expect(localStorage.getItem("bibi.analytics.disabled")).toBe("true");
  expect(send.mock.calls[1][0]).toBe("/api/analytics/opt-out");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
  window.dispatchEvent(new Event("pagehide"));
  expect(send).toHaveBeenCalledTimes(2);
});
it("GPC sends nothing and provides a clear disabled control", async () => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: true });
  const send = vi.fn();
  vi.stubGlobal("fetch", send);
  try {
    const view = render(
      <>
        <VisitorTracking pathname="/" />
        <AnalyticsPrivacyControl />
      </>,
    );
    await act(() => vi.dynamicImportSettled());
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    view.unmount();
  } finally {
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  }
});
