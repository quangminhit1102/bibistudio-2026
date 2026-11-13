# Khách truy cập — IP nguồn, lịch sử đầy đủ và phân tích theo thời gian

Trạng thái: bản thiết kế chờ chủ website duyệt; chưa triển khai ứng dụng hoặc cấu hình hosting. Builder check độc lập ngày 13/11: không còn câu hỏi quan trọng cần trả lời trước khi lập plan.

## 1. Mục đích và các quyết định đã chốt

Trang Khách truy cập giúp chủ website biết lượt ghé website và sản phẩm được quan tâm, giữ React + Express + MySQL/MariaDB trên cPanel, không thêm dịch vụ analytics hay gateway mới.

Chủ website yêu cầu: IP công khai đầy đủ; ưu tiên Tino sửa nguồn IP tại hosting; bỏ chức năng Nhật ký cPanel; bỏ cột mã khách không có ý nghĩa với người dùng; phiên hiển thị gọn với ngày giờ, sản phẩm và URL; biểu đồ tổng lượt truy cập phía trên bảng và biểu đồ sản phẩm phía sau bảng. Bộ lọc theo sản phẩm được bỏ. Prototype local đã được chủ website đồng ý về bố cục, sau đó làm rõ yêu cầu mới nhất: **giữ toàn bộ lịch sử dữ liệu; chỉ lọc hiển thị theo 1 tháng, 6 tháng, 1 năm gần nhất hoặc khoảng ngày giờ tùy chọn**. Không tự xóa lịch sử thật sau 90 ngày/12 tháng.

## 2. Phương án đã cân nhắc

- **Tino sửa IP tại LiteSpeed/Passenger — chủ website chọn phương án này.** Ít lớp vận hành nhất, tận dụng stack hiện tại; cần đội quản trị hosting xử lý và phối hợp kiểm chứng.
- PHP gateway có chữ ký: đã có spike khả thi nhưng thêm routing, secret, replay protection và vận hành; không thực hiện trong phạm vi được chọn.
- Chỉ bật trust proxy/đọc X-Forwarded-For do client gửi: loại bỏ vì chưa xác minh được nguồn, có thể nhận IP giả. Không lấy IP từ frontend hoặc dịch vụ tra IP bên ngoài.

## 3. Hiện trạng đã kiểm tra

`backend/src/visitors/collector.ts` nhận `req.ip`, lưu prefix /24 hoặc /48, nhận diện trình duyệt bằng cookie ký; mở phiên mới nếu hơn 30 phút không nhận hoạt động. Tracker gom các route khác nhau, gửi theo đợt khoảng 15 giây hoặc khi rời trang. Mỗi URL/sản phẩm liên kết một lần mỗi phiên, có first/last received timestamp; không lưu mọi click, số lần reload hoặc thời lượng đọc. Chỉ ghi route công khai được catalogue cho phép, bỏ query/hash và admin/API/auth.

`ANALYTICS_TTL_MS=90 ngày` hiện dùng chung cho cookie và truy vấn/cleanup. Service lọc dữ liệu 90 ngày, cleanup có thể xóa các bản ghi thật đã hết hạn. Report hiện trả tổng/Top sản phẩm nhưng không có chuỗi thời gian hoặc bộ lọc thời gian thống nhất. Chi tiết phiên dùng page/pageSize và hai nút Phiên trước/Phiên sau.

Biên bản 05/11 ghi nhận socket loopback, header giả đi xuyên đến app, .htaccess thử không khắc phục; không coi đây là phép đo mới của cấu hình 13/11. IP thật đang chưa nghiệm thu. Bản nháp yêu cầu Tino nằm ở `.superpowers/visitor-analytics-review/TINO-support-request.md`, chưa gửi.

## 4. IP và nhận diện khách

Chỉ coi IP là đã xác minh sau khi Tino cung cấp đường chuyển địa chỉ an toàn và topology/allowlist proxy, và kiểm chứng thực tế từ ít nhất hai mạng ngoài hosting. Kiểm tra request bình thường, X-Forwarded-For/X-Real-IP/Forwarded giả, chuỗi nhiều IP và đường gọi bỏ qua proxy. Client không được tự thay đổi IP đã xác minh. Hỗ trợ IPv4/IPv6; chuẩn hóa IPv4-mapped IPv6. Không bật trust proxy=true hoặc tin loopback rộng khi chưa chứng minh topology. Không tắt WAF để thử.

