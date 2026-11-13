# Kiểm tra nguồn IP qua cPanel — 13/11/2026

## Kết luận có bằng chứng

cPanel Visitors ghi IP công khai cho cả request website và /api. Tuy nhiên app Node thử nghiệm riêng trên cùng domain chưa nhận nguồn IP chống giả mạo. Không bật trust proxy hoặc CLIENT_IP_SOURCE_VERIFIED trong lần kiểm tra này. Không sửa backend chính, DB, receiver, cron hoặc phát hành production.

## Phạm vi và phương pháp

- Thao tác qua phiên Edge/cPanel đã đăng nhập của chủ website. Host terminal báo h216108.tino.org dù URL đăng nhập là h217103.tino.org; không suy luận topology từ tên host.
- Visitors SSL của vhost bibistudio.vn.vhplastic.com hiển thị 544 record tại thời điểm xem, gồm IP công khai của request /api và asset. Đây là log request, chưa tự chứng minh định danh cookie/phiên hoặc chống giả mạo.
- App thử độc lập: /home/vhplasti/bibi-node-test/app.js, PassengerBaseURI /node-test. API chính dùng app root /home/vhplasti/bibi-deploy/production/app và base /api; không sửa app này.
- Probe tạm trên node-test: Bearer ngẫu nhiên độc lập, hết hạn 15 phút, không trả raw IP/header/env, chỉ HMAC tag/loopback/số thành phần của 5 trường IP cố định. Giữ response app thử thông thường.
- Gửi 8 request từ hosting qua HTTPS public: normal, repeat, XFF, X-Real-IP, Forwarded, chuỗi XFF nhiều IP, !~Passenger-Client-Address, biến thể underscore. Địa chỉ giả dùng dải tài liệu.

## Kết quả quan sát

| Trường hợp                     | HTTP | Kết quả ở Node thử                                                                   |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------ |
| Normal, repeat                 | 200  | Socket loopback; XFF/X-Real-IP/Forwarded/secure client-address đều thiếu             |
| XFF giả                        | 200  | XFF tag khớp đúng địa chỉ giả                                                        |
| X-Real-IP giả                  | 200  | X-Real-IP và XFF cùng khớp địa chỉ giả                                               |
| Forwarded giả                  | 200  | Giá trị tự gửi đi vào app                                                            |
| XFF hai địa chỉ                | 200  | Giữ chuỗi hai thành phần                                                             |
| !~Passenger-Client-Address giả | 200  | Trường secure mang tag khớp địa chỉ giả; không thể mặc định là secure Passenger thật |
| X_Forwarded_For                | 200  | Không xuất hiện trong các trường IP đã đo; không suy luận cơ chế loại bỏ cụ thể      |

Đặc tả Passenger chuẩn nói header !~ được bảo vệ, nhưng phép đo hiện tại không đáp ứng giả định đó. Không dùng tài liệu chung thay bằng chứng host: https://www.phusionpassenger.com/docs/advanced_guides/in_depth/node/secure_http_headers.html.

Request từ Windows tới bibistudio.vn bị reset kết nối TLS, kể cả /api/ready thông thường và thử HTTP/1.1 với đúng IP DNS. Không có kết quả ứng dụng từ nguồn ngoài hosting trong lần này; không coi lỗi kết nối là bằng chứng app chặn header. Chưa đo hai mạng ngoài, IPv6 hoặc www; chưa đo trực tiếp header bên trong API production. Kết luận chỉ áp dụng app thử và nguồn hosting đã đo, đủ bác bỏ việc bật tin mọi forwarded header.

## Khôi phục

Khôi phục byte gốc app thử, đối chiếu trước khi xóa đúng file backup tạm. SHA256 gốc/khôi phục: 2692b26d2d154d294f3ea6a8f1e426f24acb48f3ccffc0ac4d7b6b77d5b0cf9. Restart riêng node-test; URL probe sau khôi phục chỉ trả response bibi-node-test thông thường, không còn payload probe. Backup tạm đã gỡ. Bản app thử sau restart báo Node v24.22.3 (trước restart v24.22.1); không chủ động nâng runtime.

Production /api/ready trả ok:true. /api/version vẫn release 3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf-43259550001. Không phát hành source analytics mới.

Ảnh ma trận thực tế: .superpowers/visitor-analytics-review/cpanel-ip-check-matrix.png. Probe không được giữ làm tính năng sản phẩm. Credential thử chỉ ở workspace local bị gitignore; không ghi trong tài liệu này.

## Bước tiếp theo

Ưu tiên Tino sửa nguồn IP tại tầng web server/Node để giữ kiến trúc hiện tại. Cung cấp kết quả app thử, nhờ họ xác minh cấu hình thật của /api, tên cơ chế nguồn IP và cách chống header client giả. Sau đó cần đo API qua ít nhất hai mạng ngoài và kiểm tra hostname/IPv6 trước khi bật trust. Có thể dùng IP trong raw log cho báo cáo request riêng, nhưng không coi ghép IP/thời gian là bằng chứng chắc chắn của phiên cookie.
