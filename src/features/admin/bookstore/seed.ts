import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
export function seed(): SeedBatch {
  return {
    authors: Array.from({ length: 15 }, (_, i) => ({
      ...seedBase(`author-${i + 1}`),
      name: `Tác giả minh họa ${i + 1}`,
      nationality: "Việt Nam",
      description: "Hồ sơ tác giả giả lập cho bộ dữ liệu demo.",
    })),
    publishers: Array.from({ length: 10 }, (_, i) => ({
      ...seedBase(`publisher-${i + 1}`),
      name: `Nhà xuất bản Demo ${i + 1}`,
      country: "Việt Nam",
      email: `publisher${i + 1}@example.test`,
    })),
    books: Array.from({ length: 30 }, (_, i) => ({
      ...seedBase(`book-${i + 1}`, i),
      name:
        [
          "Việt Nam qua trang giấy",
          "Chuyện nhỏ Hà Nội",
          "Màu của ký ức",
          "Nghệ thuật làm giấy",
          "Những miền thương nhớ",
        ][i % 5] + ` ${Math.floor(i / 5) + 1}`,
      isbn: `978604${String(i + 1).padStart(7, "0")}`,
      slug: `demo-book-${i + 1}`,
      authorIds: [`author-${(i % 15) + 1}`],
      publisherId: `publisher-${(i % 10) + 1}`,
      genreIds: [i % 2 ? "genre-art" : "genre-fiction"],
      year: 2020 + (i % 7),
      language: "vi",
      description: "Ấn phẩm mô phỏng trong thư viện quản trị BiBi.",
      price: 90000 + (i % 8) * 15000,
      stock: 20 + i,
      reserved: 0,
      status: "published",
      imageIds: [],
      tags: [],
      seoTitle: "",
      seoDescription: "",
    })),
  };
}
