import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getAllProducts } from "@/data/catalogue";
import HomePage from "@/platform/pages/home";

const hidden = vi.hoisted(() => ({ ids: [] as string[] }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { slug?: string } }) => (
    <a href={`/${params?.slug ?? ""}`}>{children}</a>
  ),
}));
vi.mock("@/lib/catalogue-taxonomy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalogue-taxonomy")>();
  return {
    ...actual,
    useTaxonomy: () => {
      const all = actual.taxonomy();
      return { ...all, collections: all.collections.filter((c) => !hidden.ids.includes(c.id)) };
    },
  };
});

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  hidden.ids = [];
});

const links = (slug: string) =>
  screen.getAllByRole("link").filter((a) => a.getAttribute("href") === `/${slug}`);

it("shows a tile and the story of the featured collection", () => {
  render(<HomePage products={getAllProducts()} />);
  expect(links("explore-vietnam").length).toBeGreaterThan(1);
  expect(screen.getByText("Câu chuyện nổi bật")).toBeTruthy();
});

it("leaves out the tile and the story of a collection the admin has hidden", () => {
  hidden.ids = ["explore-vietnam"];
  render(<HomePage products={getAllProducts()} />);
  expect(links("explore-vietnam")).toEqual([]);
  expect(screen.queryByText("Câu chuyện nổi bật")).toBeNull();
  expect(screen.queryByText("explore-vietnam")).toBeNull();
  expect(links("vietnamese-food").length).toBeGreaterThan(0);
});
