# Trang chủ BiBi Studio — audit UI/UX và đề xuất (chỉ plan, chưa sửa gì)

**Nguồn bằng chứng**
- Mình đã đọc mã nguồn: `src/routes/index.tsx` (262 dòng), `site-footer.tsx`, `floating-contact.tsx`. Bản mã trong sandbox là `c9e4f73`, khác mã `89e4f3b` bạn nêu. Cần đối chiếu lại trước khi làm.
- Mình **không** mở trình duyệt hay trang live. Số đo màn hình (CTA dưới màn đầu ở 1280×720, lối vào loại sản phẩm ở y≈5803 trên 390×844, FilmStrip ≈3066px) lấy từ quan sát của Codex, ghi là **[Codex]**.
- Phần **[Giả định]** cần bạn xác nhận.

## 1. Đánh giá hiện trạng (vấn đề quan trọng nhất trước)

| # | Khu vực | Đang tốt | Vấn đề | Ảnh hưởng | Ưu tiên |
|---|---|---|---|---|---|
| 1 | Thứ tự trang | Đủ nội dung, có cá tính | 11 khối. Lối vào theo **loại sản phẩm** ("What we make") đứng thứ 5, sau 7 bộ sưu tập và FilmStrip [Codex: ~7 màn trên mobile] | Khách cần sổ tay hay thiệp phải cuộn rất lâu | Cao |
| 2 | Hero | Ảnh sổ thật, 2 CTA, slideshow 5 ảnh | Headline tiếng Anh cỡ lớn (`text-[3.35rem]`→`md:text-7xl`) đẩy CTA xuống dưới màn đầu ở desktop [Codex]. Trên mobile ảnh nằm cuối màn đầu. Eyebrow "Touch your heart" lặp ý headline. Chưa nói rõ "làm đồ giấy gì" | Không đạt mục tiêu 5 giây | Cao |
| 3 | FilmStrip "Trên bàn của BiBi" | Ảnh sản phẩm nổi bật, chuyển động đẹp | Bị ghim khi cuộn, chiếm ≈3066px [Codex] | Cảm giác "kẹt", mệt trên trackpad | Cao |
| 4 | Nút liên hệ nổi | Đủ 4 kênh, đúng thứ tự | Mobile: thanh 4 nút 40px cố định ở đáy, che ảnh [Codex]. Desktop ≥1280: cột 4 nút ở cạnh phải. Màu thương hiệu từng nút phá bảng màu giấy | Che sản phẩm, trông như template bán hàng | Cao |
| 5 | Lặp lại | — | Cùng chủ đề Explore Vietnam xuất hiện 3 lần: ô bộ sưu tập lớn, khối "Việt Nam, qua từng trang giấy" (4 sản phẩm) và ảnh hero. Có 3–4 lưới ảnh liên tiếp | Trang dài mà không thêm thông tin | Trung bình |
| 6 | Ngôn ngữ | — | Tiêu đề trộn Anh/Việt: "Explore Collections", "What we make", "Paper can hold a memory" cạnh "Mẫu nổi bật", "Gợi ý quà". Trong khi đó tiếng Anh vẫn đang "sắp ra mắt" | Thiếu nhất quán, khó đọc với khách Việt | Trung bình |
| 7 | Loại ảnh | Có cả ảnh thật lẫn artwork | `realLife` chỉ lấy `images[1]`, không có dữ liệu cho biết ảnh nào là ảnh chụp, ảnh nào là artwork. Thẻ sản phẩm hiện ảnh chính `object-contain` (thường là artwork) | Khách thấy artwork rời, phải tự hình dung sản phẩm | Cao |
| 8 | "Paper can hold a memory" | Giọng văn đẹp | `py-28 md:py-40` cộng chữ hoa 5xl–7xl là một khoảng rất dài, chưa có sản phẩm nào | Đẩy sản phẩm xuống sâu | Trung bình |
| 9 | Thiệp theo dịp | Ý tưởng tốt, dẫn tới anchor | Hiện cả các dịp chưa có mẫu [Giả định: cần xem dữ liệu live] | Bấm vào thấy trống | Trung bình |
| 10 | Footer | Đủ liên hệ, bản đồ | Có link kỹ thuật `/api-test` [Codex]. Khối About ngay trước footer lặp với footer | Thiếu chuyên nghiệp | Thấp–TB |
| 11 | Chuyển động | Có kiểm tra reduced motion | Có cùng lúc Parallax, ScrollExpand, SplitWords, FilmStrip, unveil, Reveal | Nặng, rối | Trung bình |
| 12 | Hover/focus, tương phản | Có focus ở chấm hero | Link chữ hoa 12px, `tracking-[0.22em]` khá nhỏ. Chưa kiểm tra tương phản `text-kraft` [Giả định] | Khó đọc trên mobile | Trung bình |

