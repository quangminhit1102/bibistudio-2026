# Trang chủ BiBi — Bàn giấy BiBi

Ngày: 2026-11-07. Trạng thái: **hướng A đã được chọn; bản thiết kế này chờ duyệt**.

## Mục đích

Trang chủ giúp khách nhận ra BiBi có sổ tay, thiệp và các món quà nhỏ lấy cảm hứng từ Việt Nam; chọn loại hoặc chủ đề; xem mẫu; rồi liên hệ qua các kênh hiện có. Đây là catalogue thương hiệu. Không thêm giá, giỏ hàng, checkout, ưu đãi hay đánh giá giả.

Người dùng đã chọn hướng A, “Bàn giấy BiBi”: ảnh sản phẩm làm trung tâm, nền ấm, bố cục editorial có tiết chế. Những lựa chọn cụ thể dưới đây là đề xuất của người thiết kế, chưa được coi là người dùng đã duyệt riêng.

## Các hướng đã cân nhắc

- **A — Bàn giấy BiBi (đã chọn):** giữ chất studio, ảnh lớn và nhịp so le; lối chọn loại rõ. Tận dụng tài sản hiện có nhưng cần tuyển ảnh.
- B — Catalogue rõ ràng: lưới đều, rất ít chuyển động; tìm mẫu nhanh nhưng giảm cảm giác editorial.
- C — Những lát cắt Việt Nam: kể chuyện theo địa danh/chủ đề; giàu dấu ấn nhưng cần nhiều ảnh, dễ kéo dài hành trình tìm loại sản phẩm.

## Phạm vi và giới hạn

- Chỉ thiết kế trang chủ public `/`. Không thay đổi admin, backend, authentication, dữ liệu bán hàng hay hệ thống deploy.
- Giữ architecture React, routing, catalogue type/collection tách biệt và các URL hiện có. Không thêm thư viện UI hoặc slider chỉ để thực hiện thiết kế này.
- Không sửa ảnh nguồn, mô tả sản phẩm hoặc phân loại catalogue hàng loạt. Việc chọn ảnh cho homepage có thể dùng cấu hình presentation riêng, có nguồn rõ ràng; không suy luận ảnh chụp từ vị trí `images[1]`.
- Đề xuất chỉnh shared header/footer/contact trên toàn bộ public shell; phải được duyệt cùng thiết kế này. Giữ menu và đích link, chỉ tinh chỉnh trình bày, bỏ link kỹ thuật và gom liên hệ. Nếu phạm vi này không được duyệt, chỉ tạo biến thể homepage, không âm thầm sửa các trang khác.
- Không đổi nền tảng hoặc cấu hình hosting. Không commit code sản phẩm, push hay deploy ở giai đoạn thiết kế.

## Căn cứ khảo sát

Đã đọc source local homepage, header, footer, contact, catalogue card, hero và motion. Đã quan sát `https://bibistudio.vn/` ở desktop 1280×720 và mobile 390×844. Lovable Plan Mode đọc source và lập đề xuất; không trực tiếp quan sát live. Không có thử nghiệm người dùng hoặc số đo Lighthouse trong đợt này.

- Hero desktop đã khảo sát đẩy CTA dưới màn đầu; mobile thấy CTA nhưng ảnh xuất hiện gần cuối màn.
- Lối chọn loại nằm khoảng y=5803 trên mobile đã khảo sát. Con số là ảnh chụp trạng thái cụ thể, không phải thông số cố định.
- FilmStrip desktop ghim khi cuộn, chiếm khoảng 3000px chiều cuộn trong trạng thái khảo sát.
- Không phát hiện tràn ngang ở 390px. Không kết luận mọi breakpoint đều đạt.
- Font đã là Lora/Inter. Ảnh tải được sau khi lazy load/Reveal ổn định; không ghi nhận lỗi ảnh chỉ từ trạng thái chuyển tiếp.
- `realLife` chọn ảnh thứ hai mà chưa xác minh loại ảnh. Một mẫu ảnh detail Bún bò Huế là ảnh hình in trên giấy đặt trên bàn; ảnh collection Explore Vietnam là bảng ghép artwork. Không suy rộng kết luận này cho toàn bộ catalogue.
- Có nút liên hệ cố định 40px trên mobile và link `/api-test` trong footer.
- Lovable metadata báo SHA `89e4f3b`, sandbox tự báo `c9e4f73`. Trước khi triển khai, đối chiếu các file public với local; không lấy sandbox làm nguồn chuẩn hay ghi đè local để giải quyết chênh lệch.

