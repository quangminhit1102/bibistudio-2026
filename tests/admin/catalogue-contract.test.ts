import { describe, expect, it } from "vitest";
import { defineCatalogue, type CatalogueConfig } from "@/platform/site-contract";
import { catalogue } from "@/platform/site";

const label = { vi: "Nhãn" };
const valid: CatalogueConfig = {
  attributes: [
    { key: "size", label, type: "text" },
    { key: "season", label, type: "select", options: [{ value: "summer", label }] },
  ],
  groupBy: { seasonal: "season" },
};

describe("defineCatalogue", () => {
  it("returns a frozen copy of a valid config", () => {
    const result = defineCatalogue(valid);
    expect(result).toEqual(valid);
    expect(Object.isFrozen(result.attributes)).toBe(true);
  });

  it.each<[string, CatalogueConfig]>([
    ["attributes.Size", { ...valid, attributes: [{ key: "Size", label, type: "text" }] }],
    ["attributes. ", { ...valid, groupBy: {}, attributes: [{ key: " ", label, type: "text" }] }],
    [
      "attributes.size is declared twice",
      { ...valid, attributes: [...valid.attributes, { key: "size", label, type: "text" }] },
    ],
    [
      "attributes.season must list at least one option",
      { attributes: [{ key: "season", label, type: "select", options: [] }], groupBy: {} },
    ],
    [
      "attributes.season has a duplicate option value",
      {
        attributes: [
          {
            key: "season",
            label,
            type: "select",
            options: [
              { value: "summer", label },
              { value: "summer", label },
            ],
          },
        ],
        groupBy: {},
      },
    ],
    ['groupBy.seasonal must name a declared select attribute, got "size"', { ...valid, groupBy: { seasonal: "size" } }],
    ['groupBy.seasonal must name a declared select attribute, got "missing"', { ...valid, groupBy: { seasonal: "missing" } }],
  ])("rejects a config and names the problem: %s", (message, config) => {
    expect(() => defineCatalogue(config)).toThrow(`Invalid catalogue config: ${message}`);
  });
});

describe("the active site's catalogue", () => {
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
    const occasion = catalogue.attributes.find((a) => a.key === "occasion");
    expect(occasion?.type === "select" && occasion.options).toHaveLength(8);
    expect(catalogue.groupBy).toEqual({ "greeting-cards": "occasion" });
  });
});
