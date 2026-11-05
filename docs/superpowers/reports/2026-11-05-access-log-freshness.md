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

## Quyết định và bảo toàn nguồn

Owner đã chọn cùng trang có bộ lọc “Log mới / Lịch sử archive”, mặc định Log mới. Log mới là snapshot cache được thay sau cập nhật thành công; archive là lịch sử bền vững. Không âm thầm gộp hai nguồn có request trùng. IP thực vẫn chưa được xác minh: nguồn log không tự bảo đảm chống giả mạo.

Lúc22:10:59 giờ Việt Nam05/11 (15:10:59UTC), đã giữ đủ4gzip archive,175935bytes compressed, tại production/private/access-log-source-preservation/<compressed-sha256>/<basename>. Thư mục0700/file0600, kiểm tra owner/no-symlink và hash bản sao bằng hash nguồn đọc lại; không đổi settings cPanel hoặc xóa nguồn. Cả4sourceUpdated=false, prefixPreserved=true so với mốc14:13UTC: đây vẫn là cùng thế hệ archive, **chưa qua gate cập nhật archive thật**. Bản sao giữ lịch sử Oct/Nov trong lúc chờ prune/cycle, phải đưa vào queue bootstrap trước import nguồn live. Ảnh: [archive đã giữ riêng](C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/bibi-access-log-preservation-20261105.jpg).

Theo [tài liệu Raw Access của cPanel](https://docs.cpanel.net/cpanel/metrics/raw-access/), thống kê mặc định xử lý mỗi24giờ và thay đổi chu kỳ thuộc quản trị server; lịch importer của ứng dụng là một việc riêng.

Kiểm tra lại lúc23:16:50VN05/11 (16:16:50UTC) qua terminal cPanel: cả4archive vẫn `sourceUpdated=false`, `prefixPreserved=true`, byte expanded lần lượt68487/374386/777355/801653. Chưa có chu kỳ mới để chứng minh prefix qua cập nhật thật; không kích hoạt xử lý stats thủ công hoặc sửa nguồn nhằm tạo bằng chứng.