Backend dùng IP nguồn đã xác minh cho analytics và network throttling; vẫn duy trì bucket có giới hạn cho throttle, không đưa raw IP/password/token vào console log. Lưu trường IP đầy đủ cùng trạng thái/nguồn tại phiên để giữ lịch sử khi khách đổi mạng. IP trên dòng khách là IP của phiên gần nhất trong tập phiên được lọc. IP cũ chỉ có prefix hoặc loopback không thể phục hồi: hiển thị Chưa xác định/Chưa xác minh, không suy diễn IP giả hoặc trộn prefix vào trường full-IP. Vị trí vẫn Chưa xác định nếu không có nguồn GeoIP đã kiểm chứng; không gọi dịch vụ ngoài gửi IP khách.

Cookie, không phải IP, nhận diện trình duyệt. Giữ UUID nội bộ và liên kết visitor/session; chỉ bỏ cột ID công khai. Nhiều khách chung NAT/IP vẫn là các visitor riêng. Xóa cookie/đổi trình duyệt/hết hạn cookie có thể tạo visitor mới; không cam kết nhận diện một cá nhân qua nhiều thiết bị. Thời hạn cookie 90 ngày giữ nguyên, **tách khỏi thời hạn lưu dữ liệu**; không tự đổi cookie hiện có hoặc nối các visitor bằng IP.

Full IP hiển thị qua API/UI có xác thực với permission `customer_access.view` hiện tại, gồm User có quyền Khách truy cập theo thiết kế RBAC đã có. Không xuất raw IP ở endpoint public.

## 5. Định nghĩa chỉ số và thời gian (quyết định kỹ thuật đề xuất)

Một phiên là một lượt ghé: mở mới nếu chưa có phiên hoặc hơn 30 phút không ghi nhận; đúng 30 phút vẫn là phiên hiện tại. Thời gian dựa trên thời điểm server nhận batch, không khẳng định chính xác từng thời điểm client click. Hai tab cùng cookie dùng chung logic phiên hiện có; giữ khóa transaction để tránh đếm phiên hai lần.

Để chỉ số cộng được và không đếm lặp ở biểu đồ, **bộ lọc chọn các phiên có started_at thuộc khoảng**. Tất cả KPI, bảng khách, biểu đồ đường và biểu đồ sản phẩm sử dụng cùng tập phiên và bộ lọc thiết bị/trình duyệt/IP. Đây là quyết định của agent, không phải phát biểu đã được owner nêu ra; UI ghi rõ Lượt truy cập là phiên bắt đầu trong khoảng đã chọn.

- Lượt truy cập = COUNT phiên trong tập đã chọn. Mỗi phiên thuộc đúng một bucket trên biểu đồ.
- Khách truy cập = COUNT DISTINCT visitor_id trong tập đó, không cộng distinct theo ngày hoặc IP.
- Khách đã xem sản phẩm = COUNT DISTINCT visitor_id có liên kết sản phẩm trong những phiên đó.
- Top sản phẩm = số visitor_id khác nhau đã xem từng sản phẩm trong những phiên đó. Một khách xem lại trong nhiều phiên vẫn tính một khách cho sản phẩm đó; tổng các thanh có thể lớn hơn tổng khách.
- Các chi tiết của một phiên được trình bày đầy đủ như một lượt ghé, kể cả nó kết thúc sau mốc cuối bộ lọc; không cắt mất URL của phiên qua nửa đêm. Thời điểm Gần nhất ghi rõ thuộc các phiên đang lọc; không lấy phiên mới nhất toàn lịch sử ngoài phạm vi.

Mốc giờ hiển thị/biên khoảng theo Asia/Ho_Chi_Minh; DB/query dùng UTC. Preset 1/6/12 tháng là tháng lịch lùi từ cùng ngày giờ hiện tại, clamp ngày cuối tháng khi cần, không mặc định 30/180/365 ngày. Mặc định 1 tháng. Custom có từ/đến ngày giờ đến giây; hiển thị rõ ngày giờ Việt Nam. API dùng khoảng start-inclusive/end-exclusive; chuyển lựa chọn đến hết một giây thành exclusive +1 giây. Validate from<=to, timestamp hợp lệ; không tự đảo hai giá trị. Thay preset hoặc áp dụng custom reset trang bảng/cursor chi tiết. Mọi request trong một lần tải chia sẻ chính xác from/to cố định để số liệu không lệch do đồng hồ dịch chuyển.