## Hành trình và thứ tự trang

### 1. Header

Giữ logo, sáu menu, tìm kiếm và menu mobile. Không thêm header sticky trong đợt này. Giữ các menu con và lối vào hiện có. Focus, hover và vùng bấm phải rõ. **Theo xác nhận của người dùng, giữ hiển thị lựa chọn EN** ở desktop và trong menu mobile; không ẩn bộ chọn ngôn ngữ. Giữ nguyên hành vi và trạng thái khả dụng hiện có, không coi việc này là yêu cầu triển khai đầy đủ bản dịch tiếng Anh. Dữ liệu song ngữ được giữ nguyên.

### 2. Hero

Desktop: chữ khoảng 40%, ảnh khoảng 60%. Mobile: headline ngắn, mô tả, CTA rồi ảnh. Không đặt ảnh dọc đầy màn trước chữ vì sẽ đẩy thông điệp và CTA xuống sâu.

Copy đề xuất: **“Sổ tay, thiệp và những món quà mang nét Việt.”**

Dòng phụ: “Khám phá sổ tay, thiệp, postcard, bao thư, giấy viết thư và magnet của BiBi Studio.”

CTA chính “Xem các mẫu” → `/products`; phụ “Bộ sưu tập” → `/collections`. Giữ slogan tiếng Anh như một câu ký tên nhỏ trong phần câu chuyện, không chiếm vị trí headline.

Dùng ảnh chụp `hero-desk` hiện có sau khi kiểm tra crop; không dựng ảnh mới. Đề xuất hero tĩnh thay cho tự chạy slideshow: tập trung vào sản phẩm, giảm UI điều khiển. Không thay đổi slider ở trang khác. Khung ảnh desktop gần vuông hoặc 5:4 theo crop đã duyệt; mobile 4:3. Không cắt phần sản phẩm chính. Giảm biểu tượng trang trí lặp với logo.

### 3. Chọn theo loại sản phẩm

Dời “What we make” lên ngay sau hero, đổi tiêu đề “Bạn muốn xem gì?”. Sáu mục giữ thứ tự: Sổ tay, Thiệp, Postcard, Bao thư, Giấy viết thư, Magnet.

Desktop sáu ô; tablet ba cột; mobile hai cột × ba hàng. Không yêu cầu vuốt để tìm đủ sáu loại. Ảnh/thumbnail vuông nếu có ảnh đúng; thiếu ảnh thì dùng icon có sẵn và tên loại với khung đồng nhất, không bịa ảnh sản phẩm. Không hiển thị đếm sản phẩm nếu chưa có nhu cầu.

Đích: `/products/notebooks`, `/products/greeting-cards`, `/products/postcards`, `/products/envelopes`, `/products/letter-paper`, `/products/magnets` (phải đối chiếu slug cuối với catalogue trước implementation; không tạo route đoán).

### 4. Mẫu BiBi chọn

Thay FilmStrip ghim bằng sáu thẻ: desktop ba cột × hai hàng; mobile hai cột. Chọn từ mẫu đang có, không dùng nhãn “bán chạy” khi chưa có dữ liệu. Ưu tiên đa dạng loại/chủ đề và ảnh chụp; không ép đủ loại bằng ảnh sai. Nếu thiếu ảnh chụp, dùng mockup đã được cung cấp, không gọi là ảnh thật.

Mỗi thẻ: ảnh 4:5, tên, loại/bộ sưu tập; toàn thẻ dẫn tới `/products/{product.slug}`. Link cuối “Xem tất cả mẫu” → `/products`. Không giá, giỏ hàng hay nút liên hệ lặp trên từng thẻ.

### 5. Khám phá bộ sưu tập

Gộp khối “Việt Nam, qua từng trang giấy” vào phần bộ sưu tập. Explore Vietnam dẫn đầu bằng một ô lớn có ảnh và hai câu ngắn đã có/cần duyệt; giữ lối vào các bộ sưu tập còn lại, không thêm một lưới bốn sản phẩm Việt Nam riêng.

Desktop một ô lớn và các ô phụ theo nhịp gọn; mobile ô lớn full-width rồi ô phụ hai cột. Collection card dùng artwork/collage khi giới thiệu chủ đề; ảnh sản phẩm xuất hiện rõ ở hero và khối mẫu phía trên. Không gọi artwork là ảnh lifestyle.

