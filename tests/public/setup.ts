import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});
