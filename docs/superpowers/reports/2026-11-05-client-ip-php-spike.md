# PHP client-IP spike — kết quả thực tế 05/11/2026

## Kết luận

PHP gateway có điều kiện là phương án khả thi trên hosting hiện tại: request trực tiếp không có header chuyển tiếp IP nhận địa chỉ nguồn bên ngoài qua REMOTE_ADDR; gateway phải từ chối các header chuyển tiếp trước khi dùng giá trị này. Chỉ đọc REMOTE_ADDR rồi ký lại là không đủ an toàn trên hosting đã đo.

Đây là bản thử được owner duyệt, không phải gateway production. Chưa thay đường đi của collector hoặc login/refresh; chưa hoàn tất yêu cầu IP thật của ứng dụng đang live. Cần chốt phương án, thiết kế và plan trước khi triển khai.

## Đã chạy

Tạo probe PHP riêng dưới một thư mục .well-known ngẫu nhiên, không đổi routing/app/DB. Key HMAC độc lập ở private0600 ngoài webroot; không dùng secret auth hoặc analytics. Probe chỉ trả prefix IP đã che, tag HMAC theo IP, nonce, thời điểm và chữ ký; không trả/lưu raw IP, UA, phpinfo hoặc environment. PHP CLI lint thành công; PHP thực sự chạy qua HTTPS.

### Probe chưa có bộ chặn header

- Request từ Windows: hai request bình thường và hai request có header giả đều nhận cùng địa chỉ nguồn của mạng local.
- Request từ hosting: hai request bình thường nhận địa chỉ mạng hosting, nhưng hai request có X-Forwarded-For/X-Real-IP/Forwarded giả làm REMOTE_ADDR đổi sang địa chỉ giả.
- Đây là bằng chứng không thể mặc định REMOTE_ADDR luôn chống giả mạo. Phép thử chỉ xác định hành vi; chưa khẳng định chính xác directive nào của LiteSpeed gây ra khác biệt này.

### Probe có bộ chặn header

Từ chối request có một trong các biến HTTP_X_FORWARDED_FOR, HTTP_X_REAL_IP, HTTP_FORWARDED, HTTP_CLIENT_IP, HTTP_CF_CONNECTING_IP, HTTP_TRUE_CLIENT_IP, HTTP_X_CLUSTER_CLIENT_IP trước khi tạo payload ký.

Chạy cùng12 trường hợp từ Windows và hosting, tổng24 request:

| Trường hợp | Windows | Hosting |
| --- | --- | --- |
| Bình thường và lặp lại | 2 lần200, cùng tag trong từng mạng, không loopback | 2 lần200, cùng tag trong từng mạng, không loopback |
| Mỗi header trong7 header bị cấm | 7 lần403 | 7 lần403 |
| Header kết hợp | 403 | 403 |
| Biến thể underscore X_Forwarded_For | 403 | 403 |
| Chuỗi nhiều địa chỉ X-Forwarded-For | 403 | 403 |

- Hai nguồn có tag IP khác nhau, xác minh bằng private key trên hosting; không suy luận chỉ từ tên nguồn.
- Payload ký bằng PHP được Node xác minh:2 payload từ Windows và2 payload bình thường từ hosting. Payload bị sửa có HMAC khác chữ ký gốc.
- Mẫu HTTP thông thường: Windows101ms lần đầu/7ms lặp lại; hosting123ms lần đầu/7ms lặp lại. Các request bị chặn7–19ms ở Windows và4–45ms ở hosting. Đây là mẫu nhỏ của probe HTTP, không phải load test hoặc benchmark toàn gateway.
- Ép hết hạn cấu hình thử:404. Đã xóa chính xác probe, thư mục rỗng, key và hai file kết quả phía hosting; endpoint sau xóa404.
- Production readiness200; release vẫn `e7257b4962d1afd7689234c70cb65fb176e828d3-41852205705`. Không thay database hoặc ứng dụng production.

Ảnh thật trong visualization workspace:

- `bibi-php-ip-spike-two-networks.jpg`: hai mạng, chữ ký và các trường hợp giả header.
- `bibi-php-ip-spike-cleanup.jpg`: hết hạn, gỡ probe/key, readiness và release giữ nguyên.

## Điều kiện của phương án đề xuất

1. Website nhận request trực tiếp; không có CDN/proxy hợp lệ cần các header bị cấm. Nếu sau này thêm Cloudflare/CDN phải thiết kế lại nguồn IP và trust boundary, không âm thầm bỏ bộ chặn.
2. Gateway không nhận IP do frontend khai. Chỉ relay một danh sách route/method cố định, không làm proxy URL tùy ý.
3. Production cần ký method/path/body hash/IP/timestamp/nonce, secret riêng ngoài webroot, giới hạn thời gian và chống replay ở Express. Chữ ký của probe chưa triển khai toàn bộ các bảo vệ này.
4. Collector và login/refresh phải từ chối đường gọi bỏ qua gateway theo thiết kế production; không chấp nhận request thiếu bằng chứng đáng tin rồi dùng loopback thay thế.
5. Cần kiểm thử cookie HttpOnly/Secure/path, refresh rotation/single-flight, DNT/GPC/opt-out, CORS/origin, body limit, rate limits và lỗi upstream; không chỉ kiểm tra IP.
6. IP là IP mạng đi ra Internet, có thể thuộc NAT/VPN. Giữ cookie làm định danh trình duyệt/phiên và giữ chính sách che IP đã duyệt.
7. Cần đưa gateway/config vào artifact/deploy/rollback có kiểm tra tương thích. Không giữ probe làm sản phẩm và không hotfix PHP vào đường production ngoài quy trình đó.

Tino sửa nguồn IP tại LiteSpeed/Passenger vẫn là cách có ít lớp hơn nếu có quyền hỗ trợ phù hợp. Với quyền cPanel hiện có, gateway có bộ chặn header là đề xuất chủ động được và đã có bằng chứng khả thi; chờ owner chốt trước khi viết thiết kế triển khai.
