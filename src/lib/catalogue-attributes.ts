// Product attributes and collection grouping, as declared by the active site's catalogue config.
import { tx, type Product } from "@/data/catalogue";
import { catalogue, site } from "@/platform/site";
import type {
  AttributeOption,
  CollectionPageConfig,
  Localized,
  SelectAttribute,
} from "@/platform/site-contract";

/** Site-declared text in the site's default language. */
export const text = (value: Localized | undefined): string => value?.[site.defaultLocale] ?? "";

const select = (key: string): SelectAttribute | undefined => {
  const attribute = catalogue.attributes.find((a) => a.key === key);
  return attribute?.type === "select" ? attribute : undefined;
};

export const selectOptions = (key: string): readonly AttributeOption[] =>
  select(key)?.options ?? [];

/** The select attribute a collection's products are grouped by, if the site declares one. */
/** What the site adds to one collection's page; nothing for a collection it does not name. */
export const collectionPage = (collectionSlug: string): CollectionPageConfig =>
  catalogue.collectionPages && Object.hasOwn(catalogue.collectionPages, collectionSlug)
    ? catalogue.collectionPages[collectionSlug]
    : {};

export const groupAttribute = (collectionSlug: string): SelectAttribute | undefined =>
  Object.hasOwn(catalogue.groupBy, collectionSlug)
    ? select(catalogue.groupBy[collectionSlug])
    : undefined;

/** A product's value for a site attribute: from `attributes`, else the field of that name. */
export function attributeValue(product: Product, key: string): string | undefined {
  const value = product.attributes?.[key] ?? (product as Record<string, unknown>)[key];
  if (typeof value === "string") return value || undefined;
  if (value && typeof value === "object") {
    const text = value as Partial<Product["name"]>;
    return text.vi || text.en || undefined;
  }
  return undefined;
}

/** Label and value of every free-text attribute the product has, in the site's display order. */
export function attributeRows(product: Product): [label: string, value: string][] {
  return catalogue.attributes.flatMap((attribute): [string, string][] => {
    if (attribute.type === "select") return [];
    const value = attributeValue(product, attribute.key);
    return value ? [[text(attribute.label), value]] : [];
  });
}
