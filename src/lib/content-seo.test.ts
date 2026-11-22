import { describe, it, expect } from "vitest";
import { resolveSeo } from "./content-seo";

describe("resolveSeo", () => {
  it("falls back to title/excerpt when seo empty", () => {
    expect(resolveSeo({ seoTitle: "", seoDescription: "", title: "A", excerpt: "B" })).toEqual({
      title: "A",
      description: "B",
    });
  });
  it("uses seo overrides when provided", () => {
    expect(
      resolveSeo({ seoTitle: "SEO A", seoDescription: "SEO B", title: "A", excerpt: "B" }),
    ).toEqual({ title: "SEO A", description: "SEO B" });
  });
});
