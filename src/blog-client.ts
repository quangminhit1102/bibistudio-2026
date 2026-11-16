import "./styles.css";
import catalogue from "./data/analytics-catalogue.generated.json";
import { withPublishedBlog } from "./lib/blog-navigation";
import { startVisitorTracking } from "./lib/visitor-runtime";
import {
  analyticsOptedOut,
  setAnalyticsOptOut,
  ANALYTICS_PREFERENCE_EVENT,
} from "./lib/analytics-privacy";

// Enhance the existing document. The article, navigation and mobile menu work without JS.
const node = document.getElementById("bibi-content-bootstrap");
if (node?.textContent && node.textContent.length <= 16 * 1024 ** 2) {
  try {
    const value = JSON.parse(node.textContent);
    const local =
      ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) &&
      value.canonicalOrigin === location.origin;
    if (
      value.schemaVersion !== 1 ||
      typeof value.generationId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(value.generationId) ||
      !(value.canonicalOrigin === "https://bibistudio.vn" || local) ||
      !Array.isArray(value.routes) ||
      value.routes.length > 100000 ||
      value.routes.some(
        (route: { path?: unknown; label?: unknown }) =>
          !route ||
          typeof route.path !== "string" ||
          !/^\/blog(?:\/[a-z0-9-]+)*$/.test(route.path) ||
          typeof route.label !== "string",
      ) ||
      !value.routes.some((route: { path: string }) => route.path === value.path)
    )
      throw Error("Invalid public document bootstrap");
    try {
      sessionStorage.removeItem("bibi:blog-document:" + location.pathname + location.search);
    } catch {
      /* Navigation works without storage. */
    }
    const tracker = startVisitorTracking(() => location.pathname, {
      catalogue: withPublishedBlog(catalogue, value),
    });
    tracker.visit(location.pathname);
  } catch {
    /* Document remains readable if progressive tracking is unavailable. */
  }
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-privacy-settings]")) {
  let optedOut = analyticsOptedOut();
  const render = () => {
    button.hidden = false;
    button.textContent = optedOut ? "Bật phân tích lượt truy cập" : "Tắt phân tích lượt truy cập";
    button.setAttribute("aria-pressed", String(optedOut));
  };
  button.addEventListener("click", () => {
    optedOut = !optedOut;
    setAnalyticsOptOut(optedOut);
    render();
  });
  window.addEventListener(ANALYTICS_PREFERENCE_EVENT, (event) => {
    if (event instanceof CustomEvent && typeof event.detail === "boolean") {
      optedOut = event.detail;
      render();
    }
  });
  render();
}
