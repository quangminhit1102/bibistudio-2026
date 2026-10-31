# Cập nhật mockup sổ bản đồ — thiết kế đã duyệt

## Mục tiêu và phạm vi

Dùng 13 mockup được cung cấp tại `C:/Users/Admin/Downloads/MOCKUP BAN DO` làm hình ảnh chuẩn cho dòng sổ bản đồ. Người dùng đã chọn phương án 1: thay gallery của sản phẩm đã có bằng mockup mới và thêm sản phẩm còn thiếu. Đây là thay đổi nội dung catalogue nhỏ, tiếp tục dùng React, dữ liệu tĩnh và giao diện hiện tại.

## Approaches — phương án đã cân nhắc

1. **Dùng bộ mới làm chuẩn (người dùng chọn):** mỗi sản phẩm có một ảnh mockup mới trong gallery; bỏ tham chiếu ảnh cũ của ba sản phẩm trùng. Đồng nhất phiên bản bìa, nhưng tạm chỉ có một góc xem mỗi mẫu.
2. **Ảnh mới dẫn đầu, ảnh cũ theo sau:** giữ nhiều góc xem, nhưng cần xác nhận từng ảnh cũ đúng phiên bản. Không chọn vì đã thấy chi tiết bìa cũ và mới khác nhau.

## Ánh xạ nguồn → sản phẩm

Tất cả dùng `productType: notebook`, `collection: explore-vietnam`. Người dùng đã chốt tên Việt theo cấu trúc **Sổ tay bản đồ + địa danh**, tên Anh theo cấu trúc **[Place] Map Notebook** (ví dụ Da Lat Map Notebook, Vietnam Map Notebook). Ba sản phẩm hiện hữu cũng đổi tên hiển thị theo quy tắc này, giữ nguyên slug và URL. Các slug còn lại dưới đây là đề xuất của agent, chưa tồn tại trong catalogue đã kiểm tra.

| File PNG nguồn | Tên sản phẩm | Slug | Xử lý |
|---|---|---|---|
| MOCKUP_DN.png | Sổ tay bản đồ Đà Nẵng | da-nang-map-notebook | Thay gallery |
| MOCKUP_HG.png | Sổ tay bản đồ Hà Giang | ha-giang-map-notebook | Thay gallery |
| MOCKUP_SG.png | Sổ tay bản đồ Sài Gòn | sai-gon-map-notebook | Thay gallery |
| MOCKUP_CA MAU.png | Sổ tay bản đồ Cà Mau | ca-mau-map-notebook | Thêm mới |
| MOCKUP_DA LAT.png | Sổ tay bản đồ Đà Lạt | da-lat-map-notebook | Thêm mới |
| MOCKUP_HN.png | Sổ tay bản đồ Hà Nội | ha-noi-map-notebook | Thêm mới |
| MOCKUP_HOI AN.png | Sổ tay bản đồ Hội An | hoi-an-map-notebook | Thêm mới |
| MOCKUP_HUE.png | Sổ tay bản đồ Huế | hue-map-notebook | Thêm mới |
| MOCKUP_NHA TRANG.png | Sổ tay bản đồ Nha Trang | nha-trang-map-notebook | Thêm mới |
| MOCKUP_PHU YEN.png | Sổ tay bản đồ Phú Yên | phu-yen-map-notebook | Thêm mới |
| MOCKUP_PQ.png | Sổ tay bản đồ Phú Quốc | phu-quoc-map-notebook | Thêm mới |
| MOCKUP_QUANG NINH.png | Sổ tay bản đồ Quảng Ninh | quang-ninh-map-notebook | Thêm mới |
| MOCKUP_VN.png | Sổ tay bản đồ Việt Nam | viet-nam-map-notebook | Thêm mới |

## Cách thực hiện đề xuất

