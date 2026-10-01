// src/data/catalogue.ts
// BiBi Studio catalogue: product TYPES (what it is) and COLLECTIONS (what story it belongs to)
// are separate dimensions. Products reference one of each.
// STARTER DATA: product names below are placeholders to be replaced with the real BiBi range.
// Optional attributes (dimensions, material, pages, format) are only shown when filled in.

import exploreVietnamImg from "@/assets/col-explore-vietnam.jpg";
import vietnameseFoodImg from "@/assets/col-vietnamese-food.jpg";
import aoDaiImg from "@/assets/col-ao-dai.jpg";

export type Localized = { vi: string; en: string };

export type ProductTypeId =
  | "notebook"
  | "greeting-card"
  | "postcard"
  | "envelope"
  | "letter-paper"
  | "magnet";

export type CollectionId =
  | "explore-vietnam"
  | "vietnamese-food"
  | "motivation"
  | "ao-dai"
  | "greeting-cards"
  | "animals"
  | "spiral-cards";

export type ProductType = {
  id: ProductTypeId;
  slug: string; // URL segment under /products
  name: Localized;
  plural: Localized;
  tagline: Localized;
  image?: string;
};

export type Collection = {
  id: CollectionId;
  slug: string;
  name: Localized;
  tagline: Localized;
  intro: Localized;
  image?: string;
};

export type Product = {
  id: string;
  slug: string;
  name: Localized;
  productType: ProductTypeId;
  collection: CollectionId;
  description: Localized;
  dimensions?: string;
  material?: Localized;
  pages?: string;
  format?: Localized;
  images: string[];
  imageAlt?: Localized;
  featured?: boolean;
  sortOrder: number;
  status: "published" | "draft";
};

export const productTypes: ProductType[] = [
  { id: "notebook", slug: "notebooks", name: { vi: "Sổ tay", en: "Notebook" }, plural: { vi: "Sổ tay", en: "Notebooks" }, tagline: { vi: "Những khoảng giấy nhỏ cho suy nghĩ lớn.", en: "Small spaces for big thoughts." }, image: exploreVietnamImg },
  { id: "greeting-card", slug: "greeting-cards", name: { vi: "Thiệp", en: "Greeting Card" }, plural: { vi: "Thiệp", en: "Greeting Cards" }, tagline: { vi: "Lời muốn nói, gửi trong một tấm thiệp.", en: "Words you want to say, folded in paper." }, image: aoDaiImg },
  { id: "postcard", slug: "postcards", name: { vi: "Postcard", en: "Postcard" }, plural: { vi: "Postcard", en: "Postcards" }, tagline: { vi: "Một khung hình nhỏ để gửi đi xa.", en: "A small picture to send far away." }, image: vietnameseFoodImg },
  { id: "envelope", slug: "envelopes", name: { vi: "Bao thư", en: "Envelope" }, plural: { vi: "Bao thư", en: "Envelopes" }, tagline: { vi: "Giữ trọn lời nhắn bên trong.", en: "Keeping a message safe inside." } },
  { id: "letter-paper", slug: "letter-paper", name: { vi: "Giấy viết thư", en: "Letter Paper" }, plural: { vi: "Giấy viết thư", en: "Letter Paper" }, tagline: { vi: "Cho những lá thư viết tay.", en: "For letters written by hand." } },
  { id: "magnet", slug: "magnets", name: { vi: "Magnet", en: "Magnet" }, plural: { vi: "Magnet", en: "Magnets" }, tagline: { vi: "Một mảnh ký ức trên cửa tủ lạnh.", en: "A little memory on the fridge door." } },
];

