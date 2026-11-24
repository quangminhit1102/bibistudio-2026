// What this site declares. Core behaviour is tested in `tests/admin`, for any site.
import { describe, expect, it } from "vitest";
import { collectionPage, groupAttribute, selectOptions } from "@/lib/catalogue-attributes";
import { buildOrganizationSchema } from "@/lib/seo";
import { mailHref, mapLinks, socialLink, telHref } from "@/lib/site-contact";
import { catalogue, site } from "@/platform/site";

describe("site config", () => {
  it("is the BiBi Studio configuration", () => {
    expect(site.url).toBe("https://bibistudio.vn");
    expect(site.contact.phone).toBe("0392969000");
    expect(site.defaultLocale).toBe("vi");
  });

  it("keeps the verified contact channels", () => {
    expect(telHref(site)).toBe("tel:0392969000");
    expect(mailHref(site)).toBe("mailto:bibistudio@gmail.com");
    expect(socialLink(site, "zalo")?.href).toBe("https://zalo.me/0392969000");
    expect(socialLink(site, "facebook")?.href).toBe("https://www.facebook.com/bidiary");
    expect(socialLink(site, "messenger")?.href).toBe("https://m.me/bidiary");
  });

  it("keeps the map URLs the site used before the move", () => {
    const q = encodeURIComponent("Đường sách Nguyễn Văn Bình, Quận 1, TP. Hồ Chí Minh");
    expect(mapLinks(site.contact.location!)).toEqual({
      embed: `https://www.google.com/maps?q=${q}&z=16&output=embed`,
      maps: `https://www.google.com/maps/search/?api=1&query=${q}`,
      directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    });
  });

  it("describes the organization with its own phone and logo", () => {
    const org = buildOrganizationSchema();
    expect(org.name).toBe("BiBi Studio");
    expect(org.url).toBe("https://bibistudio.vn");
    expect(org.logo).toBe("https://bibistudio.vn/bibi-logo.svg");
    expect(org.contactPoint.telephone).toBe("+84392969000");
  });
});

describe("site catalogue", () => {
  it("declares the product attributes in display order", () => {
    expect(catalogue.attributes.map((a) => a.key)).toEqual([
      "dimensions",
      "material",
      "pages",
      "format",
      "occasion",
    ]);
  });

  it("groups greeting cards by the eight occasions", () => {
    expect(selectOptions("occasion")).toHaveLength(8);
    expect(catalogue.groupBy).toEqual({ "greeting-cards": "occasion" });
    expect(groupAttribute("greeting-cards")?.key).toBe("occasion");
  });

  it("gives two collections a page of their own", () => {
    expect(collectionPage("explore-vietnam").layout).toBe("feature");
    expect(collectionPage("motivation").quote).toBeTruthy();
    expect(collectionPage("ao-dai")).toEqual({});
  });
});
