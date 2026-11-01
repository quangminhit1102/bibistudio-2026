import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
export function seed(): SeedBatch {
  return {
    categories: [
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
    tags: ["Việt Nam", "Handmade", "Quà tặng", "Cảm hứng", "Sáng tạo"].map((name, i) => ({
      ...seedBase(`tag-${i}`),
      name,
    })),
  };
}
