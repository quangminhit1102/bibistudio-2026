import { sections } from "./products";
import type { Product } from "./products";

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
    coverImage:
      "https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/slider_3.jpg",
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
        src: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/1-1775745545851.jpg",
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
        src: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cloudy-new-01-1735485976842.jpg",
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
      "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cover-2-1783053394132.jpg",
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
        src: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/cozy-01-1784884934764.jpg",
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
      "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/freshday-ke-ngang-1783676913337.jpg",
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
        src: "https://bizweb.dktcdn.net/thumb/large/100/343/063/products/botanical-ke-ngang-1783676844886.jpg",
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
];
