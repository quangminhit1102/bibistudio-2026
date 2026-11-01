import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
const places = [
  "Đà Nẵng",
  "Hà Giang",
  "Sài Gòn",
  "Cà Mau",
  "Đà Lạt",
  "Hà Nội",
  "Hội An",
  "Huế",
  "Nha Trang",
  "Sa Pa",
];
export function seed(): SeedBatch {
  return {
    products: Array.from({ length: 50 }, (_, i) => ({
      ...seedBase(`product-${i + 1}`, i % 28),
      name:
        i < 30
          ? `Sổ tay bản đồ ${places[i % 10]}${i >= 10 ? ` — mẫu ${Math.floor(i / 10) + 1}` : ""}`
          : `Thiệp Việt Nam ${i - 29}`,
      sku: `BIBI-${String(i + 1).padStart(4, "0")}`,
      slug: `bibi-demo-${i + 1}`,
      description: "Ấn phẩm giấy được thiết kế từ những câu chuyện và cảm hứng Việt Nam.",
      shortDescription: "Một món quà nhỏ, lưu giữ câu chuyện của bạn.",
      productType: i < 30 ? "notebook" : "greeting-card",
      collection: "explore-vietnam",
      categoryId: i < 30 ? "cat-notebook" : "cat-card",
      price: 45000 + (i % 7) * 10000,
      compareAt: 0,
      stock: 30 + (i % 20),
      reserved: 0,
      status: i % 8 === 0 ? "draft" : "published",
      imageIds: [],
      tags: ["Việt Nam"],
      seoTitle: "",
      seoDescription: "",
    })),
  };
}
