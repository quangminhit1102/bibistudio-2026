import catalogue from "../data/analytics-catalogue.generated.json";
import { createVisitorTracker } from "./visitor-tracker";
import {
  analyticsOptedOut,
  browserPrivacySignal,
  ANALYTICS_OPT_OUT_KEY,
  ANALYTICS_PREFERENCE_EVENT,
} from "./analytics-privacy";

export function startVisitorTracking(getPath: () => string) {
  let optedOut = analyticsOptedOut();
  const browserLocks = navigator.locks;
  const lock = browserLocks
    ? async <T>(work: () => Promise<T>): Promise<T> =>
        await browserLocks.request("bibi-analytics-cookie", { mode: "exclusive" }, work)
    : undefined;
  const headers = { "Content-Type": "application/json", "X-Bibi-Request": "1" };
  const instance = createVisitorTracker({
    catalogue,
    privacy: () => !optedOut && !browserPrivacySignal(),
    bootstrapLock: lock,
    send: (batch, options) =>
      fetch("/api/analytics/collect", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(batch),
        keepalive: options.keepalive,
      }),
    clear: () =>
      fetch("/api/analytics/opt-out", {
        method: "POST",
        headers,
        credentials: "include",
        body: "{}",
      }),
  });
  const pagehide = () => {
    void instance.flush("pagehide");
  };
  const preference = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== ANALYTICS_OPT_OUT_KEY) return;
    optedOut =
      event instanceof CustomEvent && typeof event.detail === "boolean"
        ? event.detail
        : analyticsOptedOut();
    void instance.setEnabled(!optedOut && !browserPrivacySignal()).then(() => {
      if (!optedOut) instance.visit(getPath());
    });
  };
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("storage", preference);
  window.addEventListener(ANALYTICS_PREFERENCE_EVENT, preference);
  const dispose = () => {
    instance.dispose();
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("storage", preference);
    window.removeEventListener(ANALYTICS_PREFERENCE_EVENT, preference);
  };
  return { visit: instance.visit, dispose };
}
