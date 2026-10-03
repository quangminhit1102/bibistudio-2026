# Hoàn thiện catalogue ảnh thật và nhận diện BiBi Studio

## Mục tiêu
Biến catalogue hiện tại từ dữ liệu minh họa thành một catalogue giàu hình ảnh thật, đồng thời cập nhật logo và nội dung thương hiệu nhưng vẫn giữ phong cách giấy thủ công, tối giản và dễ xem trên điện thoại.

## Sản phẩm và hình ảnh
- Phân loại toàn bộ ảnh trong `public/Images` theo ba nhóm hiện có: sổ tay, thiệp Áo dài và magnet.
- Thay danh sách sản phẩm mẫu bằng các mẫu thật nhận diện được từ tên file: địa danh Sài Gòn/Hà Nội/Đà Nẵng, món ăn Việt và các mẫu Áo dài.
- Dùng ảnh GPT đã làm sạch làm ảnh đại diện khi có; ảnh chụp tay tương ứng sẽ làm ảnh phụ trong trang chi tiết. Không tạo thêm ảnh giả cho sản phẩm chưa có tư liệu.
- Chuẩn hóa đường dẫn/tên ảnh dùng trong ứng dụng và tối ưu dung lượng hiển thị để catalogue tải nhanh, không bị méo hoặc cắt mất sản phẩm.
- Giữ đúng cấu trúc catalogue thương hiệu: không giá, không giỏ hàng; mỗi sản phẩm dẫn tới liên hệ BiBi Studio.

## Nội dung sản phẩm
- Viết tên, mô tả ngắn và câu chuyện riêng bằng tiếng Việt cho từng nhóm/mẫu, dựa trên hình ảnh và địa danh có thật.
- Thêm mô tả tiếng Anh tương ứng để sẵn sàng cho phiên bản EN sau này.
- Chỉ mô tả cảm hứng, hình ảnh và mục đích sử dụng; không tự đặt kích thước, chất liệu, số trang hay thông số chưa được cung cấp.
- Cập nhật bộ lọc và các bộ sưu tập để số lượng/kết quả phản ánh catalogue thật; nhóm chưa có ảnh vẫn hiển thị trạng thái sắp ra mắt thay vì dùng ảnh giả.

## Logo mới
- Dựng lại logo ngang `bibistudio.vn · touch your heart` từ bảng logo thành phiên bản vector sắc nét, nền trong suốt và co giãn tốt.
- Dùng bản ngang cho đầu/cuối trang; dùng biểu tượng vuông “bibi” cho dấu nhận diện nhỏ và favicon phù hợp.
- Điều chỉnh kích thước trên điện thoại để logo rõ nhưng không ép menu hoặc nút gọi.

## Trang Về BiBi Studio
- Mở rộng thành câu chuyện thương hiệu có nhịp đọc rõ: khởi nguồn, cảm hứng Việt Nam, cách BiBi kể chuyện qua giấy và lời mời kết nối.
- Dùng ảnh thương hiệu/sản phẩm đã tải lên để tạo các khoảng nghỉ hình ảnh tự nhiên; không thêm tuyên bố về quy trình hoặc chất liệu chưa được xác nhận.

## Kiểm tra hoàn thiện
- Kiểm tra trang chủ, danh sách sản phẩm, từng loại sản phẩm, ba bộ sưu tập có ảnh, trang chi tiết, Về BiBi và Liên hệ.
- Kiểm tra trên điện thoại và desktop: logo, ảnh không méo/cắt sai, chữ không tràn, thanh liên hệ không che nội dung, các mục bấm đủ dễ thao tác.
- Kiểm tra lỗi tải ảnh, liên kết sản phẩm và trạng thái biên dịch trước khi bàn giao.

## Giả định thực hiện
- Ảnh GPT đã cập nhật được ưu tiên làm ảnh đại diện; ảnh chụp tay được giữ làm ảnh bổ sung khi khớp cùng mẫu.
- Tên địa danh/món ăn lấy trực tiếp từ tên file; mọi thông số sản xuất chưa có sẽ tiếp tục được ẩn.