Biểu đồ nhóm giờ/ngày/tuần/tháng/năm theo độ dài khoảng sao cho số bucket có giới hạn, điền các bucket 0. Không cắt ngầm lịch sử, không tải mọi phiên về frontend để tính số liệu. Builder chọn thresholds cụ thể và ghi vào plan/tests. Cho phép custom truy vấn lịch sử ngoài 1 năm; preset 1 năm không phải retention.

## 6. Lưu toàn bộ lịch sử và tải dữ liệu có giới hạn

Giữ các visitor, phiên, liên kết URL/sản phẩm thật đã thu thập, không TTL hoặc cleanup xóa dữ liệu thật. Tách hằng cookie khỏi read/retention, bỏ cutoff 90 ngày, bỏ hoặc vô hiệu chính xác job analytics cleanup có thể xóa lịch sử. Probe/fixture phát hành được đánh dấu is_probe vẫn được cleanup riêng, không hiển thị như khách thật; auth/token cleanup giữ nguyên. Dữ liệu đã bị xóa trước đây và full-IP chưa từng lưu không thể khôi phục.

Giữ cách ghi nhẹ: URL khác nhau mỗi phiên, cập nhật first/last, không ghi một event cho mọi click/reload. Giới hạn hiện có 200 URL/100 sản phẩm mỗi phiên được giữ cho phạm vi này và phải cảnh báo khi truncated; từ ngữ UI là Tất cả URL đã ghi nhận, không hứa đủ các thao tác hay request không thu thập. Route mới hợp lệ phải vào catalogue thu thập. Không âm thầm gửi query/token/search cá nhân trong URL.

Lưu tất cả lịch sử không đồng nghĩa tải tất cả cùng lúc. Bảng khách giữ phân trang server. Chi tiết phiên bỏ nút số trang và dùng cursor + Xem thêm phiên, 20 phiên/lần theo last_received_at,id giảm dần, ghép không trùng, có trạng thái hết dữ liệu/retry. Mỗi phiên đóng/mở, phiên mới nhất mở sẵn; URL dài xuống dòng trên mobile. Thông báo nếu thay khoảng lọc trong khi đang mở chi tiết. Query/index phải phù hợp started_at/visitor/session và IP; IP tìm kiếm được chuẩn hóa, không search UUID làm mặc định.

Theo dõi dung lượng DB và thời gian backup, cảnh báo sớm; không tự prune để đạt quota. Kiểm tra ngưỡng backup hiện tại (128 MiB) và headroom của hosting trước phát hành; nếu không đủ cho giữ lịch sử, đưa ra dung lượng thực và phương án tăng giới hạn/backup phù hợp, không tuyên bố lưu vô hạn trong tài nguyên hữu hạn.

## 7. UI theo bản thử đã review

Giữ thiết kế admin hiện tại, tiếng Việt, light/dark và responsive. Bộ lọc chung: 1 tháng / 6 tháng / 1 năm / Tùy chọn ngày giờ; thiết bị/trình duyệt giữ lại, bỏ sản phẩm. Có nút Tải lại, chỉ đọc lại API; không chạy importer khi bấm.

Thứ tự: tiêu đề + filter → ba KPI → biểu đồ đường tổng lượt truy cập → bảng khách (STT, IP công khai, vị trí, thiết bị–OS, trình duyệt, lượt ghé, gần nhất, Chi tiết) → Top sản phẩm bằng thanh ngang. Dùng Recharts đã có, không thêm chart library. Thanh ngang có tên, giá trị thật, tooltip và cách xem sản phẩm ngoài Top N; không chỉ có màu hoặc cắt mất dữ liệu mà không thông báo. Số đếm/loading/error/empty độc lập nhưng không hiển thị kết quả thuộc khoảng cũ như dữ liệu của khoảng mới.

Popup chi tiết: tóm tắt IP/thiết bị/lượt ghé/sản phẩm; các phiên dạng accordion với ngày giờ, tên sản phẩm, số trang; bên trong là sản phẩm và URL cùng giờ ghi nhận đầu. Không lặp lại Trang đầu/Trang cuối thành nhiều khối dài; không có nút Phiên trước/Phiên sau. Loading thêm không đẩy mất focus/vị trí đọc. Escape, focus return, keyboard và touch phải hoạt động.

