// src/data/catalogue.ts
import motivationMainAsset from "@/assets/catalogue/motivation-notebooks-main.jpeg.asset.json";
import motivationLaughingAsset from "@/assets/catalogue/motivation-life-laughing.jpeg.asset.json";
import motivationDreamAsset from "@/assets/catalogue/motivation-dream-big.jpeg.asset.json";
import motivationHappyAsset from "@/assets/catalogue/motivation-choose-happy.jpeg.asset.json";
import motivationEarthAsset from "@/assets/catalogue/motivation-trai-dat-tron.jpeg.asset.json";
import motivationEnjoyTodayAsset from "@/assets/catalogue/motivation-enjoy-today.jpeg.asset.json";
import motivationSunWillRiseAsset from "@/assets/catalogue/motivation-sun-will-rise.jpeg.asset.json";
import motivationWalkFlyAsset from "@/assets/catalogue/motivation-walk-fly.jpeg.asset.json";
import motivationBeHappyAsset from "@/assets/catalogue/motivation-be-happy.jpeg.asset.json";
import motivationDoWhatYouLoveAsset from "@/assets/catalogue/motivation-do-what-you-love.jpeg.asset.json";
import motivationYoureBeautifulAsset from "@/assets/catalogue/motivation-youre-beautiful.jpeg.asset.json";
import motivationDoWhatYouLoveColourAsset from "@/assets/catalogue/motivation-do-what-you-love-colour.jpeg.asset.json";
import motivationLoveYourselfAsset from "@/assets/catalogue/motivation-love-yourself.jpeg.asset.json";
import motivationLifeIsTooShortAsset from "@/assets/catalogue/motivation-life-is-too-short.jpeg.asset.json";
import motivationCaPheNguoiThuongAsset from "@/assets/catalogue/motivation-ca-phe-nguoi-thuong.jpeg.asset.json";
import pressedFlowerMainAsset from "@/assets/catalogue/pressed-flower-cards-main.jpg.asset.json";

// BiBi Studio catalogue: product TYPES (what it is) and COLLECTIONS (what story it belongs to)
// are separate dimensions. Products reference one of each.
// STARTER DATA: product names below are placeholders to be replaced with the real BiBi range.
// Optional attributes (dimensions, material, pages, format) are only shown when filled in.

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
  | "pressed-flower-cards"
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
  { id: "notebook", slug: "notebooks", name: { vi: "Sổ tay", en: "Notebook" }, plural: { vi: "Sổ tay", en: "Notebooks" }, tagline: { vi: "Những khoảng giấy nhỏ cho suy nghĩ lớn.", en: "Small spaces for big thoughts." }, image: "/catalogue/collection-notebooks.webp" },
  { id: "greeting-card", slug: "greeting-cards", name: { vi: "Thiệp", en: "Greeting Card" }, plural: { vi: "Thiệp", en: "Greeting Cards" }, tagline: { vi: "Lời muốn nói, gửi trong một tấm thiệp.", en: "Words you want to say, folded in paper." }, image: "/catalogue/collection-ao-dai.webp" },
  { id: "postcard", slug: "postcards", name: { vi: "Postcard", en: "Postcard" }, plural: { vi: "Postcard", en: "Postcards" }, tagline: { vi: "Một khung hình nhỏ để gửi đi xa.", en: "A small picture to send far away." }, image: "/catalogue/collection-explore-vietnam.webp" },
  { id: "envelope", slug: "envelopes", name: { vi: "Bao thư", en: "Envelope" }, plural: { vi: "Bao thư", en: "Envelopes" }, tagline: { vi: "Giữ trọn lời nhắn bên trong.", en: "Keeping a message safe inside." } },
  { id: "letter-paper", slug: "letter-paper", name: { vi: "Giấy viết thư", en: "Letter Paper" }, plural: { vi: "Giấy viết thư", en: "Letter Paper" }, tagline: { vi: "Cho những lá thư viết tay.", en: "For letters written by hand." } },
  { id: "magnet", slug: "magnets", name: { vi: "Magnet", en: "Magnet" }, plural: { vi: "Magnet", en: "Magnets" }, tagline: { vi: "Một mảnh ký ức trên cửa tủ lạnh.", en: "A little memory on the fridge door." }, image: "/catalogue/magnet-cau-rong.webp" },
];