## 2. Ba hướng thiết kế

**A. Bàn làm việc editorial (khuyến nghị).** Nền ivory, ảnh sản phẩm thật làm chủ, nhịp so le kiểu tạp chí, chữ Lora hiền hơn, mỗi khối có một nhiệm vụ.
- Ưu: giữ bản sắc hiện tại, ít đụng tài sản, đưa sản phẩm lên sớm.
- Nhược: cần gắn nhãn loại ảnh cho từng sản phẩm.

**B. Catalogue tối giản kiểu MUJI.** Lưới đều, chữ nhỏ, gần như không chuyển động.
- Ưu: nhanh, rất rõ ràng.
- Nhược: mất cá tính Việt Nam, dễ trông đại trà, đi ngược mục tiêu 4.

**C. Kể chuyện theo chủ đề.** Mỗi màn là một chủ đề Việt Nam: phở, áo dài, phố cổ…
- Ưu: rất đáng nhớ.
- Nhược: khó tìm theo loại sản phẩm, trang dài, cần nhiều ảnh lifestyle mà hiện chưa có.

**Khuyến nghị A**, vì hướng này đưa ảnh sản phẩm thật và lối vào theo loại lên hai màn đầu, đồng thời vẫn giữ chất studio.

## 3. Cấu trúc trang chủ mới

1. **Hero (thiết kế lại)**
   - Mục đích: trong 5 giây khách hiểu BiBi làm gì.
   - Nội dung: headline tiếng Việt ngắn, một dòng phụ liệt kê "sổ tay · thiệp · postcard · bao thư · giấy viết thư · magnet", ảnh **sản phẩm thật**.
   - Desktop: chia 5/7, CTA nằm trong màn đầu ở 1280×720. Mobile: ảnh lên trước (tỷ lệ 4/5), chữ và CTA ngay dưới.
   - CTA: "Xem các mẫu" → `/products`, link phụ "Bộ sưu tập" → `/collections`.
2. **Lối vào theo loại sản phẩm (dời lên từ vị trí 5)**
   - 6 ô ảnh sản phẩm thật kèm tên tiếng Việt. Desktop 6 cột, mobile cuộn ngang dạng chip-thẻ (2,5 thẻ hiển thị).
   - Dẫn tới `/products/$typeSlug`.
3. **Mẫu nổi bật (thiết kế lại từ FilmStrip)**
   - 6–8 sản phẩm, ảnh thật trước, khi hover đổi sang artwork/chi tiết hình in.
   - Bỏ ghim cuộn, dùng slider ngang thường có nút mũi tên.
   - Dẫn tới trang sản phẩm.
4. **Bộ sưu tập/chủ đề (gộp)**
   - Một ô lớn cộng lưới các ô còn lại. **Gộp** khối "Việt Nam, qua từng trang giấy" vào ô lớn, chỉ thêm 2 câu chuyện ngắn.
   - Desktop: so le 1 lớn + 2×3. Mobile: 1 cột, ảnh 4/5.
5. **Câu chuyện thương hiệu (rút gọn)**
   - Gộp "Paper can hold a memory" với khối About cuối trang thành 2–3 câu cộng 1 ảnh chụp tay.
   - CTA "Về BiBi" → `/about`.
