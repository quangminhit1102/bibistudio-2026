import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
export function seed(): SeedBatch {
  return {
    posts: Array.from({ length: 40 }, (_, i) => ({
      ...seedBase(`post-${i + 1}`, i),
      title:
        [
          "Gói một món quà nhỏ",
          "Những câu chuyện từ giấy",
          "Một ngày ở Đường sách",
          "Sổ tay và những chuyến đi",
        ][i % 4] + ` — ${i + 1}`,
      slug: `demo-journal-${i + 1}`,
      excerpt: "Những ý tưởng nhỏ để lưu giữ cảm hứng trong cuộc sống thường ngày.",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Một câu chuyện của BiBi" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Đây là nội dung demo. Bạn có thể chỉnh sửa và lưu trên trình duyệt này.",
              },
            ],
          },
        ],
      }),
      categoryId: i % 2 ? "cat-journal" : "cat-travel",
      tagIds: ["tag-0"],
      authorId: `user-${(i % 4) + 1}`,
      status: i % 5 ? "published" : "draft",
      publishAt: i % 5 ? seedBase("date", i).createdAt : null,
      imageId: null,
      seoTitle: "",
      seoDescription: "",
    })),
    media: [],
  };
}
