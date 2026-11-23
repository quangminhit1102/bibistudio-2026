import { expect, it } from "vitest";
import { withStored } from "../../src/features/admin/shared/forms/relation-options";
import { productConfig } from "../../src/features/admin/products/config";

const options = [
  { value: "notebook", label: "Sổ tay" },
  { value: "magnet", label: "Magnet" },
];

it("a stored value outside the list stays selectable under its own name", () => {
  expect(withStored(options, "sticker")).toEqual([
    ...options,
    { value: "sticker", label: "sticker" },
  ]);
  expect(withStored(options, "magnet")).toBe(options);
  expect(withStored(options, null)).toBe(options);
  expect(withStored(options, "")).toBe(options);
  expect(withStored(options, ["magnet", "pin"]).map((o) => o.value)).toEqual([
    "notebook",
    "magnet",
    "pin",
  ]);
});

it("a product's type and collection are chosen from the admin's lists, by code and slug", () => {
  const field = (key: string) => productConfig.fields.find((f) => f.key === key);
  expect(field("productType")).toMatchObject({
    entity: "productTypes",
    valueKey: "code",
    required: true,
  });
  expect(field("productType")?.options).toBeUndefined();
  expect(field("collection")).toMatchObject({
    entity: "categories",
    filter: { kind: "product" },
    valueKey: "slug",
    required: true,
  });
  expect(productConfig.defaults).toMatchObject({ productType: "", collection: "" });
});
