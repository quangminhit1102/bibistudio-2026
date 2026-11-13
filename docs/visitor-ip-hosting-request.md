# Yêu cầu gửi Tino: IP khách cho bibistudio.vn

**Bản nháp để chủ website gửi. Ngày13/11/2026 chủ website xác nhận chưa gửi; agent chưa liên hệ Tino.**

Chào đội hỗ trợ Tino,

Website `bibistudio.vn` chạy React và Node.js/Express qua cPanel/Passenger tại `h217103.tino.org`. Chúng tôi cần ghi nhận IP công khai đúng của khách trong trang quản trị có đăng nhập.

Lần đo ngày05/11/2026 cho thấy socket tới Node là loopback, request thường chưa có nguồn IP đáng tin và header `X-Forwarded-For` client tự gửi có thể đi xuyên tới ứng dụng. Đây là bằng chứng lịch sử, chưa phải kết luận về cấu hình hiện tại. Express đang giữ trust proxy tắt để tránh ghi IP giả.

Nhờ Tino kiểm tra và hỗ trợ:

1. Chuyển IP client từ kết nối thực ở LiteSpeed/Passenger/proxy vào Node. Loại bỏ hoặc ghi đè header IP không đáng tin phía client; ưu tiên cơ chế X-Forwarded-For được xử lý đúng tại proxy.
2. Cung cấp topology và địa chỉ/CIDR proxy ngay trước Node mà ứng dụng được phép tin. Không bật trust mọi proxy hoặc tắt WAF/bảo mật.
3. Nếu dùng secure client-address của Passenger thay vì X-Forwarded-For, xin xác nhận cơ chế, tên header và bảo đảm chống giả mạo trên gói hosting này.
4. Xác nhận hành vi HTTPS, hostname chính/www, IPv4/IPv6 và cách phục hồi cấu hình khi có lỗi.

Chúng tôi sẽ phối hợp thử từ hai mạng ngoài hosting và gửi header IP giả/chuỗi nhiều IP để xác nhận kết quả vẫn là IP nguồn thực; sau đó mới bật cấu hình ứng dụng và kiểm tra login/refresh/rate limit.

Xin cho biết gói hosting hiện tại hỗ trợ phương án nào và đội Tino có thể thực hiện bước nào. Không cần cung cấp mật khẩu, token hoặc raw access log trong ticket.

Tham khảo: [Express reverse proxy](https://expressjs.com/en/guide/behind-proxies/), [Passenger secure headers](https://www.phusionpassenger.com/docs/advanced_guides/in_depth/node/secure_http_headers.html).