Mỗi ô → `/collections/{collection.slug}`; “Tất cả bộ sưu tập” → `/collections`. Bộ sưu tập thiếu ảnh dùng treatment chữ có chủ đích hoặc ảnh đúng đã xác minh, không placeholder giả ảnh lỗi.

### 6. Thiệp theo dịp

Giữ tối đa bốn dịp có mẫu làm gợi ý đầu trang, lựa chọn biên tập có thể cập nhật theo thời điểm mà không sửa cấu trúc. Không tự nhận có chiến dịch/ưu đãi. Desktop bốn ô; mobile hai cột. Chỉ dẫn tới anchor dịp hiện có trong `/collections/greeting-cards`; kiểm tra trang đích thật trước nghiệm thu. Link “Xem các mẫu thiệp” → `/collections/greeting-cards`. Không hiển thị CTA cho dịp trống.

### 7. Một góc BiBi

Gộp brand statement, About cuối trang và dải ảnh chụp thành một section. Hai–ba câu lấy từ nội dung đã có, không tự thêm thông tin handmade, định lượng giấy hoặc quy trình. Giữ slogan tiếng Anh ở đây như chữ ký nhỏ.

Desktop một ảnh chính + hai ảnh chi tiết cùng đoạn giới thiệu; mobile một ảnh chính và hai ảnh phụ, câu chuyện ngắn. Ảnh phải có mục đích khác với ảnh hero/thẻ phía trên, không lặp cùng ảnh chính. Nếu chưa đủ ba ảnh phù hợp thì dùng một ảnh, không chặn toàn bộ thiết kế. “Về BiBi” → `/about`.

### 8. Liên hệ và footer

Lời mời: “Bạn đã tìm được mẫu mình thích? Nhắn BiBi để tìm hiểu thêm.” CTA chính “Liên hệ BiBi” → `/contact`; kênh phụ dùng dữ liệu `src/data/contact.ts`, không hardcode lại. Giữ phone/email/Zalo/Facebook/Messenger hiện tại; Facebook và Messenger có đích riêng trong source, không tự đổi.

Footer giữ logo, link loại/bộ sưu tập, liên hệ và thông tin quyền riêng tư. Bỏ link kỹ thuật `/api-test` khỏi public footer, không xóa route. Không tự bỏ bản đồ khi chưa đánh giá vị trí trong layout.

Liên hệ nổi: một nút có nhãn rõ, vùng bấm ít nhất 44px; mở popover bốn kênh có tên. Có Escape, click ngoài, trạng thái mở/đóng và focus trả về nút. Không trap focus như modal nếu chỉ là popover. Đóng khi mở menu/search/dialog. Tôn trọng safe-area; nội dung cuối trang có khoảng trống để nút không che CTA/links. Desktop cũng dùng nút gọn này để thống nhất, không giữ cột bốn màu riêng.

## Hệ thống trình bày

- Giữ Lora cho tiêu đề và Inter cho body, không thêm font/package. H1 52–64px desktop, 34–40px mobile; H2 32–40/26–30; body 16–18; secondary khoảng 14. Chữ có dấu không bị cắt. Hạn chế nhãn uppercase có tracking lớn.
- Giữ ivory/paper/foreground/sage/kraft trong tokens hiện có. Màu kraft không mặc định dùng cho body. Text thường đạt contrast 4.5:1; text lớn 3:1. Focus/controls nhận biết được trên nền tương ứng.
- Content max-width khoảng 1280px; lề mobile 20–24px, gap thẻ 16–24px; padding section 80–96px desktop, 48–64px mobile. Người triển khai tinh chỉnh trong khoảng này theo ảnh, không tạo khoảng trống lớn chỉ để đủ chiều cao màn.
- Product card: `contain` khi cần bảo toàn sản phẩm; chỉ `cover` cho ảnh có crop an toàn đã xác minh. Tên có thể wrap, không che nội dung; không ép hai dòng nếu làm mất thông tin quan trọng. Hover có thể đổi sang chi tiết đúng mẫu, nhưng thông tin cốt lõi không phụ thuộc hover.
- Nút chính nền foreground, chữ sáng; link phụ có dấu hiệu tương tác rõ. Giữ hệ icon đang có; không thêm icon pack. Vùng bấm tối thiểu 44×44px.
- Một kiểu Reveal nhẹ, khoảng 200–350ms; hover scale rất nhỏ khi phù hợp. Bỏ ghim cuộn và hiệu ứng đổi hướng cuộn. Reduced motion thấy đủ nội dung ngay, không tự chạy slideshow. Touch không cần hover để dùng.
- Giữ aspect ratio/kích thước để hạn chế layout shift. Hero tải ưu tiên, ảnh dưới fold lazy. Chọn kích thước ảnh đáp ứng viewport, giữ ASCII URL và assets local. Không claim đạt Core Web Vitals trước khi đo.

