# Responsive fixes — BiBi Studio

Ngày: 2026-11-01. Trạng thái: chờ người dùng duyệt thiết kế; chưa sửa product code.

## Mục tiêu

Giữ phong cách, bố cục chính và nội dung hiện tại; sửa các điểm hiển thị, khó đọc và khó thao tác được kiểm chứng trên desktop/mobile. Người dùng chọn phương án 1: sửa theo lỗi thực tế.

## Các hướng đã cân nhắc

1. Sửa lỗi kiểm chứng được (đã chọn): thay đổi nhỏ, có bằng chứng trước/sau; giữ giao diện quen thuộc.
2. Chuẩn hóa toàn site: đồng bộ lề/khoảng cách/kích thước nút rộng hơn; thay đổi nhiều hơn nhu cầu hiện tại nên không chọn.

## Thay đổi chắc chắn

Trang chủ đang lấy ba sản phẩm explore-vietnam bằng slice(0,3). Hiển thị bốn sản phẩm theo thứ tự catalogue hiện tại; dùng hai cột/hai hàng để không còn ô trống. Đề xuất kỹ thuật của người triển khai: giữ 2×2 cả trong cột nội dung desktop vì khu vực này chỉ chiếm khoảng nửa chiều rộng trang.

## Slider đầu trang chủ — bổ sung đã xác nhận

Bỏ chú thích/link ở góc trái phía dưới ảnh HeroSlides (ví dụ Bàn giấy của BiBi hoặc tên bộ sưu tập); giữ phần tiêu đề chính bên ngoài ảnh. Thay các vạch chuyển ảnh bằng chấm tròn. Đề xuất thể hiện: đặt giữa phía dưới ảnh, chấm nhỏ với trạng thái active rõ, nền nhẹ để đọc được trên ảnh sáng/tối; mỗi nút có vùng bấm ít nhất44×44px, tên truy cập, trạng thái hiện tại và focus bàn phím. Dùng Lovable góp ý thiết kế, áp dụng local sau khi duyệt; không để Lovable tự triển khai cloud.

Giữ nguyên ảnh, alt text, chuyển ảnh tự động5500ms và reduced motion; không thêm thư viện. Các link khám phá bộ sưu tập ngoài slider vẫn giữ. So với giữ vị trí góc phải, đặt giữa là lựa chọn đề xuất để cân đối sau khi bỏ caption, chưa phải yêu cầu gốc của người dùng.

## Rà soát và giới hạn sửa

Dùng review source từ Lovable làm danh sách nghi vấn, không coi suy luận là lỗi đã chứng minh. Kiểm tra trang chủ, danh sách sản phẩm và bộ lọc, loại sản phẩm, bộ sưu tập/danh sách và chi tiết, chi tiết sản phẩm/gallery/fullscreen, tìm kiếm, nhật ký/bài viết, giới thiệu, liên hệ, header/menu/footer/nút liên hệ và API-test.

Đo ở chiều rộng CSS360,390,768,1024,1440; kiểm tra thêm màn hình thấp360×640 cho menu/filter/search. Chỉ chỉnh khi thấy tràn ngang, chữ/nút bị cắt, vùng bấm khó dùng, chồng lấn hoặc nội dung bị che. Ưu tiên CSS/component hiện có, không thêm dependency. Trường hợp cần đổi bố cục chính hoặc mở rộng phạm vi phải trình lại trước.

## Giữ nguyên

Lora/Inter, bảng màu, nội dung/ảnh/thứ tự catalogue, zoom3×, link bidiary, footer không có wordmark lớn, reduced motion, API và CI/CD. Không thiết kế lại, thêm shop/cart hoặc thay đổi chức năng kinh doanh. Không push/deploy production trong bước review local này.

## Tiêu chí nghiệm thu

- Phần Khám phá Việt Nam có đúng bốn sản phẩm, bố cục2×2.
- Slider không còn caption góc trái; nút tròn chuyển đúng ảnh, active/focus rõ, dễ bấm trên mobile; tiêu đề hero chính giữ nguyên.
- Không tràn ngang ở các trang/kích thước đã kiểm tra; ảnh đã tải phải decode được, phân biệt ảnh lazy chưa tải.
- Menu/filter/search mở đóng và thao tác được; gallery/fullscreen hoạt động; nút liên hệ/back-to-top không che nhau hoặc chặn nội dung quan trọng.
- Font dễ đọc, tiêu đề không bị cắt, header tablet không va chạm; reduced motion được tôn trọng.
- Check/build đạt và preview local có ảnh bằng chứng trước/sau cho lỗi đã sửa. Báo rõ trang/kích thước đã kiểm tra và giới hạn chưa kiểm chứng; không tuyên bố thử điện thoại thật nếu chỉ mô phỏng viewport.

## Đầu ra

Bảng phát hiện gồm lỗi xác nhận/nghi vấn không tái hiện, thay đổi tối thiểu tương ứng, kết quả kiểm tra và link preview local để người dùng review. Sau duyệt thiết kế, viết implementation plan trước khi sửa code.
