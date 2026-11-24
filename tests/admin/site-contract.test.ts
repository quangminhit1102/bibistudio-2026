import { describe, expect, it } from "vitest";
import { defineSite, siteUrl, type SiteConfig } from "@/platform/site-contract";

const valid: SiteConfig = {
  name: "Example",
  shortName: "Ex",
  url: "https://example.com",
  locales: ["vi"],
  defaultLocale: "vi",
  contact: {
    phone: "0900000000",
    phoneDisplay: "0900 000 000",
    email: "a@example.com",
    social: [],
  },
  seo: { titleSuffix: " — Example", description: "Example site" },
  fonts: [],
  admin: { title: "Example Admin", modules: [] },
};

describe("defineSite", () => {
  it.each([
    ["name", { name: " " }],
    ["url", { url: "http://example.com" }],
    ["url", { url: "not a url" }],
    ["locales", { locales: [] }],
    ["defaultLocale", { defaultLocale: "en" }],
  ] as const)("rejects an invalid %s and names the field", (field, patch) => {
    expect(() => defineSite({ ...valid, ...patch })).toThrow(field);
  });

  it("normalizes the site URL to its origin", () => {
    expect(defineSite({ ...valid, url: "https://example.com/" }).url).toBe("https://example.com");
  });

  it("rejects a site URL that carries a path, query or hash", () => {
    expect(() => defineSite({ ...valid, url: "https://example.com/shop" })).toThrow("url");
    expect(() => defineSite({ ...valid, url: "https://example.com/?a=1" })).toThrow("url");
  });

  it("returns a frozen config", () => {
    const config = defineSite(valid);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.contact)).toBe(true);
  });
});

describe("siteUrl", () => {
  const config = defineSite({ ...valid, url: "https://example.com/" });
  it("joins paths without double slashes", () => {
    expect(siteUrl(config, "/blog/a")).toBe("https://example.com/blog/a");
    expect(siteUrl(config, "blog/a")).toBe("https://example.com/blog/a");
    expect(siteUrl(config, "//blog/a")).toBe("https://example.com/blog/a");
  });
  it("returns the origin when no path is given", () => {
    expect(siteUrl(config)).toBe("https://example.com");
    expect(siteUrl(config, "/")).toBe("https://example.com/");
  });
});