## Wireframe

```text
Desktop
Header
Hero: chữ + CTA | ảnh lớn
6 loại sản phẩm
6 mẫu: 3 × 2
Bộ sưu tập: ô lớn + ô phụ
4 dịp có mẫu
Một góc BiBi: ảnh + chuyện ngắn
Liên hệ
Footer                                      [Liên hệ nổi]

Mobile
Menu | Logo | Tìm kiếm
Headline + mô tả + CTA
Ảnh hero
6 loại: 2 × 3
6 mẫu: 2 × 3
Bộ sưu tập lớn, rồi ô phụ 2 cột
4 dịp: 2 × 2
Một góc BiBi
Liên hệ, footer                             [Liên hệ nổi]
```

## Review và nghiệm thu dự kiến

1. Duyệt thiết kế này trước; sau đó mới viết implementation plan.
2. Giai đoạn đầu: hero và lối chọn loại, ưu tiên cao/tác động cao/độ khó vừa. Review local ở 1280×720 và 390×844: thấy headline, CTA và phần ảnh có ý nghĩa trong màn đầu; chọn loại ngay sau hero, mục tiêu tiếp cận trong hai màn đầu trên 390×844.
3. Giai đoạn hai: ảnh, thẻ mẫu, bộ sưu tập và gộp câu chuyện; ưu tiên cao/tác động cao/độ khó vừa. Không ghim cuộn, không có ảnh sai mẫu, mỗi section có nhiệm vụ riêng, CTA đúng route.
4. Giai đoạn ba: shell public, liên hệ và responsive; ưu tiên cao/tác động cao/độ khó vừa. Kiểm tra 360/390/768/1024/1440, tên dài, bàn phím, Escape, focus, safe-area, reduced motion và không tràn ngang. Shared components phải smoke-test trang listing, detail, contact.
5. Giai đoạn bốn: contrast, asset size, console, tải trang và hiệu năng; ưu tiên vừa/tác động vừa/độ khó vừa. Đo baseline và sau sửa cùng điều kiện; đặt mục tiêu LCP ≤2.5s trong cấu hình đo đã ghi rõ nhưng không coi lab score là số liệu người dùng thực. Build/test phù hợp phải đạt; screenshot desktop/mobile là bằng chứng giao diện.
6. Mục tiêu hiểu sản phẩm trong 5 giây cần thử với người chưa quen website, đề xuất ít nhất ba người kể lại BiBi làm gì và họ sẽ bấm đâu. Nếu chưa có người thử, báo chưa kiểm chứng thay vì tự nhận đạt.
7. Deploy production là bước riêng, không nằm trong phê duyệt thiết kế hoặc review local này; đọc `docs/build-and-deploy.md` trước các bước build/deploy/rollback sau này.

## Chưa cần yêu cầu tài sản mới ngay

Tuyển ảnh đang có trước. Catalogue thiếu khai báo ảnh riêng ở một số loại và thiệp xoắn; kiểm tra xem có ảnh đúng trong tài sản hiện hữu. Lập danh sách asset → loại ảnh → vị trí sử dụng trong implementation plan. Người triển khai có thể đề xuất sáu mẫu đại diện từ catalogue hiện có; không thay catalogue nguồn để ép thiết kế.

## Các lựa chọn cần duyệt cùng bản này

- Hero tiếng Việt theo copy ở trên, ảnh tĩnh thay slideshow; slogan làm chữ ký nhỏ.
- Lưới mẫu thay FilmStrip, gộp câu chuyện và phần Việt Nam.
- Header/footer/liên hệ chỉnh đồng bộ toàn public shell. Lựa chọn EN vẫn hiển thị theo yêu cầu đã xác nhận; không thay đổi chức năng chuyển ngôn ngữ trong đợt này.
- Nút liên hệ gọn ở cả desktop/mobile; giữ nguyên đích các kênh.

Người triển khai tự quyết crop an toàn, sáu mẫu/ảnh đề cử, breakpoint và khoảng cách trong các giới hạn đã nêu. Không tự quyết thông tin thương hiệu mới, đổi contact links, cắt tính năng public hoặc deploy.
