import { describe, expect, it } from "vitest";
import { mailHref, mapLinks, socialLink, telHref } from "@/lib/site-contact";
import { defineSite } from "@/platform/site-contract";
import { site } from "@/platform/site";

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

describe("site contact helpers", () => {
  it("builds tel and mailto links from the site contact", () => {
    expect(telHref(site)).toBe("tel:0392969000");
    expect(mailHref(site)).toBe("mailto:bibistudio@gmail.com");
  });

  it("finds a social link by id", () => {
    expect(socialLink(site, "zalo")?.href).toBe("https://zalo.me/0392969000");
    expect(socialLink(site, "facebook")?.href).toBe("https://www.facebook.com/bidiary");
    expect(socialLink(site, "messenger")?.href).toBe("https://m.me/bidiary");
  });

  it("returns undefined for a channel the site does not have", () => {
    expect(socialLink(bare, "zalo")).toBeUndefined();
    expect(socialLink(site, "tiktok")).toBeUndefined();
  });

  it("keeps the map URLs the site used before the move", () => {
    const q = encodeURIComponent("Đường sách Nguyễn Văn Bình, Quận 1, TP. Hồ Chí Minh");
    expect(mapLinks(site.contact.location!)).toEqual({
      embed: `https://www.google.com/maps?q=${q}&z=16&output=embed`,
      maps: `https://www.google.com/maps/search/?api=1&query=${q}`,
      directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    });
  });
});