- Đọc lại trạng thái catalogue trước khi sửa để tránh tạo trùng nếu source có cập nhật.
- Tạo bản WebP trong `public/catalogue` với tên ASCII mới, ví dụ `notebook-map-da-nang-mockup.webp`; đổi URL ảnh thay vì ghi đè file cũ để tránh trình duyệt giữ ảnh cũ. Không đổi URL sản phẩm.
- Giữ nguyên bố cục, nền giấy, màu, chữ và toàn bộ cuốn sổ trong mockup; chỉ thu nhỏ và nén bằng công cụ chuyển đổi ảnh thông thường. Không vẽ lại, tự sửa nội dung bìa hoặc tạo ảnh bằng AI.
- Đề xuất cạnh dài tối đa 2000 px, không phóng lớn; chọn mức nén sau khi kiểm tra chữ và nét bản đồ. Mục tiêu mỗi ảnh không quá 600 KB nếu vẫn đọc rõ; ghi nhận dung lượng thực tế, không cam kết trước khi chuyển đổi.
- Mỗi mẫu chỉ trỏ tới mockup tương ứng. Không thêm ảnh cắt giả làm góc chụp thứ hai. Giữ file ảnh cũ trong kho ở đợt này để tránh ảnh hưởng nơi khác và các bản phát hành cũ.
- Cập nhật `src/data/catalogue.ts`: ba gallery cũ, mười bản ghi mới với tên Việt/Anh, mô tả ngắn theo những gì nhìn thấy, alt text phù hợp. Không tự điền số trang, khổ giấy, vật liệu hay thông số chưa được cung cấp.
- Giữ cờ nổi bật hiện có của Sài Gòn; các sản phẩm mới không tự gắn nổi bật. Đặt các mẫu bản đồ cạnh nhau trong thứ tự catalogue, giữ tương quan thứ tự của sản phẩm khác.
- Giữ bộ sưu tập Khám phá Việt Nam hiện tại, không tạo collection mới hoặc thay ảnh đại diện collection/menu trong phạm vi này.
- Dùng giao diện card/detail hiện có. Với một ảnh, card không chuyển sang ảnh cũ khi hover; kiểm tra nền và toàn bộ cuốn sổ trên khung 4:5 trước khi quyết định có cần chỉnh riêng phần hiển thị hay không. Mọi thay đổi bố cục rộng hơn phải đưa lại để review.

Các lựa chọn về tên file, kích thước, nén, thứ tự và cờ nổi bật ở trên là đề xuất của agent để người dùng duyệt cùng tài liệu.

## Không nằm trong phạm vi

Không thay sản phẩm món ăn, thiệp, magnet hoặc các sổ địa danh khác; không thêm giá/giỏ hàng, BE/database, thay CI/CD hay bật staging. Không tự publish production trong bước thiết kế và lập plan. Phát hành sau này theo `docs/build-and-deploy.md`, dùng artifact CI, Run workflow thủ công và giữ rollback.

## Tiêu chí nghiệm thu sau triển khai

- Đúng 13 mẫu: cập nhật ba sản phẩm hiện hữu, thêm mười sản phẩm; không trùng slug, sai loại hoặc sai collection.
- Tất cả URL ảnh mới là file local ASCII, đúng định dạng thực, giải mã được; gallery của 13 mẫu không tham chiếu ảnh cũ hoặc ảnh remote.
- Kiểm tra trực quan trên desktop/mobile: danh sách Sổ tay, collection Khám phá Việt Nam, tìm kiếm và trang chi tiết; không mất tên địa danh hay cắt mất cuốn sổ trong ảnh chính. Gallery/phóng to hiển thị đúng mẫu.
- Ba URL sản phẩm cũ vẫn hoạt động, mười URL mới mở được; không ảnh hưởng các sản phẩm khác.
- Chạy `npm run check`, `npm run build`; kiểm tra browser trên bản local đã build và lưu ảnh bằng chứng. Build đạt không được báo là production đã cập nhật.

## Trạng thái

Đã kiểm kê và xem trực tiếp 13 file nguồn, tổng khoảng 98,8 MiB; đã đối chiếu ba sản phẩm bản đồ hiện có và ảnh chính cũ. Người dùng đã duyệt thiết kế sau khi chốt quy tắc tên “Sổ tay bản đồ + địa danh”. Chưa chuyển đổi ảnh, sửa dữ liệu sản phẩm, build hoặc deploy cho thay đổi này.
