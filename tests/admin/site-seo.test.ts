import { describe, expect, it } from "vitest";
import { SITE_NAME, SITE_URL, buildOrganizationSchema, buildProductSchema } from "@/lib/seo";
import { site } from "@/platform/site";

describe("SEO values come from the site config", () => {
  it("uses the production domain, never the Lovable preview domain", () => {
    expect(SITE_URL).toBe("https://bibistudio.vn");
    expect(SITE_NAME).toBe(site.name);
    const product = buildProductSchema({
      name: "A",
      images: [],
      sku: "1",
      price: "10.000",
      handle: "a",
      description: ["d"],
    });
    expect(product.offers.url).toBe("https://bibistudio.vn/products/a");
    expect(JSON.stringify([product, buildOrganizationSchema()])).not.toContain("lovable.app");
  });

  it("describes the organization with the site's own phone and logo", () => {
    const org = buildOrganizationSchema();
    expect(org.name).toBe("BiBi Studio");
    expect(org.url).toBe("https://bibistudio.vn");
    expect(org.logo).toBe("https://bibistudio.vn/bibi-logo.svg");
    expect(org.contactPoint.telephone).toBe("+84392969000");
  });
});
