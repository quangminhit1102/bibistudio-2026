import { describe, expect, it } from "vitest";
import { mailHref, mapLinks, socialLink, telHref } from "@/lib/site-contact";
import { defineSite } from "@/platform/site-contract";

const bare = defineSite({
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
  seo: { titleSuffix: "", description: "" },
  fonts: [],
  admin: { title: "Admin", modules: [] },
});

const full = defineSite({
  ...bare,
  contact: {
    ...bare.contact,
    social: [{ id: "zalo", label: "Zalo", href: "https://zalo.me/0900000000" }],
    location: { name: "Shop", address: "1 Main St", lat: 1, lng: 2, query: "Shop, 1 Main St" },
  },
});

describe("site contact helpers", () => {
  it("builds tel and mailto links from the site contact", () => {
    expect(telHref(full)).toBe("tel:0900000000");
    expect(mailHref(full)).toBe("mailto:a@example.com");
  });

  it("finds a social link by id", () => {
    expect(socialLink(full, "zalo")?.href).toBe("https://zalo.me/0900000000");
  });

  it("returns undefined for a channel the site does not have", () => {
    expect(socialLink(bare, "zalo")).toBeUndefined();
    expect(socialLink(full, "tiktok")).toBeUndefined();
  });

  it("builds the map URLs from the location's place query", () => {
    const q = encodeURIComponent("Shop, 1 Main St");
    expect(mapLinks(full.contact.location!)).toEqual({
      embed: `https://www.google.com/maps?q=${q}&z=16&output=embed`,
      maps: `https://www.google.com/maps/search/?api=1&query=${q}`,
      directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    });
  });
});
