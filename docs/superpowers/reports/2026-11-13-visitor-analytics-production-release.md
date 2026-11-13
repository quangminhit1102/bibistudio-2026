# Visitor analytics — phát hành production 13/11/2026

Trạng thái: đã phát hành lại thành công qua GitHub Deploy production43383614666; release đang chạy `ee12307cf68f45484d59c3b77c2f6f7f83a07f47-43382604855`. Đã diễn tập rollback thật trước khi forward. IP thật chưa được xác minh, giữ trust tắt theo phạm vi chủ website yêu cầu deploy.

## Source và kiểm tra

- Source ứng dụng đầu: 43f4a0c7018cac68b503f339d520057d23835212, main CI43379719908 thành công, artifact14016302666.
- Bản sửa receiver: ee12307cf68f45484d59c3b77c2f6f7f83a07f47. Regression crontab RED trước sửa, GREEN sau sửa; 10 kiểm tra ops liên quan đạt.
- Main CI43382604855: check đạt281 Vitest/106file,279 Node đạt/0skip/0fail trên Linux; watcher và4 browser suite đạt. Build/upload thành công; toàn bộ CI kết luận Success. Không có skip trên Linux.

## Hosting trước activation

- MariaDB10.11.19-cll-lve; DB16613376byte. Native paired dump3844604byte,24bảng,2ảnh; restore vào verifier riêng verified=true/profiles=true. Backup dưới giới hạn128MiB.
- Account cPanel quota15GB, dùng7.83GB tại lúc xem; managed production khoảng1363784KiB, tools3964KiB. Không suy luận quota user từ df toàn máy; cần theo dõi tăng trưởng lịch sử dài hạn.
- Snapshot riêng ngoài webroot giữ khóa của10khách thật,25phiên,76URL,21liên kết sản phẩm trước deploy; không dump nội dung khách vào repo.
- Bootstrap15file ops từ đúng43f4a0c, SHA256 từng file đối chiếu; giữ tools backup riêng. Sau sửa cập nhật visitor-cron-policy từ ee12307, SHA256c982d41be6b936b4769c4589ef1536d86839e142c1ca0a326609b2d8d84af907.
- Đã kiểm tra chính xác job bounded-retention và gỡ riêng analytics:cleanup, lưu crontab gốc; giữ auth:cleanup. Job nhập access log gỡ theo marker riêng. Receipt private/visitor-history-retention.json xác nhận indefinite; schema/log cũ không xóa.

## Sự cố đầu và cách sửa

Workflow43380974376 thất bại trước chuyển current: Cannot inspect existing crontab. Chạy receiver trong cPanel cũng tái hiện, nên kết luận ban đầu chỉ khác biệt SSH/Terminal không đủ bằng chứng. CageFS wrapper nhận SSH_ORIGINAL_COMMAND=deploy... trả code1/stderr Invalid argument; cùng lệnh không có biến này trả thành công. Đã đo đối chứng thực tế.

Sửa chỉ tạo bản sao môi trường cho tiến trình crontab cố định và bỏ SSH_ORIGINAL_COMMAND khỏi bản sao. Receiver vẫn giữ biến gốc để validate protocol/forced command; không mở thêm lệnh hoặc thay quyền/key. Kiểm tra hồi quy mô phỏng đúng CageFS, giữ nguyên mọi biến khác và parent env.

Trong lúc chẩn đoán, activateRelease43f4a0c chạy dưới deploy.lock với wrapper thực thi crontab có thêm log kết quả, không bỏ qua kiểm tra; activation và server DB/auth/RBAC/analytics/profile probe đạt. Không coi workflow thất bại này là deployment workflow thành công.

## Rollback đã kiểm chứng

- GitHub Rollback production43382713533 thành công với toolsee12307, về3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf-43259550001.
- APIready=true, version đúng release cũ. Đối chiếu từng khóa snapshot: khách/phiên/URL/sản phẩm đều còn; auth cron giữ, importer/TTLcron không quay lại. Log archive12617/current615record còn nguyên.
- Không down migration hoặc restore đè DB production. DB verifier phục vụ restore thử riêng.
- Tab frontendv5 còn mở khi backendv4 chạy hiển thị lỗi yêu cầu tải lại, không hiển thị KPI sai phạm vi. Về code cũ không phục hồi luồng nhập log tự động.