export const collections: Collection[] = [
  { id: "explore-vietnam", slug: "explore-vietnam", name: { vi: "Khám phá Việt Nam", en: "Explore Vietnam" }, tagline: { vi: "Những miền đất, hương vị và câu chuyện thường ngày của Việt Nam.", en: "Places, flavours and everyday stories from Vietnam." }, intro: { vi: "Việt Nam qua lăng kính của giấy: phố cổ, mái ngói, dòng sông và nhịp sống thường ngày.", en: "Vietnam interpreted through paper goods: old streets, tiled roofs, rivers and everyday life." }, image: "/catalogue/collection-explore-vietnam.webp" },
  { id: "vietnamese-food", slug: "vietnamese-food", name: { vi: "Món ăn Việt Nam", en: "Vietnamese Food" }, tagline: { vi: "Hương vị quen thuộc, được nhớ lại trên giấy.", en: "Familiar flavours, remembered in paper." }, intro: { vi: "Những món ăn gắn với ký ức, được vẽ lại thành sổ tay và postcard.", en: "Dishes tied to memory, illustrated as notebooks and postcards." }, image: "/catalogue/collection-vietnamese-food.webp" },
  { id: "motivation", slug: "motivation", name: { vi: "Sổ tay tạo động lực", en: "Motivation" }, tagline: { vi: "Những lời nhắc nhỏ cho ngày bình thường.", en: "Small reminders for ordinary days." }, intro: { vi: "Từ một nụ cười, một giấc mơ đến niềm tin rằng mọi điều đều có thể — mỗi cuốn sổ là một lời nhắc dịu dàng để bạn tiếp tục viết, tiếp tục làm và tiếp tục vui sống.", en: "From a smile and a dream to the belief that anything is possible, each notebook is a gentle reminder to keep writing, doing and living with joy." }, image: motivationMainAsset.url },
  { id: "ao-dai", slug: "ao-dai", name: { vi: "Áo dài", en: "Ao Dai" }, tagline: { vi: "Nét thanh lịch Việt, tái hiện trên giấy.", en: "Vietnamese elegance, reimagined in paper." }, intro: { vi: "Tà áo dài qua nét vẽ mềm mại trên thiệp và postcard.", en: "The ao dai in soft illustration, on cards and postcards." }, image: "/catalogue/collection-ao-dai.webp" },
  { id: "greeting-cards", slug: "greeting-cards", name: { vi: "Thiệp chúc mừng", en: "Greeting Cards" }, tagline: { vi: "Lời chúc cho những khoảnh khắc ý nghĩa.", en: "Words for the moments that matter." }, intro: { vi: "Sinh nhật, cảm ơn, chúc mừng — những dịp để nói điều mình nghĩ.", en: "Birthdays, thank-yous and celebrations — moments to say what you mean." } },
  { id: "pressed-flower-cards", slug: "pressed-flower-cards", name: { vi: "Thiệp ép hoa khô", en: "Pressed Flower Cards" }, tagline: { vi: "Hoa thật được ép khô, dán từng cánh tay.", en: "Real dried flowers, pressed petal by petal." }, intro: { vi: "Hoa, lá khô được ép và dán lên nền giấy thủ công nhuộm màu, hoàn thiện bằng viền răng cưa kiểu thiệp xưa. Mỗi tấm thiệp là một cành hoa thật giữ được dáng đẹp theo năm tháng.", en: "Dried flowers and leaves are pressed and laid on hand-dyed craft paper, finished with a vintage scalloped edge. Each card keeps a real flower, beautiful for years." }, image: pressedFlowerMainAsset.url },
  { id: "spiral-cards", slug: "spiral-cards", name: { vi: "Thiệp xoắn", en: "Spiral Cards" }, tagline: { vi: "Tấm thiệp mở ra một bất ngờ nhỏ.", en: "Paper that unfolds into a little surprise." }, intro: { vi: "Thiệp xoắn mở ra thành một hình ảnh bất ngờ.", en: "Cards that unfold into a little surprise." } },
];

let order = 0;
function p(
  slug: string,
  vi: string,
  en: string,
  productType: ProductTypeId,
  collection: CollectionId,
  descriptionVi: string,
  descriptionEn: string,
  images: string[],
  featured = false,
): Product {
  order += 1;
  return {
    id: slug,
    slug,
    name: { vi, en },
    productType,
    collection,
    description: { vi: descriptionVi, en: descriptionEn },
    images,
    imageAlt: { vi: `${vi} — sản phẩm BiBi Studio`, en: `${en} — a BiBi Studio paper good` },
    featured,
    sortOrder: order,
    status: "published",
  };
}

