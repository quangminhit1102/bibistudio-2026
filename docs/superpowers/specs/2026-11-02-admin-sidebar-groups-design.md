# Nhóm menu sổ xuống cho sidebar admin

## Mục tiêu và lựa chọn đã chốt

Tiêu đề nhóm là nút đóng/mở có một chevron đơn giản bên phải; mỗi liên kết con có icon phía trước. Người dùng chọn mở nhiều nhóm đồng thời và cấu trúc hai cấp. Chỉ cập nhật local để review, không push/deploy.

Hai hướng đã trình bày: đưa mọi liên kết về hai cấp hoặc giữ các menu lồng ba cấp. Người dùng chọn hai cấp để thao tác ít lần hơn. Tận dụng React, icon Lucide, permission và route hiện có; không thêm dependency hoặc đổi URL/nghiệp vụ.

## Danh sách nhóm

| Nhóm | Các liên kết con, theo thứ tự |
| --- | --- |
| Tổng quan | Bảng điều khiển; Khách truy cập |
| Quản lý sản phẩm | Danh sách sản phẩm; Thêm sản phẩm; Danh mục; Tồn kho |
| Kinh doanh | Khách mua hàng; Phiếu mua hàng; Báo cáo |
| Nội dung | Bài viết; Viết bài mới; Chuyên mục; Thẻ; Thư viện ảnh |
| Quản trị | Người dùng; Vai trò; Phân quyền; Nhật ký hệ thống; Cài đặt chung; Giao diện; Hồ sơ; Tổng quan thành phần UI; Hành động; Biểu mẫu; Dữ liệu; Điều hướng; Hộp thoại; Phản hồi; Biểu đồ |

Giữ năm nhóm hiện tại. Các mục con cũ của Bài viết/Cài đặt/Thành phần UI được chuyển thành liên kết có icon cùng cấp trong nhóm tương ứng. Đổi nhãn Cài đặt thành Cài đặt chung và Thành phần UI thành Tổng quan thành phần UI để rõ điểm đến; URL giữ nguyên.

## Hành vi đề xuất để duyệt

- Nhấn tiêu đề chỉ đóng/mở nhóm, không điều hướng; chevron quay theo trạng thái. Enter/Space hoạt động, có aria-expanded/aria-controls và focus rõ.
- Lần đầu chỉ mở nhóm chứa trang hiện tại; các nhóm khác đóng. Đổi trang tự mở nhóm chứa trang mới, không đóng các nhóm khác. Người dùng vẫn có thể tự đóng nhóm đang chứa trang hiện tại.
- Nhớ các nhóm đang mở trên trình duyệt sau reload, bằng preference riêng; dữ liệu hỏng/storage bị chặn không làm crash. Khi reload vẫn mở nhóm chứa trang hiện tại để thấy vị trí đang xem.
- Giữ lọc theo permission, không hiện nhóm rỗng, không hiện Thêm sản phẩm/Viết bài mới khi thiếu quyền tạo. Trang chi tiết/chỉnh sửa cũng xác định đúng nhóm và mục danh sách tương ứng.
- Khi sidebar thu gọn hoặc ở tablet chỉ có icon: giữ các liên kết icon hiện tại, không giấu chức năng theo trạng thái nhóm; tooltip/title chỉ rõ tên. Mở rộng lại khôi phục trạng thái nhóm đã lưu.
- Drawer mobile dùng cùng menu hai cấp, cùng trạng thái đóng/mở; chọn liên kết vẫn đóng drawer. Giữ sidebar cuộn toàn bộ, profile hai vị trí, kéo độ rộng và các giới hạn220–400px hiện có.

## Kiểm chứng

Test mở nhiều nhóm, lưu/khôi phục và lỗi storage, route chi tiết, permission, keyboard, compact/mobile. Browser kiểm tra mở/đóng, active item, cuộn, dropdown tài khoản, kéo độ rộng ở desktop1024/1440px và tablet/mobile; sáng/tối và không tràn ngang. Chạy TypeScript, regression liên quan, build và kiểm chứng artifact preview trước bàn giao.