6. **Thiệp theo dịp (giữ)**
   - Chỉ hiện dịp đã có mẫu. Các dịp còn lại gom vào 1 dòng "Sắp có".
   - Mobile: chip cuộn ngang.
7. **Ảnh chụp thực tế (giữ, lọc lại)**
   - Chỉ dùng ảnh đã gắn nhãn "ảnh chụp", tối đa 6 ảnh, một hàng.
8. **Liên hệ nhẹ nhàng (thiết kế lại)**
   - Một dòng: "Thích mẫu nào? Gửi tên mẫu cho BiBi qua Zalo hoặc Messenger", kèm 2–4 nút đơn sắc.
9. **Footer (giữ)**, bỏ link `/api-test`.

**Bỏ:** khối About trùng lặp (đã gộp vào mục 5) và hiệu ứng ghim của FilmStrip.

## 4. Định hướng thiết kế chi tiết

- **Chữ:** Lora cho tiêu đề, không viết hoa toàn bộ với tiếng Việt vì dấu dễ dính. Cỡ chữ:
  - H1: 40px mobile / 64px desktop
  - H2: 32 / 44px
  - Nội dung: Inter 16px
  - Nhãn nhỏ: tối thiểu 12px, `tracking` 0.12em
- **Màu:** giữ ivory/paper/kraft/sage hiện có. Kraft chỉ dùng cho điểm nhấn, chữ kraft phải đạt tương phản AA.
- **Khoảng cách:** nhịp section 96px desktop / 64px mobile, thay cho 112–160px hiện nay.
- **Ảnh:**
  - Thêm nhãn `kind: product | artwork | lifestyle` cho từng ảnh trong dữ liệu.
  - Ảnh thật ở hero, thẻ sản phẩm và ảnh chụp thực tế. Artwork chỉ hiện khi hover hoặc trong gallery.
  - Tỷ lệ: thẻ sản phẩm 4/5, bộ sưu tập 4/5 (ô lớn 16/9 trên desktop), loại sản phẩm 1/1.
- **Thẻ sản phẩm:** ảnh `object-cover` khi là ảnh thật, kèm tên, loại · bộ sưu tập. Không giá, không giỏ hàng.
- **Nút:** 1 nút chính đặc màu (foreground) và 1 link gạch chân. Vùng bấm tối thiểu 44px, viền focus rõ.
- **Chuyển động:** giữ Reveal nhẹ và zoom chậm khi hover. Bỏ ghim cuộn. ScrollExpand/SplitWords chỉ dùng tối đa 1 lần. Giữ reduced motion.
- **Liên hệ nổi:**
  - Mobile: **1 nút tròn "Liên hệ"** mở ra 4 kênh; ẩn khi đang mở menu hoặc dialog.
  - Desktop: giữ cột nhưng đổi sang đơn sắc.

## 5. Phác thảo trải nghiệm

```text
DESKTOP 1280                         MOBILE 390
[Header: logo | menu | tìm | VI]     [logo        tìm ☰]
[Hero: chữ 5 | ảnh sổ thật 7 ]       [ảnh sản phẩm 4/5   ]
 headline / dòng loại SP / 2 CTA     [headline, dòng phụ ]
[6 ô loại sản phẩm ngang      ]      [CTA chính | link   ]
[Mẫu nổi bật: slider 4 thẻ  ←→]      [chip loại SP cuộn →]
[Bộ sưu tập: 1 lớn + 2×3      ]      [mẫu nổi bật cuộn → ]
[Câu chuyện: ảnh | 3 câu      ]      [bộ sưu tập 1 cột   ]
[Thiệp theo dịp: chip + 4 thẻ ]      [câu chuyện ngắn    ]
[Ảnh chụp thực tế 1 hàng      ]      [dịp: chip cuộn     ]
[Liên hệ nhẹ 1 dòng           ]      [ảnh thực tế cuộn   ]
[Footer                       ]      [liên hệ | footer   ] (●Liên hệ)
```

