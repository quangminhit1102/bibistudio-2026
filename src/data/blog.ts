import { sections } from "./products";
import type { Product } from "./products";
import { paginate, POSTS_PER_PAGE } from "./pagination";
import type { Paged } from "./pagination";

export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level?: 2 | 3 }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "quote"; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string; // ISO 8601
  readTime: string;
  coverImage: string;
  content: ContentBlock[];
  relatedHandles: string[];
};

const allProducts = sections.flatMap((s) => s.products);

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getAllBlogPosts(): BlogPost[] {
  return blogPosts;
}

export function getBlogPostsPage(page: number, pageSize = POSTS_PER_PAGE): Paged<BlogPost> {
  const sorted = [...blogPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return paginate(sorted, page, pageSize);
}

export function getRelatedProducts(handles: string[]): Product[] {
  const map = new Map<string, Product>();
  for (const product of allProducts) {
    if (handles.includes(product.handle) && !map.has(product.handle)) {
      map.set(product.handle, product);
    }
  }
  return Array.from(map.values());
}

const blogPosts: BlogPost[] = [
  {
    slug: "5-thoi-quen-viet-tay-de-song-cham-hon",
    title: "5 thói quen viết tay để sống chậm hơn mỗi ngày",
    excerpt:
      "Viết tay không chỉ là cách ghi lại thông tin, mà còn là một hành trình kết nối với chính mình. Dưới đây là 5 thói quen nhỏ giúp bạn sống chậm lại.",
    category: "Cảm hứng",
    author: "BiBi Studio",
    date: "2026-08-25",
    readTime: "5 phút đọc",
    coverImage: "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Giữa những bộn bề của cuộc sống, đôi khi điều chúng ta cần chỉ là một nhịp thở chậm lại để lắng nghe chính mình. Dưới đây là 5 thói quen nhỏ mà BiBi Studio tin rằng sẽ giúp bạn tìm lại sự an yên và cảm hứng trong từng ngày.",
      },
      { type: "heading", text: "1. Bắt đầu ngày mới bằng 10 phút viết nhật ký", level: 2 },
      {
        type: "paragraph",
        text: "Viết ra những suy nghĩ, cảm xúc hoặc đơn giản là danh sách những điều bạn muốn làm trong ngày sẽ giúp tâm trí bạn nhẹ nhàng và tập trung hơn. Một cuốn sổ tay chất lượng và cây bút mực êm tay chính là người bạn đồng hành lý tưởng.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Sổ tay Ghibli collection",
        caption: "Sổ tay Ghibli collection — mềm mại và đầy cảm hứng.",
      },
      { type: "heading", text: "2. Lập kế hoạch theo cách của bạn", level: 2 },
      {
        type: "paragraph",
        text: "Thay vì những danh sách dài đằng đẵng, hãy thử viết kế hoạch theo cách riêng: ngắn gọn, linh hoạt và có không gian cho cảm hứng bất chợt. Một tập giấy kẻ ô vuông hoặc chấm bi sẽ giúp bạn tự do sắp xếp ý tưởng.",
      },
      {
        type: "quote",
        text: "Sống chậm không phải là làm ít đi, mà là hiện diện nhiều hơn trong từng khoảnh khắc.",
      },
      { type: "heading", text: "3. Ghi lại những điều nhỏ bé", level: 2 },
      {
        type: "paragraph",
        text: "Những điều nhỏ bé thường mang lại hạnh phúc lớn lao. Hãy tập ghi lại những khoảnh khắc đáng nhớ trong ngày: một câu nói, một bản nhạc hay, hay chỉ là ánh nắng buổi chiều.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Sổ tay Cloudy collection",
        caption: "Cloudy collection — nhẹ nhàng như một ngày nhiều mây.",
      },
      { type: "heading", text: "4. Dành thời gian cho sáng tạo", level: 2 },
      {
        type: "paragraph",
        text: "Scrapbook, washi tape, sticker hay postcard đều là những công cụ tuyệt vời để bạn thể hiện cá tính. Đừng ngại thử nghiệm màu sắc, chất liệu và bố cục riêng.",
      },
      { type: "heading", text: "5. Kết thúc ngày bằng lời biết ơn", level: 2 },
      {
        type: "paragraph",
        text: "Trước khi đi ngủ, hãy dành vài phút để viết ra ba điều bạn biết ơn trong ngày. Thói quen này giúp tâm trí thư giãn và dễ dàng chìm vào giấc ngủ sâu hơn.",
      },
      {
        type: "paragraph",
        text: "Sống chậm không phải là làm ít đi, mà là hiện diện nhiều hơn trong từng khoảnh khắc. Hãy bắt đầu từ những trang giấy trắng, và để viết tay đồng hành cùng bạn mỗi ngày.",
      },
    ],
    relatedHandles: [
      "tap-may-chi-b5-giay-kem-80gsm-200-trang",
      "but-gel-zebra-sarasa-clip-ngoi-0-5mm",
      "combo-phu-kien-trang-tri-so-tay",
    ],
  },
  {
    slug: "cach-chon-so-tay-phu-hop",
    title: "Cách chọn sổ tay phù hợp với phong cách của bạn",
    excerpt:
      "Từ kích thước, loại giấy đến thiết kế bìa, mỗi chi tiết đều ảnh hưởng đến trải nghiệm viết. Cùng BiBi Studio tìm cuốn sổ hoàn hảo nhé.",
    category: "Hướng dẫn",
    author: "BiBi Studio",
    date: "2026-08-20",
    readTime: "4 phút đọc",
    coverImage:
      "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Chọn sổ tay không chỉ là chọn một món đồ văn phòng phẩm, mà còn là chọn người bạn đồng hành cho hành trình sáng tạo và quản lý thời gian của bạn.",
      },
      { type: "heading", text: "Xác định mục đích sử dụng", level: 2 },
      {
        type: "paragraph",
        text: "Nếu bạn cần ghi chép công việc hàng ngày, một cuốn sổ A5 kẻ ngang sẽ là lựa chọn thực tế. Nếu bạn thích vẽ phác thảo hoặc bullet journal, giấy trắng mịn và khổ vuông A5 sẽ linh hoạt hơn.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Sổ mẫu độc quyền A5",
        caption: "Sổ mẫu độc quyền A5 — nhỏ gọn và đa năng.",
      },
      { type: "heading", text: "Chất liệu giấy quan trọng như thế nào?", level: 2 },
      {
        type: "paragraph",
        text: "Giấy dày 80–100gsm sẽ hạn chế tình trạng bút lông, bút máy bị lem. Nếu bạn hay dùng bút dạ quang hoặc marker, hãy ưu tiên giấy dày và có độ trắng vừa phải để màu sắc hiển thị đẹp nhất.",
      },
      {
        type: "quote",
        text: "Một cuốn sổ tốt không chỉ đẹp mắt, mà còn phải khiến bạn muốn mở ra viết mỗi ngày.",
      },
      {
        type: "paragraph",
        text: "Cuối cùng, hãy chọn một thiết kế bìa khiến bạn cảm thấy vui mỗi khi nhìn thấy. Dù là tối giản, vintage hay đầy màu sắc, sổ tay phải phản ánh chính bạn.",
      },
    ],
    relatedHandles: [
      "tap-may-chi-b5-giay-kem-80gsm-200-trang",
      "vintage-asthetic-so-tay-vuong-ruot-kraft-dot",
      "so-mau-doc-quyen-a5",
    ],
  },
  {
    slug: "bullet-journal-la-gi-huong-dan-cho-nguoi-moi",
    title: "Bullet Journal là gì? Hướng dẫn cho người mới",
    excerpt:
      "Bullet Journal là phương pháp ghi chép linh hoạt kết hợp giữa nhật ký, lập kế hoạch và sáng tạo. Bài viết này sẽ hướng dẫn bạn bắt đầu từ con số 0.",
    category: "Hướng dẫn",
    author: "BiBi Studio",
    date: "2026-08-15",
    readTime: "6 phút đọc",
    coverImage:
      "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Bullet Journal (BuJo) là hệ thống ghi chép do Ryder Carroll sáng tạo, giúp bạn theo dõi công việc, sự kiện và ý tưởng trong một cuốn sổ duy nhất. Điểm mạnh của BuJo là tính linh hoạt: bạn tự thiết kế bố cục phù hợp với nhu cầu.",
      },
      { type: "heading", text: "Những thành phần cơ bản", level: 2 },
      {
        type: "paragraph",
        text: "Một Bullet Journal thường có Index (mục lục), Future Log (lịch dài hạn), Monthly Log (tháng) và Daily Log (ngày). Bạn có thể thêm Collection để theo dõi sách, phim, thói quen hay bất cứ điều gì bạn thích.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Sổ tay Botanical Ruled",
        caption: "Sổ tay Botanical Ruled — nền tảng hoàn hảo cho BuJo.",
      },
      { type: "heading", text: "Bắt đầu đơn giản", level: 2 },
      {
        type: "paragraph",
        text: "Đừng cố gắng biến cuốn sổ đầu tiên thành tác phẩm nghệ thuật. Hãy bắt đầu với các ký hiệu cơ bản: dấu chấm cho nhiệm vụ, dấu X khi hoàn thành, dấu mũi tên khi dời lịch và dấu gạch ngang cho ghi chú.",
      },
      {
        type: "quote",
        text: "Bullet Journal không hoàn hảo — nó chỉ cần phù hợp với bạn.",
      },
      {
        type: "paragraph",
        text: "Khi đã quen, bạn có thể thêm màu sắc, washi tape, sticker và hình vẽ nhỏ để tăng cảm hứng. Hãy nhớ rằng mục tiêu chính vẫn là tổ chức và sống có ý thức.",
      },
    ],
    relatedHandles: [
      "combo-4c-tap-b5-cong-nhua-botanical-ruled",
      "but-zebra-sarasa-vintage-nhieu-mau",
      "washitape-le-cuon",
    ],
  },
  {
    slug: "huong-dan-toan-tap-scrapbook-cho-nguoi-moi",
    title: "Hướng dẫn toàn tập Scrapbook cho người mới bắt đầu",
    excerpt:
      "Từ dụng cụ cơ bản, cách chọn giấy, bố cục trang, phối màu đến bảo quản album — tất cả những gì bạn cần để bắt đầu hành trình scrapbook.",
    category: "Hướng dẫn",
    author: "BiBi Studio",
    date: "2026-08-28",
    readTime: "12 phút đọc",
    coverImage:
      "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Scrapbook là nghệ thuật lưu giữ kỷ niệm bằng hình ảnh, giấy, chữ viết và những chi tiết trang trí nhỏ. Khác với việc lưu ảnh trong điện thoại, một cuốn scrapbook cho phép bạn chạm vào ký ức: nếp giấy, vệt mực, chiếc vé xem phim cũ dán nghiêng ở góc trang. Bài viết này sẽ đi qua toàn bộ quy trình, từ chuẩn bị dụng cụ đến hoàn thiện và bảo quản album.",
      },
      { type: "heading", text: "1. Scrapbook là gì và vì sao nên bắt đầu", level: 2 },
      {
        type: "paragraph",
        text: "Scrapbook xuất hiện từ thế kỷ 15 ở châu Âu, khi người ta dán những mẩu báo, thơ và tranh khắc vào sổ tay cá nhân. Ngày nay scrapbook trở thành một hình thức sáng tạo kết hợp giữa nhiếp ảnh, thiết kế và viết lách. Điểm hấp dẫn nhất là bạn không cần khéo tay: chỉ cần một cuốn sổ, vài tấm ảnh và mong muốn kể lại câu chuyện của mình.",
      },
      { type: "heading", text: "1.1. Lợi ích với sức khỏe tinh thần", level: 3 },
      {
        type: "paragraph",
        text: "Việc cắt, dán, sắp xếp bằng tay giúp não bộ chuyển sang trạng thái tập trung nhẹ nhàng — tương tự thiền động. Nhiều người chia sẻ rằng 30 phút làm scrapbook mỗi tuần giúp họ giảm cảm giác quá tải và ngủ ngon hơn.",
      },
      { type: "heading", text: "1.2. Scrapbook như một món quà", level: 3 },
      {
        type: "paragraph",
        text: "Một cuốn album tự làm luôn có giá trị tình cảm cao hơn bất kỳ món quà mua sẵn nào. Bạn có thể làm album kỷ niệm ngày cưới, album cho bạn thân sắp đi xa, hoặc album một năm đầu đời của em bé.",
      },
      { type: "heading", text: "2. Bộ dụng cụ cơ bản", level: 2 },
      {
        type: "paragraph",
        text: "Bạn không cần mua tất cả ngay từ đầu. Danh sách dưới đây được sắp xếp theo thứ tự ưu tiên: bắt đầu với ba món đầu tiên, rồi bổ sung dần khi đã quen tay.",
      },
      { type: "heading", text: "2.1. Album hoặc sổ nền", level: 3 },
      {
        type: "paragraph",
        text: "Khổ vuông 21x21cm là lựa chọn cân bằng: đủ rộng để bố cục thoải mái nhưng vẫn dễ cất giữ. Nếu bạn thích album to hơn, khổ A4 ngang sẽ hợp với ảnh phong cảnh. Ưu tiên giấy nền dày từ 200gsm trở lên để không bị cong khi dán ảnh và keo.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Sổ dán ảnh A5 giấy mỹ thuật",
        caption: "Sổ dán ảnh A5 — giấy mỹ thuật 250gsm, phù hợp cho người mới.",
      },
      { type: "heading", text: "2.2. Keo và băng dính", level: 3 },
      {
        type: "paragraph",
        text: "Keo khan (glue stick) dùng cho giấy mỏng, keo hai mặt dạng con lăn cho ảnh in, và mút xốp hai mặt để tạo hiệu ứng nổi. Tránh keo nước gốc PVA cho ảnh vì độ ẩm có thể làm ảnh bị gợn sóng.",
      },
      { type: "heading", text: "2.3. Kéo, dao rọc và thước", level: 3 },
      {
        type: "paragraph",
        text: "Một chiếc kéo nhỏ mũi nhọn để cắt chi tiết, dao rọc giấy kèm thảm cắt để cắt đường thẳng dài. Thước kim loại luôn tốt hơn thước nhựa vì không bị dao cắt lẹm cạnh.",
      },
      { type: "heading", text: "2.4. Bút và phụ kiện trang trí", level: 3 },
      {
        type: "paragraph",
        text: "Bút gel mực đen 0.5mm cho chú thích, bút kim để viết tiêu đề, washi tape để che mép và tạo khung, sticker và tem giấy để lấp khoảng trống. Hãy giữ bảng màu giới hạn trong 3–4 tông để trang không bị rối.",
      },
      {
        type: "quote",
        text: "Đừng mua thêm dụng cụ khi bạn chưa dùng hết những gì đang có — sự sáng tạo sinh ra từ giới hạn.",
      },
      { type: "heading", text: "3. Chọn và chuẩn bị ảnh", level: 2 },
      {
        type: "paragraph",
        text: "Một trang scrapbook đẹp thường chỉ có 1–3 tấm ảnh. Hãy chọn ảnh kể được câu chuyện thay vì ảnh đẹp nhất về mặt kỹ thuật: bàn tay đang cầm ly cà phê, một góc phố lúc chiều muộn, khoảnh khắc cười vỡ oà.",
      },
      { type: "heading", text: "3.1. Kích thước in phổ biến", level: 3 },
      {
        type: "paragraph",
        text: "Ảnh 9x13cm dễ bố cục nhất. Ảnh polaroid 5.4x8.6cm hợp để xếp thành dải nhỏ. Với ảnh chủ đạo, in khổ 13x18cm và đặt lệch tâm trang để tạo điểm nhìn.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Set hình polaroid in theo yêu cầu",
        caption: "Ảnh polaroid nhỏ rất linh hoạt khi xếp bố cục nhiều hình.",
      },
      { type: "heading", text: "3.2. Xử lý ảnh trước khi in", level: 3 },
      {
        type: "paragraph",
        text: "Giảm nhẹ độ bão hòa và tăng một chút độ ấm sẽ giúp ảnh hòa hợp với tông giấy kem. Nếu album có nhiều ảnh chụp ở các thời điểm khác nhau, hãy dùng chung một preset màu để toàn bộ album trông thống nhất.",
      },
      { type: "heading", text: "4. Nguyên tắc bố cục trang", level: 2 },
      {
        type: "paragraph",
        text: "Bố cục là yếu tố quyết định trang scrapbook trông chuyên nghiệp hay lộn xộn. Bốn nguyên tắc dưới đây đủ dùng cho hầu hết mọi trang.",
      },
      { type: "heading", text: "4.1. Quy tắc số lẻ", level: 3 },
      {
        type: "paragraph",
        text: "Nhóm các thành phần theo số lẻ (1, 3, 5) tạo cảm giác tự nhiên hơn số chẵn. Ví dụ: một ảnh lớn, ba sticker nhỏ, một dòng chú thích.",
      },
      { type: "heading", text: "4.2. Khoảng trắng là bạn", level: 3 },
      {
        type: "paragraph",
        text: "Chừa ít nhất 1.5cm lề quanh trang và đừng lấp kín mọi khoảng trống. Khoảng trắng giúp mắt nghỉ và làm nổi bật ảnh chính.",
      },
      { type: "heading", text: "4.3. Đường dẫn mắt", level: 3 },
      {
        type: "paragraph",
        text: "Sắp xếp ảnh theo đường chéo hoặc chữ Z để mắt người xem di chuyển qua toàn bộ trang. Washi tape dán chéo là cách đơn giản để tạo đường dẫn này.",
      },
      { type: "heading", text: "4.4. Phân cấp thông tin", level: 3 },
      {
        type: "paragraph",
        text: "Mỗi trang nên có một tiêu đề lớn, một hoặc hai dòng ngày tháng/địa điểm, và một đoạn chú thích ngắn. Kích cỡ chữ giảm dần theo mức độ quan trọng.",
      },
      { type: "heading", text: "5. Phối màu theo tinh thần BiBi Studio", level: 2 },
      {
        type: "paragraph",
        text: "Bảng màu ivory – be ấm – xanh sage – terracotta rất dễ phối và luôn cho cảm giác dịu mắt. Cách áp dụng: nền ivory, giấy phụ màu be, chi tiết nhấn terracotta khoảng 10% diện tích, xanh sage cho các mảng lớn thứ hai.",
      },
      { type: "heading", text: "5.1. Ba công thức phối màu an toàn", level: 3 },
      {
        type: "paragraph",
        text: "Đơn sắc: chọn một màu và biến tấu độ đậm nhạt. Tương đồng: chọn ba màu cạnh nhau trên vòng thuần sắc. Nhấn tương phản: nền trung tính cộng một màu nhấn duy nhất. Người mới nên bắt đầu với công thức thứ ba.",
      },
      { type: "heading", text: "6. Viết chú thích (journaling)", level: 2 },
      {
        type: "paragraph",
        text: "Phần chữ mới là thứ khiến bạn xúc động khi mở lại album sau nhiều năm. Đừng chỉ ghi 'Đà Lạt 2026' — hãy viết bạn đã cảm thấy gì, trời hôm ấy ra sao, ai đã nói câu gì khiến bạn nhớ mãi.",
      },
      { type: "heading", text: "6.1. Ba khung câu gợi ý", level: 3 },
      {
        type: "paragraph",
        text: "‘Điều mình muốn nhớ nhất về ngày này là…’, ‘Nếu kể lại cho mình của 10 năm sau, mình sẽ nói…’, ‘Chi tiết nhỏ mà không ảnh nào chụp được là…’.",
      },
      { type: "heading", text: "7. Hoàn thiện và bảo quản", level: 2 },
      {
        type: "paragraph",
        text: "Sau khi dán xong, ép album dưới vật nặng khoảng một giờ để keo khô phẳng. Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp vì tia UV làm phai mực và ố giấy. Nếu album dày, dùng dây thun vải hoặc hộp đựng riêng để giữ form.",
      },
      { type: "heading", text: "7.1. Lịch làm scrapbook bền vững", level: 3 },
      {
        type: "paragraph",
        text: "Thay vì làm dồn một lần, hãy đặt lịch 45 phút mỗi tuần. Mỗi buổi hoàn thành một trang. Sau ba tháng bạn sẽ có một album 12 trang trọn vẹn mà không hề thấy áp lực.",
      },
      {
        type: "paragraph",
        text: "Scrapbook không có đúng sai. Trang đầu tiên của bạn có thể lệch, keo có thể lem, nhưng đó chính là dấu vết của bàn tay thật. Hãy bắt đầu với một tấm ảnh bạn yêu thích nhất — phần còn lại sẽ tự đến.",
      },
    ],
    relatedHandles: [
      "so-dan-anh-kho-vuong",
      "set-16-hinh-polaroid-in-theo-yeu-cau",
      "combo-phu-kien-trang-tri-so-tay",
      "washitape-le-cuon",
    ],
  },
  {
    slug: "cam-nang-chon-but-viet-cho-tung-nhu-cau",
    title: "Cẩm nang chọn bút viết: gel, bi, kim, máy và dạ quang",
    excerpt:
      "Mỗi loại bút cho một trải nghiệm viết khác nhau. Bài viết phân tích chi tiết từng dòng bút, cỡ ngòi, loại mực và cách chọn theo mục đích sử dụng.",
    category: "Hướng dẫn",
    author: "BiBi Studio",
    date: "2026-08-27",
    readTime: "10 phút đọc",
    coverImage:
      "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Một cây bút phù hợp có thể thay đổi hoàn toàn cảm giác viết: nét mực đều, tay không mỏi, chữ không lem. Ngược lại, cây bút sai sẽ khiến bạn ngại mở sổ. Dưới đây là cẩm nang đầy đủ giúp bạn chọn đúng ngay từ đầu.",
      },
      { type: "heading", text: "1. Hiểu về các loại mực", level: 2 },
      {
        type: "paragraph",
        text: "Trước khi bàn tới kiểu dáng, hãy hiểu ba loại mực chính vì chúng quyết định 80% trải nghiệm viết.",
      },
      { type: "heading", text: "1.1. Mực dầu (ballpoint)", level: 3 },
      {
        type: "paragraph",
        text: "Đặc sệt, khô rất nhanh, hầu như không lem và không thấm ngược mặt sau. Nhược điểm là cần tì tay mạnh hơn và nét mực đôi khi ngắt quãng. Phù hợp ký giấy tờ, viết trên giấy mỏng, ghi chép nhanh.",
      },
      { type: "heading", text: "1.2. Mực gel", level: 3 },
      {
        type: "paragraph",
        text: "Lỏng hơn mực dầu, cho nét đậm mượt và màu tươi. Đây là lựa chọn phổ biến nhất cho journaling. Nhược điểm: khô chậm hơn, người thuận tay trái dễ bị quệt lem — nên chọn dòng quick-dry.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Combo phụ kiện trang trí sổ tay",
        caption: "Bút gel nhiều màu là công cụ cơ bản của mọi cuốn journal.",
      },
      { type: "heading", text: "1.3. Mực nước và bút máy", level: 3 },
      {
        type: "paragraph",
        text: "Mực nước cho nét thanh đậm rõ ràng và cảm giác trượt trên giấy rất dễ chịu. Đổi lại, bạn cần giấy tốt (từ 90gsm, tráng mịn) để tránh thấm ngược và tòe nét.",
      },
      { type: "heading", text: "2. Chọn cỡ ngòi", level: 2 },
      {
        type: "paragraph",
        text: "Cỡ ngòi tính bằng milimet, thể hiện độ rộng nét viết trên giấy.",
      },
      { type: "heading", text: "2.1. Ngòi 0.28 – 0.38mm", level: 3 },
      {
        type: "paragraph",
        text: "Rất mảnh, hợp với chữ nhỏ, ghi chú bên lề, viết trong ô lịch tháng của bullet journal. Cần giấy mịn, nếu giấy nhám nét sẽ bị xước.",
      },
      { type: "heading", text: "2.2. Ngòi 0.5mm", level: 3 },
      {
        type: "paragraph",
        text: "Cỡ tiêu chuẩn, cân bằng giữa độ rõ nét và độ mượt. Nếu bạn chỉ mua một cây bút duy nhất, hãy chọn 0.5mm.",
      },
      { type: "heading", text: "2.3. Ngòi 0.7 – 1.0mm", level: 3 },
      {
        type: "paragraph",
        text: "Nét đậm, thích hợp viết tiêu đề, ký tên hoặc cho những ai viết chữ to. Trên giấy mỏng dưới 70gsm có thể thấy bóng mực ở mặt sau.",
      },
      {
        type: "quote",
        text: "Không có cây bút tốt nhất — chỉ có cây bút phù hợp nhất với loại giấy và cỡ chữ của bạn.",
      },
      { type: "heading", text: "3. Chọn bút theo mục đích", level: 2 },
      { type: "heading", text: "3.1. Ghi chép học tập", level: 3 },
      {
        type: "paragraph",
        text: "Ưu tiên bút gel 0.5mm mực đen hoặc xanh, thân bút có grip cao su để viết lâu không mỏi. Chuẩn bị thêm hai màu phụ để phân cấp thông tin: một màu cho tiêu đề, một màu cho phần cần nhớ.",
      },
      { type: "heading", text: "3.2. Bullet journal và trang trí", level: 3 },
      {
        type: "paragraph",
        text: "Bộ bút gel vintage nhiều màu sẽ hữu ích. Kết hợp bút kim 0.3mm để kẻ khung, bút brush để viết tiêu đề kiểu lettering, và dạ quang tông pastel để đánh dấu mà không chói mắt.",
      },
      { type: "heading", text: "3.3. Viết thư và nhật ký", level: 3 },
      {
        type: "paragraph",
        text: "Đây là lúc bút máy tỏa sáng. Chọn ngòi F (fine) cho chữ Việt có dấu, mực màu nâu đen hoặc xanh rêu để hợp tông giấy kem.",
      },
      { type: "heading", text: "3.4. Đánh dấu và highlight", level: 3 },
      {
        type: "paragraph",
        text: "Dạ quang pastel dạng đầu vát 4mm cho phép vừa tô rộng vừa gạch chân mảnh. Tránh highlight quá ba màu trên một trang vì sẽ mất tác dụng phân loại.",
      },
      { type: "heading", text: "4. Giấy và bút — cặp đôi không thể tách rời", level: 2 },
      {
        type: "paragraph",
        text: "Giấy 70gsm hợp bút bi; 80gsm là mức tối thiểu cho bút gel; từ 100gsm trở lên mới thực sự thoải mái với bút máy và marker. Độ nhẵn bề mặt cũng quan trọng không kém định lượng: giấy quá nhẵn làm mực khô chậm, giấy quá nhám làm mòn ngòi.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Tập may chỉ B5 giấy kem 80gsm",
        caption: "Giấy kem 80gsm — mức cân bằng tốt cho bút gel và bút bi.",
      },
      { type: "heading", text: "5. Bảo quản bút đúng cách", level: 2 },
      { type: "heading", text: "5.1. Bút gel và bút bi", level: 3 },
      {
        type: "paragraph",
        text: "Cất nằm ngang hoặc để ngòi hướng xuống. Nếu bút tắc mực, viết vài vòng tròn lên giấy nháp hoặc chấm nhẹ ngòi vào nước ấm.",
      },
      { type: "heading", text: "5.2. Bút máy", level: 3 },
      {
        type: "paragraph",
        text: "Rửa ngòi bằng nước sạch mỗi 4–6 tuần, không để mực khô trong ống dẫn. Khi không dùng lâu, hãy hút hết mực và làm sạch trước khi cất.",
      },
      { type: "heading", text: "6. Bộ bút gợi ý theo ngân sách", level: 2 },
      {
        type: "paragraph",
        text: "Dưới 100.000₫: một bút gel 0.5mm đen và một dạ quang pastel. Khoảng 250.000₫: thêm bộ gel vintage 5 màu và bút kim 0.3mm. Trên 500.000₫: bổ sung một bút máy ngòi F cùng lọ mực và một cuốn sổ giấy 100gsm.",
      },
      {
        type: "paragraph",
        text: "Hãy thử viết trực tiếp trước khi mua nếu có thể. Cảm giác tay là thứ không thể mô tả bằng thông số — và đó chính là điều khiến việc chọn bút trở nên thú vị.",
      },
    ],
    relatedHandles: [
      "but-gel-zebra-sarasa-clip-ngoi-0-5mm",
      "but-zebra-sarasa-vintage-nhieu-mau",
      "tap-may-chi-b5-giay-kem-80gsm-200-trang",
    ],
  },
  {
    slug: "thiet-lap-goc-hoc-tap-truyen-cam-hung",
    title: "Thiết lập góc học tập truyền cảm hứng trong 7 bước",
    excerpt:
      "Một góc bàn gọn gàng, đủ sáng và đúng gu sẽ khiến bạn muốn ngồi vào học mỗi ngày. Hướng dẫn chi tiết từ ánh sáng, sắp xếp đến hệ thống lưu trữ văn phòng phẩm.",
    category: "Cảm hứng",
    author: "BiBi Studio",
    date: "2026-08-26",
    readTime: "9 phút đọc",
    coverImage:
      "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Không gian ảnh hưởng trực tiếp đến khả năng tập trung. Một góc học tập được thiết lập tốt giúp bạn vào việc nhanh hơn, ngồi lâu hơn mà ít mệt hơn. Bảy bước dưới đây có thể hoàn thành trong một buổi chiều.",
      },
      { type: "heading", text: "Bước 1. Chọn vị trí", level: 2 },
      {
        type: "paragraph",
        text: "Ưu tiên nơi có cửa sổ bên trái (nếu bạn thuận tay phải) để ánh sáng tự nhiên không tạo bóng lên trang viết. Tránh đặt bàn quay lưng ra cửa ra vào vì cảm giác bất an sẽ khiến bạn dễ mất tập trung.",
      },
      { type: "heading", text: "1.1. Khi phòng nhỏ", level: 3 },
      {
        type: "paragraph",
        text: "Một chiếc bàn rộng 80cm là đủ. Hãy tận dụng chiều cao: kệ treo tường phía trên bàn giúp giải phóng mặt bàn mà không tốn diện tích sàn.",
      },
      { type: "heading", text: "Bước 2. Ánh sáng", level: 2 },
      {
        type: "paragraph",
        text: "Kết hợp ba lớp sáng: ánh sáng tổng thể của phòng, đèn bàn hướng vào vùng viết, và một nguồn sáng ấm nhỏ để giảm tương phản. Nhiệt độ màu 4000K là mức cân bằng giữa tỉnh táo và dễ chịu.",
      },
      { type: "heading", text: "Bước 3. Dọn sạch mặt bàn", level: 2 },
      {
        type: "paragraph",
        text: "Bỏ mọi thứ xuống, lau bàn, rồi chỉ đặt lại những món bạn dùng hằng ngày. Nguyên tắc: nếu một tuần qua bạn không chạm vào nó, nó không thuộc về mặt bàn.",
      },
      {
        type: "quote",
        text: "Mặt bàn trống là lời mời gọi bắt đầu; mặt bàn bừa là lời nhắc về những việc chưa xong.",
      },
      { type: "heading", text: "Bước 4. Hệ thống lưu trữ văn phòng phẩm", level: 2 },
      { type: "heading", text: "4.1. Phân theo tần suất dùng", level: 3 },
      {
        type: "paragraph",
        text: "Tầng một (trên bàn): bút đang dùng, sổ hiện tại, đèn. Tầng hai (ngăn kéo trên cùng): washi tape, sticker, kéo, keo. Tầng ba (hộp cất): giấy dự trữ, bút chưa mở, album cũ.",
      },
      { type: "heading", text: "4.2. Đựng bút đúng cách", level: 3 },
      {
        type: "paragraph",
        text: "Giới hạn ống bút ở 8–10 cây. Nhiều hơn sẽ khiến bạn mất thời gian tìm và thường xuyên rút nhầm cây đã hết mực. Định kỳ mỗi tháng thử lại toàn bộ và loại bỏ cây không viết được.",
      },
      {
        type: "image",
        src: "https://placehold.co/600x400?text=600x400",
        alt: "Hộp quà handmade vintage",
        caption: "Hộp giấy nhỏ giúp gom phụ kiện rời gọn gàng trong ngăn kéo.",
      },
      { type: "heading", text: "Bước 5. Trang trí có chừng mực", level: 2 },
      {
        type: "paragraph",
        text: "Chọn tối đa ba điểm nhấn: một chậu cây nhỏ, một khung ảnh hoặc postcard, và một món đồ mang tính cá nhân. Quá nhiều đồ trang trí sẽ biến góc học thành nơi trưng bày.",
      },
      { type: "heading", text: "5.1. Bảng ghim cảm hứng", level: 3 },
      {
        type: "paragraph",
        text: "Một tấm bảng nỉ hoặc dây kẹp ảnh treo trên bàn cho phép bạn thay đổi nội dung theo tháng: mục tiêu, vé xem phim, một câu trích dẫn đang tâm đắc.",
      },
      { type: "heading", text: "Bước 6. Thiết lập thói quen bắt đầu", level: 2 },
      {
        type: "paragraph",
        text: "Tạo một nghi thức ngắn 2 phút trước khi học: rót nước, bật đèn, mở sổ và viết ba việc cần làm. Não bộ sẽ liên kết chuỗi hành động này với trạng thái tập trung.",
      },
      { type: "heading", text: "6.1. Kỹ thuật 25/5", level: 3 },
      {
        type: "paragraph",
        text: "Học 25 phút, nghỉ 5 phút, sau bốn hiệp nghỉ dài 20 phút. Ghi lại số hiệp hoàn thành mỗi ngày vào sổ để theo dõi tiến bộ.",
      },
      { type: "heading", text: "Bước 7. Bảo trì hằng tuần", level: 2 },
      {
        type: "paragraph",
        text: "Dành 10 phút cuối tuần để trả đồ về đúng chỗ, vứt giấy nháp, lau bàn và chuẩn bị sổ cho tuần mới. Đây là bước nhỏ nhất nhưng quyết định việc góc bàn có giữ được sự gọn gàng hay không.",
      },
      {
        type: "paragraph",
        text: "Một góc học tập tốt không cần đắt tiền. Nó chỉ cần đủ sáng, đủ gọn và mang dấu ấn của bạn — để mỗi lần ngồi xuống, bạn thấy mình đang ở đúng nơi cần đến.",
      },
    ],
    relatedHandles: [
      "so-mau-doc-quyen-a5",
      "hop-qua-handmade-vintage",
      "sticker-dang-to-a6-nhieu-mau-set-3-to",
    ],
  },
  {
    slug: "chon-so-tay-theo-muc-dich-su-dung",
    title: "Chọn sổ tay theo mục đích sử dụng: học tập, làm việc hay journaling",
    excerpt:
      "Sổ ruled cho ghi chép công việc, sổ chấm bi cho bullet journal, sổ ô vuông cho vẽ kỹ thuật — cách chọn đúng ruột sổ cho từng nhu cầu.",
    category: "Cẩm nang",
    author: "BiBi Studio",
    date: "2026-09-02",
    readTime: "4 phút đọc",
    coverImage:
      "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Trước khi mua một cuốn sổ mới, hãy tự hỏi cuốn sổ ấy sẽ làm gì trong đời bạn. Cùng một kích cỡ B5 nhưng ruột kẻ dòng, ô vuông hay chấm bi lại phục vụ những thói quen rất khác nhau.",
      },
      { type: "heading", text: "Sổ kẻ dòng (ruled)", level: 2 },
      {
        type: "paragraph",
        text: "Phù hợp cho ghi chú cuộc họp, ghi bài giảng và viết thư. Khoảng cách dòng 8mm là chuẩn thoải mái nhất với chữ viết tay Việt Nam.",
      },
      { type: "heading", text: "Sổ chấm bi (dot grid)", level: 2 },
      {
        type: "paragraph",
        text: "Lựa chọn của người làm bullet journal: dòng chấm mờ hướng dẫn bố cục mà không cạnh tranh với chữ viết hay hình vẽ.",
      },
      {
        type: "paragraph",
        text: "Mẹo nhỏ: nếu bạn chưa chắc mình thuộc nhóm nào, hãy bắt đầu bằng một cuốn B5 kẻ dòng 80gsm — an toàn, bền và dễ dùng cho mọi nhu cầu.",
      },
    ],
    relatedHandles: ["tap-may-chi-b5-giay-kem-80gsm-200-trang", "tap-b5-lo-xo-nhua-80-trang"],
  },
  {
    slug: "cach-bao-quan-va-luu-tru-but-muc-lau-dai",
    title: "Cách bảo quản bút mực để dùng được lâu dài",
    excerpt:
      "Bút gel để ngang hay ngửa? Bút máy bao lâu phải rửa một lần? Những mẹo nhỏ giúp cây bút yêu thích của bạn luôn ra mực đều.",
    category: "Cẩm nang",
    author: "BiBi Studio",
    date: "2026-09-03",
    readTime: "3 phút đọc",
    coverImage: "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Một cây bút tốt có thể theo bạn nhiều năm nếu được bảo quản đúng cách. Nguyên tắc đầu tiên: luôn đậy nắp khi không dùng và cất bút nằm ngang.",
      },
      { type: "heading", text: "Bút gel và bút bi", level: 2 },
      {
        type: "paragraph",
        text: "Tránh để bút ở nơi quá nóng như cốp xe hay cạnh cửa sổ nắng gắt — nhiệt độ cao làm khô mực và khiến hạt bi bị kẹt. Cất ngang để mực luôn ở đầu bi.",
      },
      { type: "heading", text: "Bút máy", level: 2 },
      {
        type: "paragraph",
        text: "Nếu dùng hằng ngày, chỉ cần rửa ngòi bằng nước sạch mỗi 2–3 tuần khi thay màu mực. Nếu cất lâu, hãy rửa sạch, để khô rồi mới cất để tránh mực đóng cặn.",
      },
      {
        type: "paragraph",
        text: "Và một lưu ý cuối: đừng dùng chung một cây bút máy cho mực pigment và mực dye — cặn pigment rất khó làm sạch ngòi.",
      },
    ],
    relatedHandles: ["but-gel-zebra-sarasa-clip-ngoi-0-5mm", "but-muji-chinh-hang"],
  },
  {
    slug: "y-tuong-trang-tri-bullet-journal-thang-9",
    title: "5 ý tưởng trang trí bullet journal cho tháng 9",
    excerpt:
      "Từ bảng theo dõi thói quen hình ô dù đến trang mục tiêu màu đất — gợi ý bố cục nhẹ nhàng cho mùa thu với washi tape và bút highlight.",
    category: "Cảm hứng",
    author: "BiBi Studio",
    date: "2026-09-04",
    readTime: "5 phút đọc",
    coverImage:
      "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Tháng 9 gợi nhắc về những buổi sáng se lạnh, chiếc áo khoác mỏng và mùa tựu trường. Hãy để cảm hứng đó đi vào từng trang bullet journal của bạn.",
      },
      { type: "heading", text: "1. Trang tổng quan với tông màu đất", level: 2 },
      {
        type: "paragraph",
        text: "Chọn một bảng màu 3 tông như nâu, be và xanh rêu. Dùng bút highlight pastel để tô các ô ngày, washi tape họa tiết lá làm đường viền trang.",
      },
      { type: "heading", text: "2. Bảng theo dõi thói quen hình ô dù", level: 2 },
      {
        type: "paragraph",
        text: "Vẽ 30 chiếc ô dù nhỏ, mỗi ô dù là một ngày trong tháng. Mỗi lần hoàn thành thói quen, tô màu một ô — đến cuối tháng bạn sẽ có một khu vườn ô dù đầy màu.",
      },
      {
        type: "paragraph",
        text: "Đừng quên dành một góc trang cho danh sách nhạc và sách đang nghe, đang đọc trong tháng — tháng nào ghi lại được, cuối năm xem lại rất vui.",
      },
    ],
    relatedHandles: ["zebra-midliner-2-dau", "sthm-stationery-set-32-nhan-vo-basic-7-2x3-6cm"],
  },
  {
    slug: "goi-qua-handmade-y-nghia-ngay-khai-giang",
    title: "Gợi ý gói quà handmade ý nghĩa cho ngày khai giảng",
    excerpt:
      "Một bộ vở xinh, chiếc bút máy đầu tiên và tấm thiệp tự viết — cách gói quà tự làm khiến món quà tựu trường trở nên đặc biệt hơn.",
    category: "Cảm hứng",
    author: "BiBi Studio",
    date: "2026-09-05",
    readTime: "6 phút đọc",
    coverImage:
      "https://placehold.co/800x800?text=800x500",
    content: [
      {
        type: "paragraph",
        text: "Ngày khai giảng không cần món quà đắt tiền. Một gói quà được chọn và tự tay gói lại sẽ đi cùng kỷ niệm lâu hơn nhiều so với giá trị của nó.",
      },
      { type: "heading", text: "Chuẩn bị bên trong", level: 2 },
      {
        type: "paragraph",
        text: "Chọn 2–3 cuốn vở giấy kem, một cây bút máy ngòi F phù hợp với người mới tập viết, và một bộ sticker nhãn vở để các em tự trang trí sách vở.",
      },
      { type: "heading", text: "Gói và viết thiệp", level: 2 },
      {
        type: "paragraph",
        text: "Dùng giấy gói màu trơn, điểm thêm một đoạn washi tape và một tấm thiệp nhỏ viết tay vài lời chúc năm học mới. Nét chữ của người tặng chính là phần quý nhất của món quà.",
      },
      {
        type: "paragraph",
        text: "Mẹo: ghim một cuốn sổ A5 nhỏ vào gói quà như một lời mời gọi viết — món quà sẽ còn tiếp tục lớn lên cùng năm học.",
      },
    ],
    relatedHandles: ["tap-vo-a5", "but-chi-bam-marvy-uchida-fl200"],
  },
];
