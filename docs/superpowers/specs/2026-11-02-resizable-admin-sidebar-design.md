# Sidebar admin thay đổi độ rộng

## Mục tiêu và phạm vi

Cho phép kéo mép phải sidebar trên desktop để thay độ rộng mà không ảnh hưởng cuộn menu, tài khoản, dropdown hoặc phần nội dung. Người dùng chọn cách1: lưu độ rộng trên trình duyệt và khôi phục sau reload. Chỉ sửa local, chưa push/deploy; không thêm dependency.

## Cách tiếp cận

Hai lựa chọn đã trình bày: nhớ độ rộng sau reload hoặc chỉ giữ trong phiên mở. Người dùng chọn lưu lâu dài để không phải kéo lại. Dùng CSS grid/CSS variable cùng Pointer Events của trình duyệt, phù hợp stack hiện có; không thêm thư viện layout. Giữ state resize tách khỏi dữ liệu nghiệp vụ.

## Hành vi đã đề xuất

- Mặc định236px; kéo trong khoảng220–400px. Giới hạn thực tế tối đa còn phụ thuộc viewport, giữ phần nội dung ít nhất640px ở breakpoint desktop1024px trở lên.
- Handle nằm ở mép phải, ngoài vùng cuộn nội dung của sidebar; không chắn scrollbar hoặc liên kết. Có tín hiệu hover/focus và cursor resize, không thêm thanh chiếm diện tích nội dung.
- Pointer capture giữ thao tác khi con trỏ ra khỏi handle; kết thúc hoặc hủy kéo phải dọn trạng thái/cursor. Không chọn chữ khi đang kéo.
- Separator có tên tiếng Việt, aria orientation/value/min/max; phím trái/phải thay10px, Home/End về giới hạn. Nhấp đúp về236px.
- Lưu preference riêng trong localStorage sau khi kết thúc thao tác; dữ liệu hỏng hoặc storage không khả dụng dùng mặc định, không làm crash admin.
- Thu gọn vẫn72px; mở lại khôi phục độ rộng đã chọn. Tablet768–1023px vẫn70px, mobile vẫn drawer; không hiện handle ở các chế độ này.
- Khi viewport nhỏ lại, clamp độ rộng hiển thị nhưng giữ preference để khôi phục khi mở rộng. Không thay đổi dữ liệu, phiên đăng nhập hoặc theme.

## Kiểm chứng

Regression cho clamp, preference hỏng/lỗi storage, pointer cancel và keyboard; kiểm tra kéo thực trên browser, reload, double-click, thu gọn/mở lại, sidebar scroll và dropdown. Đối chiếu desktop1024/1440px và tablet/mobile, sáng/tối; không tràn ngang toàn trang. Chạy TypeScript, các test liên quan và build; cập nhật preview local để người dùng review.
