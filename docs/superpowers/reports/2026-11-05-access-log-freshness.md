# Đo nguồn log và tần suất cập nhật

Chỉ là recon và kiểm chứng local; feature chưa deploy production.

Owner đổi yêu cầu từ hằng ngày sang cập nhật nhanh, không realtime, có nút tải lại; giao agent chọn chu kỳ. Chọn một job mỗi15phút. Nút tải lại lấy DB, không chạy importer hoặc đọc file từ HTTP.

## Đo trên hosting thật05/11

Edge/cPanel h217103.tino.org:2083 đã đăng nhập; terminal báo hostname h216108. Đọc file đúng domain dưới /home/vhplasti/access-logs và /home/vhplasti/logs bằng Node24; không in IP/UA/raw request. Không thay cấu hình archive hoặc xóa nguồn.

-14:00:58UTC: archive Nov HTTP372 dòng/68487bytes expanded, SSL3444/777355; Oct HTTP1966/374386, SSL3610/801653. Tổng9392 nonempty lines tại thời điểm đo, không phải số người hay số dòng đã nhập DB.
- Archive Nov mtime13:52:11UTC; tăng từ recon cũ, nhưng chưa có hash snapshot cũ để chứng minh giữ nguyên prefix.
-14:01:37UTC: request đánh dấu trên API chưa xuất hiện trong current SSL (188bytes, mtime13:27:53UTC).
-14:04:14UTC: thêm request trang sản phẩm; các marker vẫn chưa thấy. Một request API từ local lúc14:04:42UTC nhận200, Date14:04:40GMT, LiteSpeed, Cache-Control:no-store, không có cache-hit header.
-14:13:07UTC: current HTTP1191bytes/mtime14:07:31UTC; SSL1697bytes/mtime14:10:27UTC. Cả ba marker API/browser, product/browser và API/local đều đã xuất hiện trong SSL. Độ trễ API/browser quan sát khoảng9phút; không suy ra upper bound bảo đảm từ một phép thử.
- Server timezone đo +420phút; lịch */15 không cần quy đổi giờ cố định.

Đã ghi private/access-log-source-proof.json trên hosting,0600, chỉ gồm tên source/mtime/byte/hash/capturedAt. File không chứa raw log hoặc credentials. Cần so hash prefix sau **lần cPanel cập nhật archive thật**; không dùng recompress mô phỏng làm acceptance.

Ảnh bằng chứng: [terminal đo freshness](C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/bibi-log-freshness-20261105.jpg).

## Quyết định còn mở

Khảo sát cho thấy current log có thể mới hơn archive; chỉ tăng tần suất đọc archive không đủ cho yêu cầu mới. Đã đề xuất cùng trang có phạm vi “Log mới / Lịch sử archive”, mặc định Log mới, thay vì âm thầm gộp hai nguồn có request trùng. Đang chờ lựa chọn hiển thị trước khi triển khai adapter/current retention. IP thực vẫn chưa được xác minh: nguồn log không tự bảo đảm chống giả mạo.

Theo [tài liệu Raw Access của cPanel](https://docs.cpanel.net/cpanel/metrics/raw-access/), thống kê mặc định xử lý mỗi24giờ và thay đổi chu kỳ thuộc quản trị server; lịch importer của ứng dụng là một việc riêng.
