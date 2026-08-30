// Re-export types from the centralized types module for backwards compatibility.
// Consumers can import from either "@/data/catalog" or "@/data/types".
export type { Category, ProductDetail } from "./types";
import type { Category, ProductDetail, Product } from "./types";
import { sections } from "./products";

const cdn = "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/";

export const categories: Category[] = [
  {
    slug: "back-to-school",
    title: "BACK TO SCHOOL",
    blurb: "Tập vở, giấy bao tập, nhãn vở, bút viết và phụ kiện học tập cho mùa tựu trường mới.",
    tiles: [
      {
        title: "Notebook",
        slug: "collection-notebook",
        img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/col1.jpg",
      },
      {
        title: "Scrapbook & DIY",
        slug: "scrapbook-diy",
        img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/col2.jpg",
      },
      {
        title: "BÚT, PHỤ KIỆN",
        slug: "but-phu-kien",
        img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/col3.jpg",
      },
      {
        title: "Collection Notebook",
        slug: "collection-notebook",
        img: "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/col4.jpg",
      },
    ],
    products: [
      {
        handle: "tap-may-chi-b5-giay-kem-80gsm-200-trang",
        name: "Tập may chỉ B5 giấy kem 80gsm 200 trang",
        img: `${cdn}tap-b5-200tr-01-1783566246708.jpg`,
        price: "61.200₫",
        old: "68.000₫",
        badge: "New",
      },
      {
        handle: "tap-b5-lo-xo-nhua-80-trang",
        name: "Tập B5 gáy còng nhựa - 80 trang",
        img: `${cdn}1-cover-1783052835923.jpg`,
        price: "18.000₫",
        old: "20.000₫",
        badge: "New",
      },
      {
        handle: "giay-bao-tap-a5-caro-sthm-stationery",
        name: "Giấy bao tập A5 - Caro",
        img: `${cdn}gbt-cover1-1784868421838.jpg`,
        price: "16.200₫",
        old: "18.000₫",
        badge: "Sale",
      },
      {
        handle: "tap-vo-a5",
        name: "Combo 8 cuốn Tập vở A5 - Ruột ô ly giản lược",
        img: `${cdn}tap-vo-a5-1-1687920305272.jpg`,
        price: "108.000₫",
        old: "120.000₫",
        badge: "New",
      },
      {
        handle: "sthm-stationery-set-32-nhan-vo-basic-7-2x3-6cm",
        name: "Set 32 nhãn vở basic - 7.2x3.6cm",
        img: `${cdn}1-1753533718896.jpg`,
        price: "19.800₫",
        old: "22.000₫",
        badge: "Sale",
      },
      {
        handle: "giay-bao-tap-a5-flower-sthm-stationery",
        name: "Giấy bao tập A5 - Flower, Leaf",
        img: `${cdn}2-1753713579300.jpg`,
        price: "16.200₫",
        old: "18.000₫",
        badge: "Sale",
      },
      {
        handle: "giay-bao-tap-a5-sthm-stationery",
        name: "Giấy bao tập A5 - Fruits",
        img: `${cdn}gbt-a5-fruits-1687485712258.jpg`,
        price: "16.200₫",
        old: "18.000₫",
        badge: "Sale",
      },
      {
        handle: "giay-bao-tap-a5-cake-sthm-stationery",
        name: "Giấy bao tập A5 - Cake",
        img: `${cdn}gbt-a5-cake-1687484662677.jpg`,
        price: "16.200₫",
        old: "18.000₫",
        badge: "Sale",
      },
      {
        handle: "chi-va-gom-deli",
        name: "Chì gỗ DELI",
        img: `${cdn}but-chi-deli-1-1716039832364.jpg`,
        price: "16.200₫",
        old: "18.000₫",
        badge: "Sale",
      },
      {
        handle: "but-chi-bam-marvy-uchida-fl200",
        name: "Bút Chì Bấm Marvy Uchida FL200 Ngòi dẹp 2mm",
        img: `${cdn}but-chi-fl200-1700044301812.jpg`,
        price: "46.800₫",
        old: "52.000₫",
        badge: "Sale",
      },
      {
        handle:
          "chinh-hang-marvy-uchida-but-da-quang-but-highlight-55-6-mau-pastel-de-su-dung-mau-sac-dep-tuoi-sang",
        name: "Bút dạ quang Hightlighter Marvy Uchida",
        img: `${cdn}hightlighter-1-1700044101105.jpg`,
        price: "19.800₫",
        old: "22.000₫",
        badge: "Sale",
      },
      {
        handle: "but-gel-deli-a130-muc-sieu-nhanh-kho-ngoi-0-35mm-sthm-stationery",
        name: "Bút gel Deli nhiều mẫu",
        img: `${cdn}deli-1-1754667008928.jpg`,
        price: "29.700₫",
        old: "33.000₫",
        badge: "Sale",
      },
      {
        handle: "but-muji-chinh-hang",
        name: "Bút MUJI nắp gài",
        img: `${cdn}1-1750843456075.jpg`,
        price: "36.900₫",
        old: "41.000₫",
        badge: "Sale",
      },
      {
        handle: "but-baoke-tap-viet-calligraphy",
        name: "Bút cọ Brush DELI viết Calligraphy, Hán tự",
        img: `${cdn}deli-brush-1-1754750139383.jpg`,
        price: "16.200₫",
        old: "18.000₫",
        badge: "Sale",
      },
      {
        handle: "but-chi-bam-kaco-rocket-ngoi-0-5mm",
        name: "Bút chì kim và hộp ngòi DELI - ngòi 0.5mm",
        img: `${cdn}7-1777285284294.jpg`,
        price: "18.000₫",
        old: "20.000₫",
        badge: "Sale",
      },
      {
        handle: "kaco-rocket-basic",
        name: "Kacogreen lẻ cây",
        img: `${cdn}kaco-le-cay-1701252297057.jpg`,
        price: "18.000₫",
        old: "20.000₫",
        badge: "Sale",
      },
      {
        handle: "zebra-midliner-2-dau",
        name: "Bút dạ quang Zebra Mildliner 2 đầu, Bold & Fine",
        img: `${cdn}mildliner-11-1784262931578.jpg`,
        price: "45.000₫",
        old: "50.000₫",
        badge: "Sale",
      },
      {
        handle: "but-gel-hoshi-thien-long",
        name: "Bút gel Hoshi Thiên Long",
        img: `${cdn}but-gel-hoshi-tl-01-1785855300695.jpg`,
        price: "72.900₫",
        old: "81.000₫",
        badge: "Sale",
      },
      {
        handle: "but-zebra-sarasa-vintage-nhieu-mau",
        name: "Bút gel nhiều màu ZEBRA SARASA VINTAGE ngòi 0.5mm",
        img: `${cdn}1-2-1746014452420.jpg`,
        price: "41.400₫",
        old: "46.000₫",
        badge: "Sale",
      },
      {
        handle: "but-gel-zebra-sarasa-clip-ngoi-0-5mm",
        name: "Bút gel ZEBRA SARASA CLIP ngòi 0.5mm",
        img: `${cdn}1-1753543441797.jpg`,
        price: "33.300₫",
        old: "37.000₫",
        badge: "Sale",
      },
    ],
  },
  ...sections.map((s): Category => ({
    slug: s.slug,
    title: s.title.toUpperCase(),
    blurb: s.blurb,
    tiles: [],
    products: s.products,
  })),
];

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug);
}

