# PHP relay routing spike — 13/11/2026

Kết quả: **PASS cho gate định tuyến**, chưa phải nghiệm thu tính năng IP/location.

Đã đo child `PassengerEnabled off` tại đường tạm nằm dưới `/node-test/analytics` và `/api/analytics`. Không đổi root/API/node-test routing có sẵn. PHP hosting thực tế **8.3.36**. Lần GET đầu ở API còn vào Express; sau reload PHP hoạt động. Vì vậy bước phát hành phải kiểm tra readiness của chính PHP sau khi tạo child, không suy luận chỉ từ việc ghi file.

Hai nguồn độc lập: Edge bên ngoài hosting và curl HTTP/1.1 từ hosting. Mỗi nguồn chạy cùng 9 trường hợp ở cả hai scope:

| Trường hợp | Kết quả |
| --- | --- |
| Bình thường, lặp lại | 200, IP public, signed peer tag ổn định, cookie synthetic được nhận |
| X-Forwarded-For, X-Real-IP, Forwarded, underscore, !~Passenger-Client-Address, chuỗi nhiều IP | 403 có chữ ký của PHP |
| Body 16,385 byte | 413 có chữ ký của PHP |

HMAC được kiểm tra thật cho 36 response. Edge receipts được kiểm tra lại bằng `node scripts/php-routing-spike.mjs --verify <ignored receipt> test|candidate`; hosting kiểm tra HMAC tại chỗ trước cleanup. Không xuất raw IP, cookie hay secret. Cookie synthetic HttpOnly/Secure/Lax dùng đúng scope `/api/analytics`; chưa chuyển cookie thật của khách hoặc dữ liệu vào collector. PHP không phải JavaScript giả lập. Chưa đo IPv6, cả hai hostname hoặc bộ header mở rộng; các phần đó vẫn thuộc acceptance sau tích hợp.

Lần chạy Python urllib POST đầu bị remote disconnect, không được tính đạt. Curl thay thế đạt ma trận; Python trên hosting là 3.6 nên dùng stdout/stderr PIPE thay capture_output. Một lệnh cleanup gõ dài bị cắt giữa chừng, chưa thực thi; đã mở terminal mới và thực hiện script nén hoàn chỉnh, xác nhận exit/result thật.

Cleanup đã gỡ đúng collect.php/.htaccess của probe, thư mục analytics chỉ do probe tạo, config/key tạm và artifact curl. Xác nhận private probe directory không còn. Hai URL không còn trả HTML/response probe: API trở lại Express ORIGIN_REJECTED, node-test trở lại ứng dụng Node ban đầu. Hash root/API/node-test .htaccess không đổi so baseline; `/api/ready` trả ok=true và `/api/version` vẫn release `ee12307cf68f45484d59c3b77c2f6f7f83a07f47-43382604855`, source `ee12307cf68f45484d59c3b77c2f6f7f83a07f47`.

Bằng chứng riêng (gitignored): `.superpowers/sdd/2026-11-13-visitor-ip-relay/routing-spike/`, gồm browser receipts, candidate-browser.png và cleanup-production.png. Driver throwaway được lưu trong scripts; không cài probe vào artifact phát hành. Chỉ dùng kết quả này để tiếp tục implementation theo kế hoạch đã duyệt, không đánh dấu IP đã xác minh hay feature đã deploy.