Prototype hiện tại ở ignored `.superpowers/brainstorm/232-1794533887/content/visitors-review-v6.html` (các lần trước tại session `34-1794498244`); các IP là dải dành cho tài liệu và phải ghi rõ minh họa. Prototype không phải nguồn IP đã xác minh hoặc dữ liệu live.

## 8. Gỡ Nhật ký cPanel, bảo toàn rollback

Bỏ switch nguồn/log UI, các trang/component chỉ cho log, API truy vấn current/archive, importer/cron sync và các cấu hình runtime chỉ phục vụ tính năng log khỏi luồng hoạt động mới. Không gộp request log thành phiên hoặc đếm ảnh/API/bot vào lượt ghé. Chỉ dừng chính xác cron của importer, không thay toàn bộ crontab hoặc lịch auth.

Không drop bảng, xóa archive gốc của cPanel, các bản sao riêng hoặc ledger migration cũ trong release này: đó là dữ liệu/metadata cần cho backup và rollback, không phải chức năng tiếp tục hiển thị/nhập log. Mọi purge vĩnh viễn là công việc riêng cần xác nhận tại thời điểm thực hiện. Giữ thành phần kiểm tra schema/backup tối thiểu nếu receiver/rollback cần; không để env log không còn dùng làm readiness của app mới thất bại. Update deploy/rollback probes/tests/docs để không bắt buộc importer đã bị gỡ.

Migration analytics phải additive, không phá schema/permission auth. Giữ ip_prefix/columns cũ nếu backend cũ cần. Rollback đổi code nhưng không restore đè DB, không down-migrate, không xóa lịch sử mới. Đặc biệt: job cleanup 90 ngày cũ **không được tự chạy lại sau rollback**, kể cả current trỏ về release cũ; phải xử lý lịch này như thay đổi vận hành bền vững trước activation. Bản cũ có thể vẫn hiển thị giới hạn 90 ngày/IP che nhưng dữ liệu được giữ nguyên.

## 9. Trình tự và điều kiện nghiệm thu

1. Chủ website gửi/phối hợp ticket Tino; chưa có ủy quyền gửi tin nhắn thay chủ website. Thu thập phản hồi về proxy/CIDR và kiểm chứng normal/spoof/two-network. Không khẳng định chỉ đổi env là sửa được IP.
2. Hoàn thiện thiết kế/plan và local UI owner review. Các phần FE/BE có thể chuẩn bị local trong lúc chờ Tino, nhưng không đánh dấu đạt IP hoặc phát hành toàn bộ yêu cầu nếu nguồn IP chưa qua kiểm chứng. Nếu Tino không hỗ trợ, quay lại quyết định phương án, không âm thầm thêm PHP/CDN/chuyển hosting.
3. TDD cho cutoff/retention tách cookie, boundary datetime/tháng/quý/leap day, distinct counts/same IP/different cookies, phiên qua nửa đêm, chart totals/zero buckets, trang mới/URL trùng/truncated, cursor/retry/cancel, RBAC full IP và spoof headers. Migration/backup/rollback/cron phải có test thật giữ lịch sử trên 90 ngày và không kích hoạt lại job xóa cũ.
4. Kiểm chứng trực tiếp local desktop/mobile/filter/custom date-time/chi tiết/sản phẩm/refresh và không còn log UI; synthetic IPv4/IPv6 ghi rõ khi review.
5. Trước production: backup verified và đủ headroom, main CI/check/build và review đạt, nguồn IP được xác minh, kế hoạch rollback đã thử đúng compatible release; chỉ dùng artifact CI thành công. Production-only/manual workflow giữ nguyên. Sau deploy so FE/BE/version/ready, check public product và admin filters/charts/history/IP thật/anti-spoof. Không báo hoàn tất nếu Tino/IP/backup/rollback còn chưa đạt.

## 10. Phạm vi để builder quyết định

Builder chọn tên bảng/cột và feature migration ledger tương thích với receiver, exact SQL/indexes, chart bucket thresholds/cursor encoding, module boundaries và test fixture. Không tự đổi stack, lưu theo IP để định danh người, mở trust rộng, thêm gateway, tự xóa lịch sử thật hoặc gửi raw IP ra dịch vụ ngoài. Mọi thay đổi schema/receiver phải có compatibility/backup/rollback kiểm chứng riêng; dữ liệu retention mới là không tự xóa, không phải hứa dung lượng hosting không bao giờ hết.
