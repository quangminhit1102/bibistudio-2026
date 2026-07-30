export type Product = {
  handle: string;
  name: string;
  img: string;
  price: string;
  old: string | null;
  badge: string | null;
};

export type Section = { title: string; slug: string; blurb?: string; products: Product[] };

export const sections: Section[] = [
  {
    title: "New Arrival",
    slug: "new-arrival",
    blurb: "Sản phẩm mới được cập nhật mỗi tháng với nhiều ưu đãi và quà tặng hấp dẫn.",
    products: [
      { handle: "tap-may-chi-b5-giay-kem-80gsm-200-trang", name: "Tập may chỉ B5 giấy kem 80gsm 200 trang", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/tap-b5-200tr-01-1783566246708.jpg", price: "61.200₫", old: "68.000₫", badge: "New" },
      { handle: "tap-b5-lo-xo-nhua-80-trang", name: "Tập B5 gáy còng nhựa - 80 trang", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-cover-1783052835923.jpg", price: "18.000₫", old: "20.000₫", badge: "New" },
      { handle: "combo-4c-tap-b5-cong-nhua-fresh-day-ruled", name: "Combo 4 cuốn FRESH DAY - Ruled - tập B5 còng nhựa", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/freshday-ke-ngang-1783676913337.jpg", price: "63.000₫", old: "70.000₫", badge: "New" },
      { handle: "combo-4c-tap-b5-cong-nhua-botanical-squaregrid", name: "Combo 4 cuốn BOTANICAL - Squaregrid - tập B5 còng nhựa", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/botanical-caro-1783676828329.jpg", price: "63.000₫", old: "70.000₫", badge: "New" },
      { handle: "combo-4c-tap-b5-cong-nhua-cake-ruled", name: "Combo 4 cuốn CAKE - Ruled - tập B5 còng nhựa", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cake-ke-ngang-1783676885394.jpg", price: "63.000₫", old: "70.000₫", badge: "New" },
      { handle: "combo-4c-tap-b5-cong-nhua-fresh-day-squaregrid", name: "Combo 4 cuốn FRESH DAY - Squaregrid - tập B5 còng nhựa", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/freshday-caro-1783676898440.jpg", price: "63.000₫", old: "70.000₫", badge: "New" },
      { handle: "combo-4c-tap-b5-cong-nhua-botanical-ruled", name: "Combo 4 cuốn BOTANICAL - Ruled- tập B5 còng nhựa", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/botanical-ke-ngang-1783676844886.jpg", price: "63.000₫", old: "70.000₫", badge: "New" },
      { handle: "combo-4c-tap-b5-cong-nhua-cake-squaregrid", name: "Combo 4 cuốn CAKE - Squaregrid - tập B5 còng nhựa", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cake-caro-1783676859983.jpg", price: "63.000₫", old: "70.000₫", badge: "New" },
    ],
  },
  {
    title: "COLLECTION NOTEBOOK",
    slug: "collection-notebook",
    products: [
      { handle: "vintage-asthetic-so-tay-vuong-ruot-kraft-dot", name: "Vintage Aesthetic", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cover-2-1783053394132.jpg", price: "72.000₫", old: "80.000₫", badge: "Sale" },
      { handle: "ghibli-collection", name: "Ghibli collection", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1775745545851.jpg", price: "87.300₫", old: "97.000₫", badge: "Sale" },
      { handle: "cloudy-collection", name: "Cloudy collection", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cloudy-new-01-1735485976842.jpg", price: "94.500₫", old: "105.000₫", badge: "Sale" },
      { handle: "so-mau-doc-quyen-a5", name: "Sổ mẫu độc quyền A5", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cozy-01-1784884934764.jpg", price: "56.700₫", old: "63.000₫", badge: "Sale" },
      { handle: "flower-collection", name: "Flora collection", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cover-1783052360427.jpg", price: "94.500₫", old: "105.000₫", badge: "Sale" },
    ],
  },
  {
    title: "SCRAPBOOK & DIY",
    slug: "scrapbook-diy",
    products: [
      { handle: "so-dan-anh-kho-vuong", name: "Sổ dán ảnh - khổ vuông", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/sda-2024-1740129923219.jpg", price: "123.300₫", old: "137.000₫", badge: "Sale" },
      { handle: "so-dan-anh-zigzag", name: "Sổ dán ảnh ZIGZAG", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1777346916253.jpg", price: "54.000₫", old: "60.000₫", badge: "Sale" },
      { handle: "set-16-hinh-polaroid-in-theo-yeu-cau", name: "Set 16 hình Polaroid in theo yêu cầu", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/polaroid-2-1700490050398.jpg", price: "43.200₫", old: "48.000₫", badge: "Sale" },
      { handle: "combo-phu-kien-trang-tri-so-tay", name: "Combo phụ kiện", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-b3d1b2ec-9a3c-44aa-a287-4da8cc4b29f7.jpg", price: "92.700₫", old: "103.000₫", badge: "Sale" },
      { handle: "hop-qua-handmade-vintage", name: "Hộp quà Handmade Vintage", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/box-rose0-1784028538291.jpg", price: "48.600₫", old: "54.000₫", badge: "Sale" },
      { handle: "so-dan-anh-giay-my-thuat-250gsm-kho-a5-50-trang-thiet-ke-toi-gian", name: "Sổ dán ảnh A5", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/sda-basic-a5-1-1741154320992.jpg", price: "63.900₫", old: "71.000₫", badge: "Sale" },
      { handle: "sticker-dang-to-a6-nhieu-mau-set-3-to", name: "Sticker dạng tờ A6 nhiều mẫu - set 3 tờ", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/sticker-a6-set-3-to-01-1784714735347.jpg", price: "36.000₫", old: "40.000₫", badge: "Sale" },
      { handle: "washitape-pad-bang-keo-giay-dang-tep", name: "Washitape Pad - Băng keo giấy dạng tệp", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/washitape-pad-01-1784864322881.jpg", price: "45.000₫", old: "50.000₫", badge: "Sale" },
      { handle: "sticker-die-cut-nhieu-mau", name: "Sticker cắt rời nhiều mẫu", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/sticker-roi-02-1784716571112.jpg", price: "36.000₫", old: "40.000₫", badge: "Sale" },
      { handle: "sticker-con-tem-32x45mm", name: "Sticker con tem 32x45mm", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1784969829082.jpg", price: "21.600₫", old: "24.000₫", badge: "Sale" },
      { handle: "sticker-chu-so-set-5-cai", name: "Sticker chữ số - set 5 cái", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/alphabet-number-1-1784105523743.jpg", price: "31.500₫", old: "35.000₫", badge: "Sale" },
      { handle: "postcard", name: "Postcard", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/postcard0-1-1732005462477.jpg", price: "23.400₫", old: "26.000₫", badge: "Sale" },
      { handle: "washitape-le-cuon", name: "Washitape - lẻ cuộn", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/washitape-lecuon-0-1681526430657.jpg", price: "13.500₫", old: "15.000₫", badge: "Sale" },
      { handle: "sticker-in-theo-yeu-cau", name: "sticker in theo yêu cầu", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/sticker-tyc.jpg", price: "27.000₫", old: "30.000₫", badge: "Sale" },
      { handle: "giay-nen-nhieu-mau-16-to-100x140mm", name: "Giấy nền nhiều mẫu 16 tờ - 100x140mm", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/giay-nen-01-1785300162425.jpg", price: "15.300₫", old: "17.000₫", badge: "Sale" },
      { handle: "bao-thu-handmade", name: "Bao thư handmade", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/bao-thu-handmade-1-1783951184300.jpg", price: "45.000₫", old: "50.000₫", badge: "Sale" },
      { handle: "but-gelly-roll-08", name: "Bút Gelly Roll 10", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1755164700719.jpg", price: "31.500₫", old: "35.000₫", badge: "Sale" },
      { handle: "bao-thu-anh-kim-kem-ruot-thu", name: "Bao thư cao cấp ánh kim, kèm ruột thư", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/bao-thu-anh-kim-01-1784541230665.jpg", price: "39.600₫", old: "44.000₫", badge: "Sale" },
      { handle: "bao-thu-giay-my-thuat-cao-cap", name: "Bao thư giấy mỹ thuật xấp 5 cái", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/bao-thu-1-2-1766131291048.jpg", price: "21.600₫", old: "24.000₫", badge: "Sale" },
      { handle: "combo-3-xap-giay-viet-thu-floral", name: "Combo 3 xấp giấy viết thư - Floral", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/giay-viet-thu-floral-3-xap.jpg", price: "49.500₫", old: "55.000₫", badge: "Sale" },
      { handle: "combo-3-xap-giay-viet-thu-butterfly", name: "Combo 3 xấp giấy viết thư - Butterfly", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/giay-viet-thu-butterfly-3-xap.jpg", price: "49.500₫", old: "55.000₫", badge: "Sale" },
      { handle: "combo-3-xap-giay-viet-thu-chuon-chuon-nau", name: "Combo 3 xấp giấy viết thư - Chuồn chuồn nâu", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/giay-viet-thu-chuon-chuon-nau-3-xap.jpg", price: "49.500₫", old: "55.000₫", badge: "Sale" },
      { handle: "mau-nuoc-dang-nen-solid-deli", name: "Màu nước dạng nén Solid DELI - Kèm cọ nước và bông mút", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/untitled-1-01-1776764733694.jpg", price: "162.000₫", old: "180.000₫", badge: "Sale" },
      { handle: "but-son-mau-acrylic-maker-deli-dang-roller", name: "Bút sơn màu Acrylic Maker DELI dạng Roller cao cấp", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/untitled-1-01-1776764498392.jpg", price: "405.000₫", old: "450.000₫", badge: "Sale" },
      { handle: "ho-kho-keo-dan-giay-pastel-deli", name: "Hồ khô DELI - keo dán giấy Pastel", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-01-1776764226274.jpg", price: "22.500₫", old: "25.000₫", badge: "Sale" },
      { handle: "but-chi-mau-goc-dau-goc-nuoc-hop-thiec", name: "Bút chì màu DELI hộp thiếc", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/7-1776766135653.jpg", price: "189.000₫", old: "210.000₫", badge: "Sale" },
      { handle: "but-koi-coloring-brush-pen", name: "Bút Koi Coloring Brush", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/yellow-1773303294635.jpg", price: "43.200₫", old: "48.000₫", badge: "Sale" },
    ],
  },
  {
    title: "BÚT, PHỤ KIỆN",
    slug: "but-phu-kien",
    products: [
      { handle: "but-muji-chinh-hang", name: "Bút MUJI nắp gài", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1750843456075.jpg", price: "36.900₫", old: "41.000₫", badge: "Sale" },
      { handle: "but-gel-zebra-sarasa-clip-ngoi-0-5mm", name: "Bút gel ZEBRA SARASA CLIP ngòi 0.5mm", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1753543441797.jpg", price: "33.300₫", old: "37.000₫", badge: "Sale" },
      { handle: "but-zebra-sarasa-vintage-nhieu-mau", name: "Bút gel nhiều màu ZEBRA SARASA VINTAGE ngòi 0.5mm", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-2-1746014452420.jpg", price: "41.400₫", old: "46.000₫", badge: "Sale" },
      { handle: "but-gelly-roll-08", name: "Bút Gelly Roll 10", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1755164700719.jpg", price: "31.500₫", old: "35.000₫", badge: "Sale" },
      { handle: "zebra-midliner-2-dau", name: "Bút dạ quang Zebra Mildliner 2 đầu, Bold & Fine", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/mildliner-11-1784262931578.jpg", price: "45.000₫", old: "50.000₫", badge: "Sale" },
      { handle: "but-gel-hoshi-thien-long", name: "Bút gel Hoshi Thiên Long", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1748007031841.jpg", price: "72.900₫", old: "81.000₫", badge: "Sale" },
      { handle: "combo-8-bookmark", name: "Combo 8 Bookmark nhiều chủ đề - 5x14cm", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/01.jpg", price: "31.500₫", old: "35.000₫", badge: "Sale" },
      { handle: "but-chi-pensile", name: "Bút chì PENSILE", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/chi-pensile-1-1728448701623.jpg", price: "9.000₫", old: "10.000₫", badge: "Sale" },
      { handle: "chi-va-gom-deli", name: "Chì gỗ DELI", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/but-chi-deli-1-1716039832364.jpg", price: "16.200₫", old: "18.000₫", badge: "Sale" },
      { handle: "chinh-hang-marvy-but-gel-marvy-uchida-920-ngoi-1mm-muc-gel-trang-bac-vang-dong-muc-ra-deu-va-khong-bi-tat-muc", name: "Bút Gel Marvy Uchida 920 - Ngòi 1mm", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/gel-1mm-1-1700043905898.jpg", price: "19.800₫", old: "22.000₫", badge: "Sale" },
      { handle: "chinh-hang-marvy-uchida-but-da-quang-but-highlight-55-6-mau-pastel-de-su-dung-mau-sac-dep-tuoi-sang", name: "Bút dạ quang Hightlighter Marvy Uchida", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/hightlighter-1-1700044101105.jpg", price: "19.800₫", old: "22.000₫", badge: "Sale" },
      { handle: "chinh-hang-but-line-di-net-marvy-uchida-4600-nhieu-ngoi-muc-pigment-khong-troi-khong-tham-nuoc", name: "Bút Line Đi Nét For Drawing - Marvy Uchida 4600", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/for-drawing-1-1700044427063.jpg", price: "31.500₫", old: "35.000₫", badge: "Sale" },
      { handle: "but-gel-deli-a130-muc-sieu-nhanh-kho-ngoi-0-35mm-sthm-stationery", name: "Bút gel Deli nhiều mẫu", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/deli-1-1754667008928.jpg", price: "29.700₫", old: "33.000₫", badge: "Sale" },
      { handle: "mark-sticker-sticker-quan-ly-cong-viec-trang-tri-so-hieu-qua-sthm-stationery", name: "Mark sticker", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/12e21a9a-90c0-489f-94dd-ace92c81385f-1697168695773.jpg", price: "17.100₫", old: "19.000₫", badge: "Sale" },
      { handle: "but-baoke-tap-viet-calligraphy", name: "Bút cọ Brush DELI viết Calligraphy, Hán tự", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/deli-brush-1-1754750139383.jpg", price: "16.200₫", old: "18.000₫", badge: "Sale" },
      { handle: "combo-phu-kien-trang-tri-so-tay", name: "Combo phụ kiện", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-b3d1b2ec-9a3c-44aa-a287-4da8cc4b29f7.jpg", price: "92.700₫", old: "103.000₫", badge: "Sale" },
      { handle: "but-chi-bam-kaco-rocket-ngoi-0-5mm", name: "Bút chì kim và hộp ngòi DELI - ngòi 0.5mm", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/7-1777285284294.jpg", price: "18.000₫", old: "20.000₫", badge: "Sale" },
      { handle: "kaco-rocket-basic", name: "Kacogreen lẻ cây", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/kaco-le-cay-1701252297057.jpg", price: "18.000₫", old: "20.000₫", badge: "Sale" },
      { handle: "postcard", name: "Postcard", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/postcard0-1-1732005462477.jpg", price: "23.400₫", old: "26.000₫", badge: "Sale" },
      { handle: "notepad-mini-nhieu-loai-8x8cm", name: "Notepad mini nhiều loại - 8x8cm", img: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/51c37cf0-a541-45c7-abb3-9f9e2aeb3479.jpg", price: "14.400₫", old: "16.000₫", badge: "Sale" },
    ],
  },
];
