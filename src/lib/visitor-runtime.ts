import catalogue from "../data/analytics-catalogue.generated.json";
import { createVisitorTracker } from "./visitor-tracker";
import { sendVisitorBatch } from "./visitor-transport";
import { withPublishedBlog, type PublishedCatalogue } from "./blog-navigation";
import {
  analyticsOptedOut,
  browserPrivacySignal,
  ANALYTICS_OPT_OUT_KEY,
  ANALYTICS_PREFERENCE_EVENT,
} from "./analytics-privacy";

export function startVisitorTracking(
  getPath: () => string,
  options: { catalogue?: PublishedCatalogue } = {},
) {
  let optedOut = analyticsOptedOut();
  let disposed = false,
    refresh: Promise<void> | undefined;
  const controller = new AbortController(),
    nonBlogCatalogue = withPublishedBlog(catalogue, { routes: [] });
  const browserLocks = navigator.locks;
  const lock = browserLocks
    ? async <T>(work: () => Promise<T>): Promise<T> =>
        await browserLocks.request("bibi-analytics-cookie", { mode: "exclusive" }, work)
    : undefined;
  const headers = { "Content-Type": "application/json", "X-Bibi-Request": "1" };
  const instance = createVisitorTracker({
    catalogue: options.catalogue ?? nonBlogCatalogue,
    privacy: () => !optedOut && !browserPrivacySignal(),
    bootstrapLock: lock,
    send: (batch, options) =>
      sendVisitorBatch(batch, { ...options, allowed: () => !optedOut && !browserPrivacySignal() }),
    clear: () =>
      fetch("/api/analytics/opt-out", {
        method: "POST",
        headers,
        credentials: "include",
        body: "{}",
      }),
  });
  const refreshCatalogue = () => {
    if (disposed || optedOut || browserPrivacySignal()) return Promise.resolve();
    if (refresh) return refresh;
    refresh = (async () => {
      try {
        const response = await fetch("/api/public/content/routes", {
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw Error("Published catalogue unavailable");
        const active = await response.json();
        if (active.schemaVersion !== 1 || !Array.isArray(active.routes))
          throw Error("Invalid published catalogue");
        let next: PublishedCatalogue;
        if (active.mode === "legacy" && active.generationId === null && active.routes.length === 0)
          next = catalogue;
        else {
          if (
            active.mode !== "cms" ||
            typeof active.generationId !== "string" ||
            active.routes.length > 100000 ||
            active.routes.some(
              (route: { path?: unknown; label?: unknown }) =>
                !route ||
                typeof route.path !== "string" ||
                !/^\/blog(?:\/[a-z0-9-]+)*$/.test(route.path) ||
                typeof route.label !== "string",
            )
          )
            throw Error("Invalid published catalogue");
          next = withPublishedBlog(catalogue, active);
        }
        if (!disposed) {
          instance.updateCatalogue(next);
          instance.visit(getPath());
        }
      } catch {
        if (!disposed) instance.updateCatalogue(nonBlogCatalogue);
      } finally {
        refresh = undefined;
      }
    })();
    return refresh;
  };
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
      if (!optedOut) {
        instance.visit(getPath());
        void refreshCatalogue();
      }
    });
  };
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("storage", preference);
  window.addEventListener(ANALYTICS_PREFERENCE_EVENT, preference);
  const resume = () => {
    void refreshCatalogue();
  };
  window.addEventListener("pageshow", resume);
  window.addEventListener("focus", resume);
  void refreshCatalogue();
  const dispose = () => {
    disposed = true;
    controller.abort();
    instance.dispose();
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("storage", preference);
    window.removeEventListener(ANALYTICS_PREFERENCE_EVENT, preference);
    window.removeEventListener("pageshow", resume);
    window.removeEventListener("focus", resume);
  };
  return {
    visit: (path: string) => {
      instance.visit(path);
      void refreshCatalogue();
    },
    dispose,
  };
}
