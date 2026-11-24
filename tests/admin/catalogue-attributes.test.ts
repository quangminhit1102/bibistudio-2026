import { describe, expect, it, vi } from "vitest";
import { tx, type Product } from "@/data/catalogue";
import { getCollection, getProductType } from "@/lib/catalogue-taxonomy";
import {
  attributeRows,
  attributeValue,
  collectionPage,
  groupAttribute,
  selectOptions,
} from "@/lib/catalogue-attributes";
import { toPublicProduct } from "@/lib/content-adapter";
import type { PublicProductShape } from "@/lib/content-api";

// A catalogue of this test's own, so the cases hold for whichever site is built.
vi.mock("@/platform/site", async (importOriginal) => {
  const { defineCatalogue } = await import("@/platform/site-contract");
  const label = (vi: string) => ({ vi, en: vi });
  return {
    ...(await importOriginal<typeof import("@/platform/site")>()),
    catalogue: defineCatalogue({
      attributes: [
        { key: "dimensions", label: label("Kích thước"), type: "text" },
        { key: "material", label: label("Chất liệu"), type: "localized-text" },
        {
          key: "occasion",
          label: label("Dịp lễ"),
          type: "select",
          options: [
            { value: "birthday", label: label("Sinh nhật") },
            { value: "new-year", label: label("Năm mới") },
          ],
        },
      ],
      groupBy: { "greeting-cards": "occasion" },
      collectionPages: { "explore-vietnam": { layout: "feature" }, motivation: { quote: "q" } },
    }),
  };
});

const product = (patch: Partial<Product> = {}): Product => ({
  id: "x",
  slug: "x",
  name: { vi: "Tên", en: "Name" },
  productType: "notebook",
  collection: "motivation",
  description: { vi: "", en: "" },
  images: [],
  sortOrder: 1,
  status: "published",
  ...patch,
});

const apiProduct = (patch: Partial<PublicProductShape>): PublicProductShape =>
  ({
    slug: "api-only-product",
    name: { vi: "Tên", en: "Name" },
    description: { vi: "Mô tả", en: "Description" },
    short_description: null,
    product_type: "notebook",
    collection: "motivation",
    occasion: null,
    dimensions: null,
    pages: null,
    material: { vi: "", en: "" },
    format: { vi: "", en: "" },
    images: [],
    image_alt: { vi: "", en: "" },
    featured: false,
    sort_order: 1,
    ...patch,
  }) as PublicProductShape;

describe("site catalogue attributes", () => {
  it("groups only the collections the site declares", () => {
    expect(groupAttribute("greeting-cards")?.key).toBe("occasion");
    expect(groupAttribute("motivation")).toBeUndefined();
    expect(groupAttribute("toString")).toBeUndefined();
  });

  it("gives a collection's page what the site declares for it, and nothing otherwise", () => {
    expect(collectionPage("explore-vietnam").layout).toBe("feature");
    expect(collectionPage("motivation").quote).toBeTruthy();
    expect(collectionPage("ao-dai")).toEqual({});
    expect(collectionPage("toString")).toEqual({});
  });

  it("lists options of select attributes only", () => {
    expect(selectOptions("occasion")).toHaveLength(2);
    expect(selectOptions("dimensions")).toEqual([]);
    expect(selectOptions("missing")).toEqual([]);
  });

  it("builds detail rows from the attributes a product has, in site order", () => {
    const rows = attributeRows(
      product({ dimensions: "A5", material: { vi: "Giấy", en: "Paper" }, occasion: "birthday" }),
    );
    expect(rows).toEqual([
      ["Kích thước", "A5"],
      ["Chất liệu", "Giấy"],
    ]);
  });

  it("reads a product's value for an attribute key", () => {
    expect(attributeValue(product({ occasion: "birthday" }), "occasion")).toBe("birthday");
    expect(attributeValue(product(), "occasion")).toBeUndefined();
    expect(attributeValue(product({ pages: "" }), "pages")).toBeUndefined();
  });
});

describe("unknown catalogue vocabulary", () => {
  it("keeps an unknown type and collection instead of relabelling them", () => {
    const mapped = toPublicProduct(
      apiProduct({ product_type: "sticker", collection: "summer", occasion: "unknown-day" }),
    );
    expect(mapped.productType).toBe("sticker");
    expect(mapped.collection).toBe("summer");
    expect(mapped.occasion).toBeUndefined();
    expect(tx(getProductType("sticker").name)).toBe("sticker");
    expect(tx(getProductType("sticker").plural)).toBe("sticker");
    expect(tx(getCollection("summer").name)).toBe("summer");
  });

  it("keeps a declared occasion and known vocabulary", () => {
    const mapped = toPublicProduct(apiProduct({ occasion: "birthday" }));
    expect(mapped.occasion).toBe("birthday");
    expect(tx(getProductType(mapped.productType).name)).toBe("Sổ tay");
  });
});
