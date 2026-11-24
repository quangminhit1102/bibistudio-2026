import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
import { collections, productTypes } from "@/data/catalogue";
export function seed(): SeedBatch {
  return {
    categories: [
      ...[
        ["cat-notebook", "Sổ tay", "product"],
        ["cat-card", "Thiệp", "product"],
        ["cat-journal", "Nhật ký", "content"],
        ["cat-travel", "Du lịch", "content"],
        ["genre-art", "Nghệ thuật", "genre"],
        ["genre-fiction", "Văn học", "genre"],
      ].map(([id, name, kind], i) => ({
        ...seedBase(id),
        name,
        slug: id,
        parentId: null,
        kind: kind as "product" | "content" | "genre",
        position: i,
        active: true,
      })),
      // The site's collections: a product's `collection` holds one of these slugs.
      ...collections.map((c, i) => ({
        ...seedBase("collection-" + c.id),
        name: c.name.vi,
        nameEn: c.name.en,
        slug: c.id,
        description: c.intro.vi,
        introEn: c.intro.en,
        tagline: c.tagline.vi,
        taglineEn: c.tagline.en,
        parentId: null,
        kind: "product" as const,
        position: 10 + i,
        active: true,
      })),
    ],
    productTypes: productTypes.map((t, i) => ({
      ...seedBase("type-" + t.id),
      code: t.id,
      slug: t.slug,
      name: t.name.vi,
      nameEn: t.name.en,
      plural: t.plural.vi,
      pluralEn: t.plural.en,
      description: t.tagline.vi,
      taglineEn: t.tagline.en,
      position: i,
      active: true,
    })),
  };
}