const pcdn = "https://bizweb.dktcdn.net/thumb/1024x1024/100/343/063/products/";

export const productDetails: ProductDetail[] = [
  {
    handle: "tap-may-chi-b5-giay-kem-80gsm-200-trang",
    name: "Tập may chỉ B5 giấy kem 80gsm 200 trang",
    price: "61.200₫",
    old: "68.000₫",
    discount: "-10%",
    stock: "Còn hàng",
    sku: "TAP-B5-200TR",
    vendor: "BiBi Studio",
    images: [
      `${pcdn}tap-b5-200tr-01-1783566246708.jpg`,
      `${pcdn}tap-b5-200tr-02-1783566248649.jpg`,
      `${pcdn}tap-b5-200tr-03-1783566250564.jpg`,
      `${pcdn}tap-b5-200tr-04-1783566253732.jpg`,
      `${pcdn}tap-b5-200tr-05-1783566256781.jpg`,
      `${pcdn}tap-b5-200tr-06-1783566259667.jpg`,
      `${pcdn}tap-b5-200tr-07-1783566263783.jpg`,
      `${pcdn}tap-b5-200tr-08-1783566266999.jpg`,
      `${pcdn}tap-b5-200tr-09-1783566270122.jpg`,
      `${pcdn}tap-b5-200tr-010-1783566273018.jpg`,
      `${pcdn}tap-b5-200tr-011-1783566275905.jpg`,
      `${pcdn}tap-b5-200tr-012-1783566279275.jpg`,
    ],
    options: [
      {
        label: "Mẫu bìa",
        values: [
          "Ghibli 01",
          "Ghibli 02",
          "Ghibli 03",
          "Ghibli 04",
          "Ghibli 05",
          "Ghibli 06",
          "Ghibli 07",
          "Ghibli 08",
        ],
      },
      { label: "Ruột", values: ["Ruled", "Squaregrid"] },
    ],
    description: [
      "Khơi nguồn cảm hứng học tập và làm việc mỗi ngày với dòng tập may chỉ B5 cao cấp. Không chỉ là một vật dụng ghi chép thông thường, cuốn sổ còn là một tác phẩm nghệ thuật thu nhỏ với phong cách anime đậm chất mộng mơ, kết hợp cùng chất lượng gia công tỉ mỉ mang đến trải nghiệm viết hoàn hảo nhất.",
    ],
    highlights: [
      "Thiết kế nghệ thuật & cao cấp: bìa sổ với các bức tranh phong cảnh mang âm hưởng Ghibli được vẽ độc quyền; phần gáy bọc vải gia công chắc chắn.",
      "Chất giấy 80gsm chống lem tuyệt đối: ruột giấy màu kem dịu mắt, dùng tốt cả với bút cọ gốc nước và bút dạ quang.",
      "Trải nghiệm viết tối ưu: kỹ thuật may chỉ giúp sổ mở phẳng 180 độ, không cấn tay ở phần gáy.",
      "Gia công tỉ mỉ, chống cong vênh: các góc sổ được bo tròn tinh tế, bảo vệ mép giấy.",
      "Dung lượng lớn: 200 trang cho không gian ghi chép rộng rãi.",
      "Đa dạng tùy chọn ruột: Ruled (kẻ dòng) và Squaregrid (caro).",
    ],
  },
];

export function getProductDetail(handle: string) {
  return productDetails.find((p) => p.handle === handle);
}

export const allProducts: Product[] = categories.flatMap((c) => c.products);

export function findProduct(handle: string) {
  return allProducts.find((p) => p.handle === handle);
}

export function relatedProducts(handle: string, count = 6) {
  const seen = new Set<string>();
  return allProducts
    .filter((p) => p.handle !== handle && !seen.has(p.handle) && seen.add(p.handle))
    .slice(0, count);
}