**Headline hero (chọn 1):**
1. "Những món đồ giấy nhỏ, giữ lại một chút Việt Nam." — CTA "Xem các mẫu" / "Bộ sưu tập"
2. "Sổ tay, thiệp và quà giấy — vẽ từ những điều thân quen." — CTA "Khám phá mẫu" / "Chọn theo dịp"
3. "Giấy để viết, để tặng, để nhớ." — CTA "Xem sổ tay & thiệp" / "Câu chuyện BiBi"

## 6. Kế hoạch thực hiện

| Giai đoạn | Việc | Ưu tiên | Tác động | Độ khó | Nghiệm thu |
|---|---|---|---|---|---|
| 1. Nhanh | Hero mới (headline VI, CTA trong màn đầu) | Cao | Cao | Thấp | CTA thấy được ở 1280×720 và 390×844 |
| 1 | Dời lối vào theo loại lên vị trí 2 | Cao | Cao | Thấp | Thấy được trong ≤2 màn trên mobile |
| 1 | Thống nhất tiêu đề sang tiếng Việt, bỏ `/api-test` | TB | TB | Thấp | Không còn tiêu đề tiếng Anh, trừ tên thương hiệu |
| 1 | Gom nút liên hệ trên mobile | Cao | Cao | TB | Không che ảnh; ẩn khi mở menu/dialog. *Ảnh hưởng mọi trang public* |
| 2. Section chính | Gắn nhãn loại ảnh trong dữ liệu catalogue | Cao | Cao | TB | Mỗi sản phẩm có ít nhất 1 ảnh có nhãn |
| 2 | Mẫu nổi bật dạng slider, bỏ ghim | Cao | Cao | TB | Chiều cao khối ≤ 1 màn |
| 2 | Gộp khối Việt Nam vào bộ sưu tập; gộp 2 khối About | TB | TB | TB | Trang ngắn hơn khoảng 25% |
| 2 | Thiệp theo dịp chỉ hiện dịp có mẫu | TB | TB | Thấp | Không còn link dẫn tới mục trống |
| 3. Responsive | Kiểm tra 360/390/768/1024/1440, chế độ tối nếu có, bàn phím | Cao | TB | TB | Không tràn ngang, vùng bấm ≥44px, focus rõ |
| 4. Tinh chỉnh | Giảm hiệu ứng, ảnh ưu tiên tải `fetchpriority` cho hero, Lighthouse | TB | TB | Thấp | LCP < 2,5s trên mobile [đo sau], reduced motion không có chuyển động |

**Phạm vi:** header, footer và nút liên hệ nổi dùng chung cho mọi trang public, nên sửa ở đây sẽ đổi luôn các trang đó. Không đụng admin.

## Quyết định cần bạn duyệt

1. Hướng A, B hay C.
2. Headline hero: 1, 2 hay 3, hoặc tự viết.
3. Tiêu đề trang chủ hoàn toàn tiếng Việt? Có giữ câu "Little things, made to touch your heart" làm câu ký tên không?
4. Nút liên hệ trên mobile: gom thành 1 nút, hay giữ thanh 4 nút nhưng thu gọn?
5. Có bỏ hẳn hiệu ứng ghim của FilmStrip không?
6. Gộp khối "Việt Nam, qua từng trang giấy" vào bộ sưu tập?

## Ảnh/nội dung còn thiếu

- Ảnh sản phẩm thật (không phải artwork) cho cả 6 loại, nhất là bao thư, giấy viết thư, magnet [Giả định: cần kiểm tra dữ liệu].
- 1–2 ảnh chụp tay ngang cho hero và câu chuyện thương hiệu.
- Danh sách dịp thiệp đã có mẫu thật.
- Bạn xác nhận: ảnh nào là ảnh chụp, ảnh nào là artwork/mockup (để gắn nhãn).
- Mình không tự thêm chất liệu, quy trình, giá hay đánh giá khách hàng.
