import { it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { loadPublicContent } from "../../src/lib/public-content";
import { BlogHighlights } from "../../src/components/blog-highlights";
import { createVisitorTracker } from "../../src/lib/visitor-tracker";
import { startVisitorTracking } from "../../src/lib/visitor-runtime";
const snapshot = (slugs: string[]) => ({
  schemaVersion: 1,
  generationId: "f506bba2-b497-48dd-a0a1-0fa1be728853",
  committedAt: "2026-11-14T00:00:00Z",
  posts: slugs.map((slug, i) => ({
    id: slug,
    slug,
    title: "Public " + slug,
    excerpt: "Published text",
    publishedAt: `2026-11-${14 - i}T00:00:00Z`,
    coverMediaId: "media",
    coverAlt: "Public photo",
    categoryId: "category",
  })),
  categories: [{ id: "category", name: "Paper" }],
  media: {
    "media/hash.webp": {
      hash: "a".repeat(64),
      file: "media/hash.webp",
      mime: "image/webp",
      width: 960,
      height: 640,
      bytes: 1000,
    },
  },
  routes: [],
  redirects: {},
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("loads public schema1 with a generation ID and never falls back on HTTP errors", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(snapshot(["new"])), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();
  expect((await loadPublicContent({ signal: controller.signal })).posts[0].slug).toBe("new");
  expect(fetcher.mock.calls[0][1].signal).toBe(controller.signal);
  fetcher.mockResolvedValue(new Response("{}", { status: 503 }));
  await expect(loadPublicContent({})).rejects.toThrow();
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ ...snapshot([]), schemaVersion: 2 }), { status: 200 }),
  );
  await expect(loadPublicContent({})).rejects.toThrow();
});
it("Home shows the newest three published posts and removes unpublished cards on reload", async () => {
  let publicSnapshot = snapshot(["one", "two", "three", "four"]);
  const fetcher = vi
    .fn()
    .mockImplementation((path: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            path.endsWith("/routes")
              ? {
                  schemaVersion: 1,
                  mode: "cms",
                  generationId: publicSnapshot.generationId,
                  routes: [],
                }
              : publicSnapshot,
          ),
          { status: 200 },
        ),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const view = render(<BlogHighlights />);
  await screen.findByText("Public one");
  expect(screen.queryByText("Public four")).toBeNull();
  expect(screen.getByRole("link", { name: "Public one" })).toHaveAttribute("href", "/blog/one");
  view.unmount();
  publicSnapshot = snapshot(["two"]);
  render(<BlogHighlights />);
  await screen.findByText("Public two");
  expect(screen.queryByText("Public one")).toBeNull();
});
it("Home leaves a clear unavailable state when public reads fail", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
  render(<BlogHighlights />);
  await screen.findByRole("status");
  expect(screen.queryByRole("article")).toBeNull();
});
it("a refreshed tracker accepts new published slugs and rejects removed or unknown ones", async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockResolvedValue({ status: 204 }),
    base = { routes: [{ path: "/", label: "Home" }], products: [] };
  const tracker = createVisitorTracker({ catalogue: base, send, privacy: () => true });
  tracker.updateCatalogue({
    ...base,
    routes: [...base.routes, { path: "/blog/new", label: "New" }],
  });
  tracker.visit("/blog/new");
  tracker.visit("/blog/draft");
  await vi.advanceTimersByTimeAsync(15000);
  expect(send.mock.calls[0][0].paths).toEqual(["/blog/new"]);
  tracker.updateCatalogue(base);
  tracker.visit("/blog/new");
  await vi.advanceTimersByTimeAsync(15000);
  expect(send).toHaveBeenCalledOnce();
  tracker.dispose();
});
it("DNT, GPC and local opt-out suppress both collection and dynamic catalogue requests", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const privacy of [
    { doNotTrack: "1", globalPrivacyControl: false, optOut: false },
    { doNotTrack: "0", globalPrivacyControl: true, optOut: false },
    { doNotTrack: "0", globalPrivacyControl: false, optOut: true },
  ]) {
    vi.stubGlobal("navigator", {
      doNotTrack: privacy.doNotTrack,
      globalPrivacyControl: privacy.globalPrivacyControl,
    });
    localStorage.setItem("bibi.analytics.disabled", String(privacy.optOut));
    const tracker = startVisitorTracking(() => "/blog/new", {
      catalogue: { routes: [{ path: "/blog/new", label: "New" }], products: [] },
    });
    tracker.visit("/blog/new");
    await vi.advanceTimersByTimeAsync(30000);
    tracker.dispose();
  }
  localStorage.removeItem("bibi.analytics.disabled");
  expect(fetcher).not.toHaveBeenCalled();
});
