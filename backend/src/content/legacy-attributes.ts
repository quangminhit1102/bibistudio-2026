// Product attributes live in `products.attributes`, keyed by the site's attribute key.
// Five of them still have their own columns from before migration 3. Both are written
// together, and the columns win on read: a release from before migration 3 only writes
// the columns, so an edit made after a rollback stays visible. Remove this file together
// with the columns.

export type AttributeValue = string | { vi: string; en: string };
export type Attributes = Record<string, AttributeValue>;

export interface LegacyAttributeColumns {
  dimensions: string | null;
  pages: string | null;
  material_vi: string | null;
  material_en: string | null;
  format_vi: string | null;
  format_en: string | null;
  occasion: string | null;
}

const plain = ["dimensions", "pages", "occasion"] as const;
const localized = ["material", "format"] as const;
export const legacyAttributeKeys: readonly string[] = [...plain, ...localized];

const text = (value: unknown): string => (value == null ? "" : String(value));

type LegacyRow = LegacyAttributeColumns | Record<string, unknown>;

export function attributesFromLegacy(row: LegacyRow): Attributes {
  const result: Attributes = {};
  for (const key of plain) if (text(row[key])) result[key] = text(row[key]);
  for (const key of localized) {
    const vi = text(row[`${key}_vi`]);
    const en = text(row[`${key}_en`]);
    if (vi || en) result[key] = { vi, en };
  }
  return result;
}

export function legacyFromAttributes(attributes: Attributes): LegacyAttributeColumns {
  const one = (key: string) => {
    const value = attributes[key];
    return (typeof value === "string" ? value : value?.vi) || null;
  };
  // A plain text for a per-language attribute is its Vietnamese text.
  const side = (key: string, locale: "vi" | "en") => {
    const value = attributes[key];
    if (typeof value === "string") return (locale === "vi" && value) || null;
    return value?.[locale] || null;
  };
  return {
    dimensions: one("dimensions"),
    pages: one("pages"),
    material_vi: side("material", "vi"),
    material_en: side("material", "en"),
    format_vi: side("format", "vi"),
    format_en: side("format", "en"),
    occasion: one("occasion"),
  };
}

export function parseAttributes(stored: unknown): Attributes {
  let value = stored;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Attributes) : {};
}

/** The attributes of a product row: stored JSON, with the legacy columns deciding their keys. */
export function mergeAttributes(stored: unknown, row: LegacyRow): Attributes {
  const result = { ...parseAttributes(stored) };
  for (const key of legacyAttributeKeys) delete result[key];
  return { ...result, ...attributesFromLegacy(row) };
}
