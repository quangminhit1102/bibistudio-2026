import { describe, expect, it } from "vitest";
import { tx, type Product } from "@/data/catalogue";
import { getCollection, getProductType } from "@/lib/catalogue-taxonomy";
import {
  attributeRows,
  attributeValue,
  groupAttribute,
  selectOptions,
} from "@/lib/catalogue-attributes";
import { toPublicProduct } from "@/lib/content-adapter";
import type { PublicProductShape } from "@/lib/content-api";

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

  it("lists options of select attributes only", () => {
    expect(selectOptions("occasion")).toHaveLength(8);
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
