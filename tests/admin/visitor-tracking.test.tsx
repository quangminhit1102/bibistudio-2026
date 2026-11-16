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
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const catalogueRead = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          mode: "cms",
          generationId: "c43f6ac7-d46d-488b-96af-4db12ca736ef",
          routes: [],
        }),
        { status: 200 },
      ),
    ),
  );
  vi.stubGlobal("fetch", (path: string, options?: RequestInit) =>
    path === "/api/public/content/routes" ? catalogueRead() : send(path, options),
  );
  const view = render(
    <StrictMode>
      <VisitorTracking pathname="/products/da-lat-map-notebook" />
      <AnalyticsPrivacyControl />
    </StrictMode>,
  );
  await act(() => vi.dynamicImportSettled());
  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect(send).toHaveBeenCalledTimes(1);
  expect(catalogueRead).toHaveBeenCalled();
  expect(send.mock.calls[0][0]).toBe("/api/analytics/relay/collect.php");
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

it("privacy copy describes full IP and retained history without promising automatic erasure", () => {
  render(<AnalyticsPrivacyControl />);
  expect(screen.getByText(/IP công khai/)).toBeInTheDocument();
  expect(screen.queryByText(/Dữ liệu cũ tự hết hạn/)).not.toBeInTheDocument();
});
