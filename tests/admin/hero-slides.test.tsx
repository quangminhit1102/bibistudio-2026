import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { HeroSlides } from "../../src/components/brand/hero-slides";
const reduced = vi.hoisted(() => ({ value: false }));
vi.mock("../../src/components/brand/motion", () => ({
  prefersReducedMotion: () => reduced.value,
  Parallax: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
const slides = [
  { src: "/a.webp", alt: "Ảnh một" },
  { src: "/b.webp", alt: "Ảnh hai" },
  { src: "/c.webp", alt: "Ảnh ba" },
];
beforeEach(() => {
  vi.useFakeTimers();
  reduced.value = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("advances at 5500ms, keeps image and selected dot synchronized, and cleans its timer", () => {
  const view = render(<HeroSlides slides={slides} />);
  expect(screen.getAllByRole("button")).toHaveLength(3);
  expect(screen.getByRole("img", { name: "Ảnh một" })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(5499));
  expect(screen.getByRole("button", { name: "Ảnh 1" })).toHaveAttribute("aria-current", "true");
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("img", { name: "Ảnh hai" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ảnh 2" })).toHaveAttribute("aria-current", "true");
  fireEvent.click(screen.getByRole("button", { name: "Ảnh 3" }));
  expect(screen.getByRole("img", { name: "Ảnh ba" })).toBeInTheDocument();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("respects reduced motion while retaining manual slide selection", () => {
  reduced.value = true;
  render(<HeroSlides slides={slides} />);
  act(() => vi.advanceTimersByTime(11000));
  expect(screen.getByRole("img", { name: "Ảnh một" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ảnh 3" }));
  expect(screen.getByRole("img", { name: "Ảnh ba" })).toBeInTheDocument();
  expect(vi.getTimerCount()).toBe(0);
});
