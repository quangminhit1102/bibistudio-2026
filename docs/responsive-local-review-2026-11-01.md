# Responsive local review — 01/11/2026

## Trạng thái

Hoàn thành thay đổi và kiểm chứng local theo thiết kế được duyệt. Chưa push hoặc deploy production.

Source build: `36b2721df0deca88e334d1e3a86eeb9dee42d653`.
Preview: http://127.0.0.1:4176/ (4174 là bản cũ;4175 là bản trung gian).
Release: `local-36b2721df0deca88e334d1e3a86eeb9dee42d653`.

## Lovable

Dùng project a92fe95d-ba22-47c3-be74-9ed93eadfc00. Audit source message umsg_01m6ar1amjfeqr7ys97ne9cyvt; đề xuất hero message umsg_01m6as0502fqhbbef7d8rnzc20. Đề xuất hero chỉ trả văn bản, không sửa cloud. Audit trước đó có tạo .lovable/plan.md trong project; đây không phải thay đổi runtime giao diện. Các thay đổi runtime lần này được áp dụng local. Không gọi publish.

## Thay đổi và bằng chứng

| Vấn đề | Trước | Sau |
|---|---|---|
| Khám phá Việt Nam |3 cards ở lưới2 cột |4 cards, tọa độ x24/196 và y140/453 tại390px: đủ2×2 |
| Hero |Caption/link góc trái, vạch chỉ thị |Bỏ caption/link trong ảnh; giữ headline chính. Chấm6/8px trên nền mờ, nhóm Chọn ảnh, nút tối thiểu44px, aria-current và focus keyboard. Đã chọn ảnh5 bằng click và ảnh2 bằng Tab/Enter. |
| Header1024 |Các mục nav bị xuống2 dòng |nowrap, gap12px dưới xl; logo kết thúc223.43px, nav bắt đầu290.68px, kết thúc960.8px: không va chạm |
| Liên hệ nổi tablet/desktop nhỏ |Cột nút bắt đầu952.8px trong khi nội dung kết thúc960.8px tại1024 |Chỉ đặt dọc bên phải từ1280px; dưới đó dùng thanh dưới màn hình. Footer và back-to-top đổi breakpoint tương ứng để chừa chỗ |
| Bộ lọc mobile |Body overflow visible, PageDown dịch nền52→612px khi hộp lọc mở |Body hidden, PageDown giữ52→52px; chọn Sổ tay→42 sản phẩm, áp dụng đóng và phục hồi cuộn. Resize lên768 hoặc Escape đóng và phục hồi overflow |

## Phạm vi kiểm tra trình duyệt

65 tổ hợp:13 URL ×5 chiều rộng CSS360,390,768,1024,1440 (cao900). URL: /, /products, /products/notebooks, /collections, /collections/explore-vietnam, /collections/greeting-cards, /collections/vietnamese-food, /products/da-nang-map-notebook, /blog, /blog/goi-qua-handmade-y-nghia-ngay-khai-giang, /about, /contact, /api-test.

Không có document scrollWidth vượt innerWidth trong matrix. Không phát hiện ảnh đã tải có naturalWidth0; ảnh lazy chưa tải và placeholder catalogue không được coi là ảnh hỏng. Matrix là kiểm tra bố cục/trạng thái tải, không tuyên bố mọi pixel của mọi trang đều đã được kiểm duyệt.

Thao tác bổ sung360×640: mở menu/đi tới sản phẩm, tìm Đà Nẵng trả4 kết quả, đóng tìm kiếm, chọn/áp dụng/xóa bộ lọc. Kiểm tra fullscreen390px: mở/đóng được, thanh liên hệ ẩn trong dialog. Kiểm tra trang sản phẩm dưới cùng: back-to-top476–520px, thanh liên hệ548.7–640px ở360×640, floating contact ẩn; không chồng nhau.

Hồi quy: Lora tải được; toàn bộ href Facebook/Messenger quan sát trên detail là bidiary; footer-wordmark0; lens1959.98×2338.87 tương ứng3× ảnh render; API-test báo FE/BE cùng local-36b2721. Không gửi tin nhắn/call.

Nghi vấn không sửa: What we make không tràn; contact tablet có nút Maps xuống dòng nhưng vẫn đủ chữ và bấm được; related carousel có card lộ một phần theo thiết kế cuộn; lề giữa các trang khác nhau không tự coi là lỗi. Không chuẩn hóa toàn site.

Reduced motion: giữ guard hiện có không tạo timer khi prefersReducedMotion và thêm motion-reduce:transition-none cho dots. Công cụ browser không cung cấp media emulation; chưa bật reduced motion hệ điều hành, chưa test runtime chế độ đó hoặc điện thoại vật lý.

## Check/build và review

Node24 check exit0:55 tests,54 pass,0 fail,1 POSIX skip Windows. TypeScript chạy lại sau thay đổi cleanup resize đạt. Build exit0; cảnh báo chunk lớn hiện hữu. Review source độc lập không có critical/important; đã sửa trạng thái duyệt trong spec theo góp ý nhỏ.

Ảnh bằng chứng trong thư mục visualization session: responsive-four-products-mobile.png, responsive-hero-desktop.png, responsive-hero-mobile.png, responsive-header-after.png, responsive-contact-768.png. Matrix dữ liệu: responsive-final-matrix.json. Preview cuối vẫn chạy4176 để người dùng review.