## Kiểm chứng giao diện bước đầu

Giao diện production43f4a0c đã quan sát: KPI25phiên/10khách/8khách quan tâm sản phẩm; biểu đồ, bảng, sản phẩm bên dưới. Popup khách có6phiên, ngày giờ/sản phẩm/URL đã ghi nhận đầy đủ; IP và vị trí chưa xác định. Bộ lọc6tháng/custom chỉ có2ôdate, khôngtime. Bản cuối ee12307 đã kiểm tra lại sau forward như phần dưới.

## Giới hạn còn lại

IP công khai vẫn chưa đạt. CLIENT_IP_SOURCE_VERIFIED=false, không đặt trusted CIDR, không ghi IP client tự khai. Chủ website cần phối hợp Tino và đo hai mạng ngoài/IPv6/www trước khi bật. Không khôi phục IP/lịch sử chưa từng thu thập; không thêm GeoIP. Giữ lịch sử đã ghi không TTL cần theo dõi dung lượng thực tế; không hứa lưu trữ hosting vô hạn.

## Forward cuối và nghiệm thu

- [CI main43382604855](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43382604855) Success, đúng sourceee12307. [Deploy production43383614666](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43383614666) Success3m28s; chạy và duyệt bằng tài khoản chủ repo, giữ required production environment. Artifact CI được kiểm tra identity/checksum, không build lại trên đường phát hành.
- Release cuối: `ee12307cf68f45484d59c3b77c2f6f7f83a07f47-43382604855`. FE/version.json và BE/api/version cùng release/source; /api/ready ok:true. Server release probe ok/auth/rbac/analytics=true.
- Auth schema4, visitor feature1 state complete; 001_history.sql checksum `a9a396667a480853070a5347245fc39a6a3c1440141f671a71e88e808d8afbb4`. Chuẩn bị DB trả verified=true, dump3854054byte. Không đổi mật khẩu hoặc account thật để thử.
- Đối chiếu từng khóa sau forward: toàn bộ khách/phiên/URL/sản phẩm từ snapshot trước deploy còn nguyên. Tại lúc đo có11khách/29phiên/84URL/21liên kết sản phẩm; tăng so với trước do hoạt động mới, không dùng so sánh tổng đơn thuần để khẳng định giữ dữ liệu.
- Log cũ vẫn12617archive/615currentrecord. Auth cron còn; importer và analytics TTLcron không có; receipt indefinite/verified=true. IP source flag vẫn false.
- UI cuối có đủ bốn heading, không có alert lỗi. KPI29phiên/11khách/8khách quan tâm, chi tiết phiên có ngày giờ và URL; custom có2ôdate/0ôtime. Mobile390×844: document client375/scroll375, popup342/scroll342. Đã trả viewport về mặc định.
- Trang công khai Sổ tay bản đồ Đà Lạt tải7ảnh catalogue, cả7complete/naturalWidth1676; không thấy trang lỗi. Workflow còn kiểm tra HTTP/browser và tab mở từ release cũ; kết quả Success bao gồm các bước này.
- Bằng chứng local bị gitignore tại `.superpowers/visitor-analytics-review/`: production-final-desktop.png, production-final-mobile-dates.png, production-final-mobile-detail.png, production-final-release.png, production-final-schema.png, production-rollback-verified.png. Không đưa secret vào ảnh/tài liệu.

Quy trình đã kiểm chứng là43f4a0c→rollback3beb58f→forwardee12307, cùng feature migration1; không tuyên bố đã rollback ee12307 thêm lần thứ hai. Rollback workflow thành công sau sửa môi trường, deploy cuối cũng thành công qua đường SSH chuẩn. Chưa có kết quả Tino/IP thật nên mục tiêu đó vẫn chưa hoàn tất.
