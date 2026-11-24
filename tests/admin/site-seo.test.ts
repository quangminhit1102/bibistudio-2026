import { describe, expect, it } from "vitest";
import { SITE_NAME, SITE_URL, buildOrganizationSchema, buildProductSchema } from "@/lib/seo";
import { siteUrl } from "@/platform/site-contract";
import { site } from "@/platform/site";

describe("SEO values come from the site config", () => {
  it("uses the site's domain, never the Lovable preview domain", () => {
    expect(SITE_URL).toBe(site.url);
    expect(SITE_NAME).toBe(site.name);
    const product = buildProductSchema({
      name: "A",
      images: [],
      sku: "1",
      price: "10.000",
      handle: "a",
      description: ["d"],
    });
    expect(product.offers.url).toBe(`${site.url}/products/a`);
    expect(JSON.stringify([product, buildOrganizationSchema()])).not.toContain("lovable.app");
  });

  it("describes the organization with the site's own phone and logo", () => {
    const org = buildOrganizationSchema();
    expect(org.name).toBe(site.name);
    expect(org.url).toBe(site.url);
    expect(org.logo).toBe(site.seo.logo ? siteUrl(site, site.seo.logo) : undefined);
    expect(org.contactPoint.telephone).toBe(site.contact.phoneInternational ?? site.contact.phone);
  });
});