export const collections: Collection[] = [
  { id: "explore-vietnam", slug: "explore-vietnam", name: { vi: "Khám phá Việt Nam", en: "Explore Vietnam" }, tagline: { vi: "Những miền đất, hương vị và câu chuyện thường ngày của Việt Nam.", en: "Places, flavours and everyday stories from Vietnam." }, intro: { vi: "Việt Nam qua lăng kính của giấy: phố cổ, mái ngói, dòng sông và nhịp sống thường ngày.", en: "Vietnam interpreted through paper goods: old streets, tiled roofs, rivers and everyday life." }, image: exploreVietnamImg },
  { id: "vietnamese-food", slug: "vietnamese-food", name: { vi: "Món ăn Việt Nam", en: "Vietnamese Food" }, tagline: { vi: "Hương vị quen thuộc, được nhớ lại trên giấy.", en: "Familiar flavours, remembered in paper." }, intro: { vi: "Những món ăn gắn với ký ức, được vẽ lại thành sổ tay và postcard.", en: "Dishes tied to memory, illustrated as notebooks and postcards." }, image: vietnameseFoodImg },
  { id: "motivation", slug: "motivation", name: { vi: "Sổ tay tạo động lực", en: "Motivation" }, tagline: { vi: "Những lời nhắc nhỏ cho ngày bình thường.", en: "Small reminders for ordinary days." }, intro: { vi: "Sổ tay với những lời nhắn nhẹ nhàng, đồng hành cùng bạn mỗi ngày.", en: "Notebooks carrying gentle messages, for every ordinary day." } },
  { id: "ao-dai", slug: "ao-dai", name: { vi: "Áo dài", en: "Ao Dai" }, tagline: { vi: "Nét thanh lịch Việt, tái hiện trên giấy.", en: "Vietnamese elegance, reimagined in paper." }, intro: { vi: "Tà áo dài qua nét vẽ mềm mại trên thiệp và postcard.", en: "The ao dai in soft illustration, on cards and postcards." }, image: aoDaiImg },
  { id: "greeting-cards", slug: "greeting-cards", name: { vi: "Thiệp chúc mừng", en: "Greeting Cards" }, tagline: { vi: "Lời chúc cho những khoảnh khắc ý nghĩa.", en: "Words for the moments that matter." }, intro: { vi: "Sinh nhật, cảm ơn, chúc mừng — những dịp để nói điều mình nghĩ.", en: "Birthdays, thank-yous and celebrations — moments to say what you mean." } },
  { id: "animals", slug: "animals", name: { vi: "Thiệp Animal", en: "Animals" }, tagline: { vi: "Những nhân vật nhỏ với cá tính lớn.", en: "Little characters with big personalities." }, intro: { vi: "Những người bạn nhỏ đáng yêu trên thiệp.", en: "Lovable little friends on paper." } },
  { id: "spiral-cards", slug: "spiral-cards", name: { vi: "Thiệp xoắn", en: "Spiral Cards" }, tagline: { vi: "Tấm thiệp mở ra một bất ngờ nhỏ.", en: "Paper that unfolds into a little surprise." }, intro: { vi: "Thiệp xoắn mở ra thành một hình ảnh bất ngờ.", en: "Cards that unfold into a little surprise." } },
];

let order = 0;
function p(
  slug: string,
  vi: string,
  en: string,
  productType: ProductTypeId,
  collection: CollectionId,
  featured = false,
): Product {
  order += 1;
  return {
    id: slug,
    slug,
    name: { vi, en },
    productType,
    collection,
    description: {
      vi: "Mô tả sản phẩm đang được cập nhật.",
      en: "Product description coming soon.",
    },
    images: [],
    featured,
    sortOrder: order,
    status: "published",
  };
}

export const products: Product[] = [
  p("saigon-notebook", "Sài Gòn", "Saigon", "notebook", "explore-vietnam", true),
  p("hoi-an-notebook", "Hội An", "Hoi An", "notebook", "explore-vietnam"),
  p("ha-long-postcard", "Hạ Long", "Ha Long", "postcard", "explore-vietnam"),
  p("hanoi-magnet", "Hà Nội", "Hanoi", "magnet", "explore-vietnam", true),
  p("pho-postcard", "Phở", "Pho", "postcard", "vietnamese-food", true),
  p("banh-mi-postcard", "Bánh mì", "Banh Mi", "postcard", "vietnamese-food"),
  p("ca-phe-notebook", "Cà phê sữa đá", "Vietnamese Coffee", "notebook", "vietnamese-food"),
  p("good-day-notebook", "Ngày tốt lành", "Good Day", "notebook", "motivation"),
  p("small-steps-notebook", "Từng bước nhỏ", "Small Steps", "notebook", "motivation"),
  p("ao-dai-card", "Áo dài hồng", "Pink Ao Dai", "greeting-card", "ao-dai", true),
  p("ao-dai-letter-paper", "Áo dài", "Ao Dai", "letter-paper", "ao-dai"),
  p("happy-birthday-card", "Happy Birthday", "Happy Birthday", "greeting-card", "greeting-cards", true),
  p("thank-you-card", "Cảm ơn", "Thank You", "greeting-card", "greeting-cards"),
  p("kraft-envelope", "Bao thư kraft", "Kraft Envelope", "envelope", "greeting-cards"),
  p("cat-card", "Mèo nhỏ", "Little Cat", "greeting-card", "animals"),
  p("bear-card", "Gấu con", "Little Bear", "greeting-card", "animals"),
  p("spiral-flower-card", "Thiệp xoắn hoa", "Flower Spiral", "greeting-card", "spiral-cards"),
];

// ---------- helpers ----------
export const tx = (l: Localized) => l.vi; // VI is the active language; EN content is ready.

const live = () => products.filter((x) => x.status === "published").sort((a, b) => a.sortOrder - b.sortOrder);

export const getProductType = (id: ProductTypeId) => productTypes.find((t) => t.id === id)!;
export const getProductTypeBySlug = (slug: string) => productTypes.find((t) => t.slug === slug);
export const getCollection = (id: CollectionId) => collections.find((c) => c.id === id)!;
export const getCollectionBySlug = (slug: string) => collections.find((c) => c.slug === slug);
export const getProduct = (slug: string) => live().find((x) => x.slug === slug);
export const getAllProducts = live;
export const productsByType = (id: ProductTypeId) => live().filter((x) => x.productType === id);
export const productsByCollection = (id: CollectionId) => live().filter((x) => x.collection === id);
export const relatedProducts = (prod: Product, n = 4) =>
  live().filter((x) => x.slug !== prod.slug && x.collection === prod.collection).concat(
    live().filter((x) => x.slug !== prod.slug && x.collection !== prod.collection && x.productType === prod.productType),
  ).slice(0, n);