export const products: Product[] = [
  p("bun-bo-hue-notebook", "Bún bò Huế", "Bun Bo Hue", "notebook", "vietnamese-food", "Một góc ẩm thực Huế được kể bằng nét vẽ dịu dàng: tô bún nóng, sắc rau xanh và những chi tiết thân quen. Mẫu sổ dành cho người yêu món Việt, thích ghi lại hành trình và những bữa ăn đáng nhớ.", "A gentle illustration of Hue's beloved noodle soup, fresh herbs and familiar table details. A notebook for food lovers, travellers and everyday memories.", ["/catalogue/notebook-bun-bo-hue.webp", "/catalogue/notebook-bun-bo-hue-detail.webp"], true),
  p("tra-da-via-he-notebook", "Trà đá vỉa hè", "Street Iced Tea", "notebook", "vietnamese-food", "Gợi nhớ chiếc bàn thấp, cốc trà mát và những cuộc chuyện trò không vội nơi góc phố. Một thiết kế gần gũi dành cho những ghi chép nhỏ trong ngày.", "A familiar street-side scene of iced tea and unhurried conversations. A warm, everyday cover for notes and passing thoughts.", ["/catalogue/notebook-tra-da.webp", "/catalogue/notebook-tra-da-detail.webp"]),
  p("bun-cha-ha-noi-notebook", "Bún chả Hà Nội", "Hanoi Bun Cha", "notebook", "vietnamese-food", "Hương vị Hà Nội hiện lên qua mẹt bún, rau xanh và bát nước chấm đậm đà. Mẫu sổ mang theo một ký ức ẩm thực bình dị mà khó quên.", "Hanoi appears through rice noodles, fresh herbs and a fragrant dipping bowl. A notebook carrying one of the city's most comforting food memories.", ["/catalogue/notebook-bun-cha.webp", "/catalogue/notebook-bun-cha-detail.webp"]),
  p("hu-tieu-go-notebook", "Hủ tiếu gõ", "Street Noodle Soup", "notebook", "vietnamese-food", "Chiếc xe hủ tiếu nhỏ là một dấu chấm thân thương trong nhịp đêm thành phố. Thiết kế lưu lại âm thanh, ánh sáng và vẻ đẹp mộc mạc của hàng quán ven đường.", "The humble noodle cart is a familiar mark in the city's evening rhythm. This cover remembers the sound, light and charm of Vietnamese street food.", ["/catalogue/notebook-hu-tieu.webp", "/catalogue/notebook-hu-tieu-detail.webp"]),
  p("banh-mi-notebook", "Bánh mì", "Banh Mi", "notebook", "vietnamese-food", "Ổ bánh mì giòn với lớp nhân đầy màu sắc trở thành một minh họa vui tươi, gọn gàng. Mẫu sổ nhỏ dành cho người luôn muốn mang một chút Việt Nam bên mình.", "A crisp banh mi and its colourful fillings become a cheerful, compact illustration. A notebook for carrying a little taste of Vietnam everywhere.", ["/catalogue/notebook-banh-mi.webp", "/catalogue/notebook-banh-mi-detail.webp"], true),
  p("banh-xeo-notebook", "Bánh xèo miền Tây", "Mekong Delta Banh Xeo", "notebook", "vietnamese-food", "Màu vàng ấm của bánh xèo bên rổ rau xanh gợi một bữa ăn miền Tây rộn ràng. Thiết kế dành cho những trang ghi chép đầy hương vị và niềm vui.", "Golden banh xeo beside fresh herbs recalls a lively Mekong Delta meal. A bright notebook for flavourful memories and joyful notes.", ["/catalogue/notebook-banh-xeo.webp", "/catalogue/notebook-banh-xeo-detail.webp"]),
  p("ca-phe-sua-da-notebook", "Cà phê sữa đá", "Vietnamese Iced Coffee", "notebook", "vietnamese-food", "Phin cà phê, ly đá và sắc nâu sữa quen thuộc tạo nên một khoảng dừng rất Việt Nam. Mẫu sổ hợp với những buổi sáng chậm và các ý tưởng cần được giữ lại.", "The coffee filter, ice and caramel tones create a distinctly Vietnamese pause. A notebook for slow mornings and ideas worth keeping.", ["/catalogue/notebook-ca-phe.webp", "/catalogue/notebook-ca-phe-detail.webp"], true),
  p("com-tam-notebook", "Cơm tấm", "Broken Rice", "notebook", "vietnamese-food", "Đĩa cơm tấm đủ đầy được minh họa bằng bảng màu nhẹ nhàng, gần gũi. Một lựa chọn vui cho người yêu Sài Gòn và những bữa cơm quen.", "A generous plate of broken rice is illustrated in a soft, familiar palette. A joyful choice for anyone who loves Saigon and its everyday meals.", ["/catalogue/notebook-com-tam.webp", "/catalogue/notebook-com-tam-detail.webp"]),
  p("goi-cuon-notebook", "Gỏi cuốn", "Fresh Spring Rolls", "notebook", "vietnamese-food", "Những cuốn gỏi trong trẻo, rau xanh và chén nước chấm tạo nên bìa sổ tươi mát. Thiết kế nhẹ nhàng cho công việc, học tập hoặc nhật ký mỗi ngày.", "Fresh rolls, green herbs and dipping sauce create a light, refreshing cover. A gentle companion for work, study or daily journaling.", ["/catalogue/notebook-goi-cuon.webp", "/catalogue/notebook-goi-cuon-detail.webp"]),
  p("da-nang-map-notebook", "Bản đồ Đà Nẵng", "Da Nang Map", "notebook", "explore-vietnam", "Đà Nẵng được thu nhỏ thành một bản đồ minh họa đầy nắng, biển và những dấu mốc thân quen. Mẫu sổ như một tấm bản đồ ký ức cho mỗi chuyến đi.", "Da Nang becomes an illustrated map of sunshine, sea and familiar landmarks. A notebook that feels like a memory map from the journey.", ["/catalogue/notebook-da-nang.webp", "/catalogue/notebook-da-nang-detail.webp"]),
  p("ha-giang-map-notebook", "Bản đồ Hà Giang", "Ha Giang Map", "notebook", "explore-vietnam", "Những cung đường, dãy núi và sắc màu vùng cao được gom vào một bìa sổ giàu chi tiết. Dành cho người thích đi xa và lưu lại từng chặng đường.", "Mountain roads and northern highland colours gather on a richly illustrated cover. Made for travellers who keep a record of every road.", ["/catalogue/notebook-ha-giang.webp", "/catalogue/notebook-ha-giang-detail.webp"]),
  p("sai-gon-map-notebook", "Bản đồ Sài Gòn", "Saigon Map", "notebook", "explore-vietnam", "Một Sài Gòn sống động với những biểu tượng quen thuộc được kể lại bằng nét vẽ đầy màu sắc. Mẫu sổ dành cho người thương thành phố và nhịp sống không ngừng.", "A lively Saigon of familiar icons, redrawn in vivid colour. A notebook for those who love the city and its ceaseless rhythm.", ["/catalogue/notebook-sai-gon-map.webp", "/catalogue/notebook-sai-gon-map-detail.webp"], true),
  p("landmark-81-notebook", "Bến Bạch Đằng & Landmark 81", "Bach Dang Wharf & Landmark 81", "notebook", "explore-vietnam", "Đường chân trời hiện đại bên dòng sông Sài Gòn được ghi lại trong gam màu hoàng hôn. Một góc thành phố mới mẻ để đồng hành cùng những kế hoạch mới.", "Saigon's modern skyline meets the river in sunset tones. A contemporary city view to accompany new plans and fresh pages.", ["/catalogue/notebook-landmark-81.webp"]),
  p("cho-ben-thanh-notebook", "Chợ Bến Thành", "Ben Thanh Market", "notebook", "explore-vietnam", "Mái ngói đỏ và tháp đồng hồ của Chợ Bến Thành trở thành điểm nhấn trên bìa sổ. Một hình ảnh Sài Gòn thân quen dành cho ghi chép và quà tặng.", "The red roof and clock tower of Ben Thanh Market anchor this illustrated cover. A familiar Saigon keepsake for notes or gifting.", ["/catalogue/notebook-cho-ben-thanh.webp"]),
  p("nha-hat-thanh-pho-notebook", "Nhà hát Thành phố", "Saigon Opera House", "notebook", "explore-vietnam", "Kiến trúc thanh lịch của Nhà hát Thành phố được đặt giữa sắc cây và ánh nắng Sài Gòn. Mẫu sổ mang nét cổ điển, nhẹ nhàng và giàu ký ức.", "The elegant Opera House sits among trees and Saigon light. A classic, graceful notebook filled with the atmosphere of the old city.", ["/catalogue/notebook-nha-hat.webp"]),
  p("nha-tho-duc-ba-notebook", "Nhà thờ Đức Bà", "Notre-Dame Cathedral", "notebook", "explore-vietnam", "Hai tháp chuông quen thuộc nổi bật trên nền trời dịu, gợi những buổi dạo quanh trung tâm Sài Gòn. Một thiết kế trang nhã cho người yêu kiến trúc và thành phố.", "The cathedral's twin towers rise against a soft sky, recalling walks through central Saigon. An elegant design for lovers of architecture and place.", ["/catalogue/notebook-nha-tho-duc-ba.webp"]),
  p("nguyen-hue-notebook", "Phố đi bộ Nguyễn Huệ", "Nguyen Hue Walking Street", "notebook", "explore-vietnam", "Khoảng phố rộng, hàng cây và nhịp người qua lại tạo nên một Sài Gòn trẻ trung. Mẫu sổ mang năng lượng thành phố vào từng trang viết.", "An open boulevard, trees and passing crowds capture youthful Saigon. A notebook that brings city energy to every page.", ["/catalogue/notebook-nguyen-hue.webp"]),
  p("ubnd-tphcm-notebook", "Ủy ban Nhân dân TP.HCM", "Ho Chi Minh City Hall", "notebook", "explore-vietnam", "Tòa nhà cổ kính với sắc vàng ấm được minh họa như một tấm bưu ảnh về Sài Gòn. Một món đồ giấy trang nhã để ghi nhớ thành phố.", "The historic city hall glows in warm yellow like a vintage Saigon postcard. An elegant paper keepsake for remembering the city.", ["/catalogue/notebook-ubnd.webp"]),

  p("life-is-better-laughing-notebook", "Life Is Better When You're Laughing", "Life Is Better When You're Laughing", "notebook", "motivation", "Một lời nhắc vui vẻ trên nền bìa xanh trầm: cuộc sống luôn nhẹ hơn khi ta dành chỗ cho tiếng cười. Cuốn sổ phù hợp để ghi lại những điều tích cực, kỷ niệm nhỏ và niềm vui mỗi ngày.", "A cheerful reminder on a muted green cover that life feels lighter when there is room for laughter. A notebook for positive thoughts, small memories and everyday joy.", [motivationLaughingAsset.url], true),
  p("dream-big-work-hard-notebook", "Dream Big, Work Hard", "Dream Big, Work Hard", "notebook", "motivation", "Dòng chữ mạnh mẽ trên nền đen tạo nên một cuốn sổ dành cho những mục tiêu lớn và hành trình bền bỉ. Đây là nơi để biến ước mơ thành kế hoạch, rồi kiên nhẫn hoàn thành từng bước.", "Bold lettering on a deep black cover makes this a notebook for ambitious goals and steady progress. A place to turn dreams into plans, one considered step at a time.", [motivationDreamAsset.url], true),
  p("choose-to-be-happy-notebook", "I Choose To Be Happy", "I Choose To Be Happy", "notebook", "motivation", "Mặt biển xanh dịu và thông điệp giản dị gợi một khoảng thở bình yên giữa ngày bận rộn. Cuốn sổ dành cho nhật ký biết ơn, những dự định mới và các điều khiến bạn mỉm cười.", "A calm blue horizon and a simple affirmation offer a quiet pause in a busy day. A notebook for gratitude, fresh intentions and the things that make you smile.", [motivationHappyAsset.url], true),
  p("trai-dat-tron-notebook", "Trái Đất Tròn, Không Gì Là Không Thể", "The World Is Round, Nothing Is Impossible", "notebook", "motivation", "Hình ảnh Trái Đất đầy màu sắc đi cùng một câu nhắn lạc quan bằng tiếng Việt. Cuốn sổ khơi gợi sự tò mò, niềm tin và tinh thần sẵn sàng bước ra khám phá thế giới.", "A colourful view of Earth carries an optimistic Vietnamese message. This notebook inspires curiosity, confidence and the courage to keep exploring the world.", [motivationEarthAsset.url], true),
  p("enjoy-today-notebook", "Enjoy Today", "Enjoy Today", "notebook", "motivation", "Những đóa hồng rực rỡ trên nền xanh đêm làm nên một cuốn sổ ấm áp và lãng mạn. Thông điệp “Enjoy Today” là một lời nhắc nhỏ để trân trọng từng ngày đang trôi.", "Bright roses over a midnight blue cover make a warm, romantic notebook. The words “Enjoy Today” are a gentle reminder to treasure each passing day.", [motivationEnjoyTodayAsset.url], true),
  p("sun-will-rise-notebook", "Sun Will Rise", "Sun Will Rise", "notebook", "motivation", "Mặt trời cam ấm trên nền xanh trầm mang một lời hứa dịu dàng: ngày mai vẫn sẽ tốt đẹp. Cuốn sổ đi kèm dấu sách in lại hoạ tiết mặt trời cùng thông điệp.", "A warm orange sun on a deep teal cover carries a soft promise that tomorrow will be kind. The notebook comes with a matching sun-print bookmark.", [motivationSunWillRiseAsset.url], true),
  p("walk-when-i-want-to-fly-notebook", "Don't Make Me Walk When I Want To Fly", "Don't Make Me Walk When I Want To Fly", "notebook", "motivation", "Dòng chữ đậm chất tự do trên nền tối cổ điển dành cho những ai luôn muốn bay cao, bay xa. Một cuốn sổ cho ước mơ lớn và những kế hoạch bạo dạn.", "Free-spirited lettering on a classic dark cover, made for those who always want to soar. A notebook for big dreams and brave plans.", [motivationWalkFlyAsset.url], true),
  p("be-happy-cactus-notebook", "Be Happy", "Be Happy", "notebook", "motivation", "Nền giấy kraft ấm cùng những chậu xương rồng vẽ tay mang nét mộc mạc, đáng yêu. Một cuốn sổ nhỏ xinh để gieo thêm niềm vui vào từng ngày.", "Warm kraft paper and hand-drawn cacti feel simple and endearing. A sweet little notebook for planting a little joy in every day.", [motivationBeHappyAsset.url], true),
  p("do-what-you-love-notebook", "Do What You Love, What You Do", "Do What You Love, What You Do", "notebook", "motivation", "Chữ khắc sắc vàng trên nền xám khói cùng dải ruy băng xanh dịu tạo nên một cuốn sổ trầm tĩnh. Dành cho những ngày cần một lời nhắc theo đuổi điều mình yêu.", "Golden lettering on a smoky grey cover with a soft teal ribbon makes for a quiet, composed notebook. For days that need a reminder to follow what you love.", [motivationDoWhatYouLoveAsset.url], true),
  p("youre-beautiful-notebook", "You're Beautiful", "You're Beautiful", "notebook", "motivation", "Tách trà và hoa cúc vẽ tay trên nền kraft ấm mang một lời khen nhỏ dành cho người cầm sổ. Một món quà dịu dàng để nhắc ai đó rằng họ thật đẹp.", "A sketched teacup of daisies on warm kraft holds a small compliment for whoever opens it. A gentle gift that reminds someone how lovely they are.", [motivationYoureBeautifulAsset.url], true),
  p("do-what-you-love-colour-notebook", "Do What You Love — Sắc Màu", "Do What You Love in Colour", "notebook", "motivation", "Phiên bản rực rỡ của dòng chữ quen thuộc: từng chữ cái khoác sắc màu vui tươi trên nền than tối. Một cuốn sổ đầy năng lượng cho những đam mê đang cháy.", "A vivid take on the familiar phrase: every letter dressed in playful colour over dark charcoal. An energetic notebook for passions that burn bright.", [motivationDoWhatYouLoveColourAsset.url], true),
  p("love-yourself-notebook", "Love Yourself", "Love Yourself", "notebook", "motivation", "Hoa nở rực trên nền tối và hai chữ “Love Yourself” như một lời tự nhắc dịu dàng. Cuốn sổ dành cho nhật ký cảm xúc và những khoảnh khắc trân trọng bản thân.", "Rich blooms on a dark cover frame two soft words, “Love Yourself”. A notebook for feelings journals and the moments you choose to be kind to yourself.", [motivationLoveYourselfAsset.url], true),
  p("life-is-too-short-notebook", "Life Is Too Short To Worry", "Life Is Too Short To Worry", "notebook", "motivation", "Nền xanh lá hoài cổ cùng hoạ tiết bút chì nhỏ mang một lời nhắc thong thả: đời ngắn lắm, đừng lo lắng quá. Cuốn sổ cho những kế hoạch nhẹ nhàng và tinh thần thư thái.", "A vintage green cover patterned with little pencils carries an easygoing note that life is too short to worry. A notebook for light plans and a settled mind.", [motivationLifeIsTooShortAsset.url], true),
  p("ca-phe-voi-nguoi-thuong-notebook", "Cà Phê Với Người Thương", "Coffee With Someone Dear", "notebook", "motivation", "Ly cà phê vẽ tay trên nền kraft gợi những buổi hẹn hò bình dị và ấm áp. Cuốn sổ nhỏ dành cho những lời nhắn gửi người thương và những câu chuyện ngày thường.", "A hand-drawn coffee cup on warm kraft recalls easy, unhurried meetings. A small notebook for notes to someone dear and the stories of ordinary days.", [motivationCaPheNguoiThuongAsset.url], true),

  p("ao-dai-saigon-card", "Áo dài Sài Gòn", "Saigon Ao Dai Card", "greeting-card", "ao-dai", "Tà áo dài đỏ bên những dấu ấn Sài Gòn tạo nên một tấm thiệp rực rỡ mà duyên dáng. Phù hợp để gửi lời chào, lời nhớ hoặc làm một món quà nhỏ từ Việt Nam.", "A red ao dai among Saigon landmarks makes a vivid yet graceful card. A lovely way to send a greeting, a memory or a small piece of Vietnam.", ["/catalogue/card-saigon.webp"], true),
  p("ao-dai-buu-dien-card", "Áo dài & Bưu điện Sài Gòn", "Ao Dai & Saigon Post Office", "greeting-card", "ao-dai", "Bưu điện Thành phố hiện lên sau dáng áo dài mềm mại và chiếc xe đạp hoa. Một khung cảnh hoài niệm dành cho những lời nhắn viết tay.", "The Central Post Office frames a flowing ao dai and flower bicycle. A nostalgic city scene made for handwritten messages.", ["/catalogue/card-buu-dien.webp"]),
  p("ao-dai-hoi-an-card", "Áo dài Hội An", "Hoi An Ao Dai Card", "greeting-card", "ao-dai", "Sắc hồng của áo dài, đèn lồng và phố cổ gặp nhau trong một buổi chiều Hội An. Tấm thiệp giữ lại vẻ lãng mạn của miền di sản.", "Pink ao dai, lanterns and old streets meet in a Hoi An afternoon. A card holding the romance of Vietnam's heritage town.", ["/catalogue/card-hoi-an.webp"]),
  p("ao-dai-hue-card", "Áo dài Huế", "Hue Ao Dai Card", "greeting-card", "ao-dai", "Nét trầm mặc của Huế được làm dịu bởi tà áo dài tím và những đóa sen. Một tấm thiệp thanh nhã cho người yêu vẻ đẹp truyền thống.", "Hue's quiet grace is softened by a purple ao dai and lotus flowers. An elegant card for admirers of traditional Vietnamese beauty.", ["/catalogue/card-hue.webp"]),
  p("ao-dai-ha-noi-card", "Áo dài Hà Nội", "Hanoi Ao Dai Card", "greeting-card", "ao-dai", "Phố Hà Nội, sắc hoa và tà áo dài xanh tạo nên một khung hình trong trẻo. Tấm thiệp gợi cảm giác bình yên của những ngày dạo phố.", "Hanoi streets, flowers and a blue ao dai create a clear, peaceful scene. A card recalling gentle days spent wandering the city.", ["/catalogue/card-ha-noi.webp"]),
  p("ao-dai-da-nang-card", "Áo dài Đà Nẵng", "Da Nang Ao Dai Card", "greeting-card", "ao-dai", "Tà áo dài bên sông Hàn và những cây cầu của Đà Nẵng tạo nên một lời chào hiện đại từ miền Trung. Thiết kế sáng và đầy sức sống.", "An ao dai beside the Han River and Da Nang bridges becomes a modern greeting from central Vietnam. Bright, graceful and full of life.", ["/catalogue/card-da-nang.webp"]),
  p("canh-hoa-be-be-card", "Cành Hoa Bé Bé", "Baby's Breath Branch", "greeting-card", "pressed-flower-cards", "Từng bông hoa bé bé được ép khô, dán thành một cành hoa duyên dáng trên nền giấy trắng kem có vân. Viền răng cưa kiểu xưa làm tấm thiệp thêm dịu dàng và mộc mạc.", "Baby's breath, pressed and laid petal by petal into a graceful branch on textured cream paper. A vintage scalloped edge keeps the card soft and homespun.", [], true),
  p("hang-rao-la-nho-card", "Hàng Rào Lá Nhỏ", "Little Leaf Fence", "greeting-card", "pressed-flower-cards", "Cỏ và lá nhỏ khô được sắp thành một hàng rào xanh chạy dọc thiệp, nền giấy tái chế nhuộm hồng dịu. Một tấm thiệp gợi cảm giác buổi chiều vườn cũ yên ả.", "Dried grasses and little leaves arranged into a green fence line on softly pink-dyed recycled paper. A card that recalls a quiet afternoon in the old garden.", [], true),
  p("thank-you-foil-card", "Thank You Ép Nhũ Vàng", "Thank You in Gold Foil", "greeting-card", "pressed-flower-cards", "Hai chữ “Thank You” ép nhũ vàng lấp lánh giữa những cành hoa khô và một trái tim nhỏ. Nền giấy thủ công nhuộm tông ấm, viền răng cưa hoàn thiện nét vintage.", "“Thank You” in shimmering gold foil sits between pressed blooms and a little heart. Hand-dyed craft paper and a scalloped edge complete the vintage charm.", []),
  p("cam-on-foil-card", "Cảm ơn", "Thank You, in Vietnamese", "greeting-card", "pressed-flower-cards", "Lời “Cảm ơn” tiếng Việt được ép nhũ vàng trên nền giấy nhuộm hồng đất, đi cùng vài cánh hoa khô bình dị. Một cách gửi lời biết ơn thật đầy đủ và đúng ý.", "A Vietnamese “Cảm ơn” in gold foil on earthy pink-dyed paper, framed by a few simple pressed petals. A heartfelt way to say thank you, just as you mean it.", []),
  p("trai-tim-nho-card", "Trái Tim Nhỏ", "Little Heart", "greeting-card", "pressed-flower-cards", "Một trái tim nhỏ ghép từ cánh hoa khô, nằm trên nền giấy xanh dịu có vân giấy thủ công. Thiệp gọn gàng cho những lời yêu thương không cần dài dòng.", "A little heart built from pressed petals rests on soft blue craft paper with a woven texture. A compact card for feelings that need no long words.", []),
  p("hoa-do-tren-hong-card", "Hoa Đỏ Trên Hồng", "Red Blooms on Pink", "greeting-card", "pressed-flower-cards", "Những đóa hoa khô đỏ rực được dán trên nền giấy nhuộm hồng, như một vườn hoa thu nhỏ giữa trang giấy. Phù hợp gửi tặng người thương vào mọi dịp.", "Vivid red dried blooms laid over pink-dyed paper, like a small garden kept between the pages. Lovely for the people you hold dear, on any occasion.", []),

  p("ben-bach-dang-magnet", "Bến Bạch Đằng", "Bach Dang Wharf Magnet", "magnet", "explore-vietnam", "Dòng sông và đường chân trời Sài Gòn thu lại trong một khung hình nhỏ. Mẫu magnet gợi nhớ những buổi chiều bên bến và nhịp thành phố phía xa.", "The Saigon River and skyline meet in a small illustrated keepsake. A magnet recalling afternoons by the wharf and the city beyond.", ["/catalogue/magnet-ben-bach-dang.webp"], true),
  p("cho-ben-thanh-magnet", "Chợ Bến Thành", "Ben Thanh Market Magnet", "magnet", "explore-vietnam", "Biểu tượng Chợ Bến Thành được kể bằng nét vẽ giàu màu sắc và không khí phố xá. Một kỷ niệm nhỏ, dễ nhận ra về Sài Gòn.", "Ben Thanh Market is rendered with rich colour and street atmosphere. A small, instantly recognisable memory of Saigon.", ["/catalogue/magnet-cho-ben-thanh.webp"]),
  p("cau-rong-magnet", "Cầu Rồng Đà Nẵng", "Da Nang Dragon Bridge Magnet", "magnet", "explore-vietnam", "Cầu Rồng rực sáng bên mặt nước mang theo năng lượng trẻ của Đà Nẵng. Mẫu magnet như một tấm bưu ảnh thu nhỏ từ thành phố biển.", "Dragon Bridge glows above the water with Da Nang's youthful energy. A miniature postcard from the coastal city.", ["/catalogue/magnet-cau-rong.webp"]),
  p("cau-vang-magnet", "Cầu Vàng Đà Nẵng", "Golden Bridge Magnet", "magnet", "explore-vietnam", "Cầu Vàng uốn qua mây núi trong gam màu ấm, gợi cảm giác về một chuyến đi trên cao. Một dấu nhớ nhỏ về Đà Nẵng.", "The Golden Bridge curves through mountain clouds in warm colour. A small reminder of a journey high above Da Nang.", ["/catalogue/magnet-cau-vang.webp"]),
  p("ho-guom-magnet", "Hồ Hoàn Kiếm", "Hoan Kiem Lake Magnet", "magnet", "explore-vietnam", "Mặt hồ xanh, Tháp Rùa và sắc cây Hà Nội tạo thành một cảnh bình yên. Mẫu magnet dành cho người muốn giữ gần một góc thủ đô.", "Green water, Turtle Tower and Hanoi trees form a peaceful scene. A magnet for keeping a corner of the capital close.", ["/catalogue/magnet-ho-guom.webp"]),
  p("nha-tho-duc-ba-magnet", "Nhà thờ Đức Bà Sài Gòn", "Saigon Cathedral Magnet", "magnet", "explore-vietnam", "Nhà thờ Đức Bà trong sắc trời trong trẻo là một hình ảnh thân thuộc của trung tâm Sài Gòn. Mẫu magnet mang vẻ cổ điển, dễ thương và giàu ký ức.", "Saigon Cathedral beneath a clear sky is a familiar city-centre landmark. A charming, classic magnet filled with memory.", ["/catalogue/magnet-nha-tho-duc-ba.webp"]),
  p("pho-co-ha-noi-magnet", "Phố cổ Hà Nội", "Hanoi Old Quarter Magnet", "magnet", "explore-vietnam", "Mái phố cũ, hàng quán và nhịp xe qua lại làm nên một Hà Nội đời thường. Mẫu magnet lưu lại vẻ đẹp thân thuộc của phố cổ.", "Old roofs, shopfronts and passing traffic form everyday Hanoi. A magnet preserving the familiar charm of the Old Quarter.", ["/catalogue/magnet-pho-co-ha-noi.webp"]),
  p("nha-tho-tan-dinh-magnet", "Nhà thờ Tân Định", "Tan Dinh Church Magnet", "magnet", "explore-vietnam", "Sắc hồng đặc trưng của Nhà thờ Tân Định nổi bật giữa bầu trời Sài Gòn. Một mẫu magnet tươi sáng dành cho người yêu những góc kiến trúc khác biệt.", "Tan Dinh Church's signature pink stands bright against the Saigon sky. A cheerful magnet for lovers of distinctive architecture.", ["/catalogue/magnet-tan-dinh.webp"]),
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
