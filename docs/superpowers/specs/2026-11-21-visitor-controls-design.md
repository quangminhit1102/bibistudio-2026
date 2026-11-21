# Khách truy cập: thao tác dữ liệu và loại trừ IP

Ngày: 21/11/2026. Trạng thái: đã duyệt; người dùng yêu cầu triển khai và deploy.

## Mục tiêu và phạm vi

Làm gọn trang Khách truy cập hiện có; cho người có quyền xóa dữ liệu và cấu hình loại trừ IP khỏi tracking. Giữ React, Express, MySQL, cơ chế PHP relay hiện có và cách tính phiên sau hơn 30 phút không hoạt động. Không thay kiến trúc analytics, không thêm cron, không đưa mockup vào production.

## Các phương án đã cân nhắc

1. Tách `customer_access.delete` và `customer_access.manage_exclusions` — người dùng chọn phương án này. Mặc định Admin có cả hai; có thể cấp riêng cho role khác qua Phân quyền. Backend kiểm tra quyền tương ứng, frontend chỉ hiển thị thao tác được phép.
2. Một quyền quản lý gộp — ít cấu hình hơn nhưng không thể cấp quyền xóa độc lập với loại trừ IP; không chọn.

Quyền `customer_access.view` hiện có giữ nguyên. Các thao tác trên trang yêu cầu cả quyền xem và quyền thao tác tương ứng. User mặc định chỉ có quyền xem; không tự được cấp thêm quyền sau migration. Giữ cơ chế toàn quyền của Master/Admin và các ràng buộc bảo vệ hiện có.

## Giao diện được duyệt

Bản HTML tương tác nằm trong `.superpowers/brainstorm/visitor-controls-20261121/content/visitor-controls-v1.html`, chỉ dùng để duyệt; dữ liệu minh họa không kết nối DB. Giữ phong cách và component admin hiện có khi triển khai, không thay sidebar hay kiểu biểu đồ chỉ vì mockup có biểu đồ minh họa.

- Nút `Loại trừ IP` bên cạnh `Làm mới` ở đầu trang; mở modal quản lý rule. Chỉ người có quyền cấu hình thấy và gọi được.
- Bảng có checkbox chọn từng khách hoặc toàn bộ khách ở trang hiện tại, nút xóa từng dòng và thanh `Đã chọn N khách trên trang này / Bỏ chọn / Xóa đã chọn`. Đổi trang, bộ lọc hoặc từ khóa sẽ bỏ chọn; không ngầm chọn toàn bộ kết quả ở các trang khác.
- Mobile vẫn có chọn khách, xóa từng khách và xóa nhiều, dùng bố cục thẻ hiện có; không thu nhỏ bảng desktop để giả lập mobile.
- Modal chi tiết giữ danh sách phiên gọn. Sản phẩm trống hiển thị `Không ghi nhận` cả tiêu đề phiên lẫn vùng sản phẩm bên trong. Mỗi phiên có icon thùng rác với nhãn truy cập, mở xác nhận trước khi xóa; nhấn icon không đóng/mở accordion.
- Modal có vỏ bo tròn và `overflow: hidden`; chỉ thân modal cuộn, scrollbar mảnh và cách góc, header/footer không bị scrollbar cắt. Hoạt động với bàn phím và màn nhỏ.
- Chú thích IP nằm cuối trang và cuối modal chi tiết, in nghiêng: `IP do website ghi nhận; quốc gia ước lượng theo DB-IP.` Giữ thông tin riêng cho bản ghi thực sự chưa có IP, không biến IP thiếu thành đã xác định.
- Xóa hoàn toàn dòng giải thích bắt đầu bằng `Mỗi URL/sản phẩm được ghi một lần trong phiên...` khỏi giao diện. Quy tắc ghi nhận thực tế và thời hạn cookie không đổi.
- Dòng khoảng ngày và định nghĩa phiên được in nghiêng, giữ nguyên ý nghĩa và múi giờ Việt Nam.
- Nút tải lại thủ công dùng icon xoay tròn và chữ `Làm mới`, viền sáng/bo góc như ảnh tham chiếu. Dùng component dùng chung cho các nút tải lại trong admin có cùng chức năng; không thay nút retry lỗi thành thao tác khác. Có trạng thái đang tải/disabled và giảm chuyển động theo tùy chọn hệ thống.

## Loại trừ IP

Quyết định đề xuất của người triển khai, có thể chỉnh khi duyệt:

- Lưu rule dùng chung cho website trong MySQL bằng migration bổ sung; không lưu trong localStorage hoặc chỉ kiểm tra tại frontend.
- Cho nhập IP đầy đủ (IPv4/IPv6) hoặc mẫu IPv4 gồm đúng bốn nhóm, mỗi nhóm là số 0–255 hoặc `*`; ví dụ `192.0.2.*`, `192.0.*.*`. Không hỗ trợ regex hoặc wildcard IPv6 trong đợt này. Không chấp nhận mẫu `*.*.*.*` để tránh vô tình tắt toàn bộ analytics. Giới hạn 200 rule, loại trùng và chuẩn hóa trước khi lưu.
- Modal có danh sách rule hiện có, thao tác thêm/xóa trong bản nháp, `Hủy` và `Lưu cấu hình`. Chỉ ghi DB khi lưu; lỗi validation chỉ rõ dòng sai và giữ nguyên bản nháp.
- Thay thế danh sách trong một transaction, có revision để từ chối ghi đè thay đổi của admin khác; audit ghi người thực hiện và số rule thay đổi, không ghi thừa IP vào log.
- Dùng nguồn IP chuẩn hóa đang được collector sử dụng: relay đã kiểm chữ ký khi có, hoặc kết quả resolver hiện có. Không tin IP do payload client cung cấp, không tự mở rộng trust proxy/X-Forwarded-For. IPv4-mapped IPv6 chuẩn hóa thành IPv4 để so khớp.
- Đọc danh sách rule nhỏ ở mỗi batch; chưa thêm cache nhiều process. Batch bắt đầu sau khi lưu dùng cấu hình đã commit. Batch đã bắt đầu có thể hoàn tất theo cấu hình trước đó.
- Khớp rule: trả phản hồi thành công không tracking, không tạo/cập nhật visitor, session, page, product, context và không lookup quốc gia. Không đổi cookie nếu không cần. Kiểm tra chữ ký/nguồn, chống replay và các cơ chế bảo vệ HTTP vẫn giữ nguyên; security receipt tối thiểu không phải lịch sử analytics.
- Rule chỉ áp dụng cho lượt mới. Lịch sử cũ không tự xóa. Nếu không có IP sử dụng được thì không suy đoán để exclude, vẫn giữ trạng thái IP chưa có như hiện tại.
- Lỗi đọc cấu hình không được âm thầm ghi tracking khi chưa biết rule: trả lỗi analytics có kiểm soát, không ảnh hưởng việc mở website chính.

## Xóa khách và phiên

Quyết định đề xuất: xóa dữ liệu analytics trong DB bằng transaction; không có chức năng hoàn tác trong UI. Popup nói rõ phạm vi trước khi xác nhận.

- Xóa khách: xóa toàn bộ phiên, URL, sản phẩm và dữ liệu liên quan của các visitor ID đã chọn, kể cả ngoài khoảng ngày đang lọc. Không xóa theo IP: nhiều trình duyệt có thể dùng chung IP.
- Xóa phiên: chỉ xóa phiên ID thuộc đúng khách và các liên kết của phiên đó; giữ các phiên khác. Khách hết phiên không còn trong danh sách thống kê; dọn row khách nếu không còn dữ liệu phụ thuộc.
- Xóa không phải chặn tracking. Khách tiếp tục truy cập có thể được ghi nhận lại; muốn ngừng ghi nhận thì thêm rule IP. Cookie không dùng để hồi sinh dữ liệu đã xóa.
- Serialize với collector bằng cùng khóa visitor, thứ tự khóa ổn định khi xóa nhiều. Không để session mất cha, số đếm âm hoặc session đã xóa bị update lại. Việc ghi nhận sau transaction xóa được coi là lượt mới.
- Tính lại các counter/first_seen/last_seen cần thiết từ dữ liệu còn lại; báo cáo truy vấn và bộ lọc không còn đếm phần đã xóa. Không xóa release probes hoặc bản ghi phục vụ kiểm chứng deployment; ID probe bị từ chối.
- API xóa nhiều nhận danh sách tối đa 100 UUID khác nhau, không nhận query tự do hay `all=true`. Các ID thiếu có thể báo rõ lỗi để làm mới và xác nhận lại, không âm thầm xóa tập khác. Audit ghi actor, mục tiêu/số lượng và kết quả; không ghi toàn bộ lịch sử URL/IP.
- UI chờ phản hồi server rồi refetch bảng, report, filter options và chi tiết; khóa nút khi đang xử lý. Nếu trang cuối trống, chuyển về trang hợp lệ. Xóa phiên cuối làm đóng chi tiết nếu khách không còn. Không hiển thị thành công khi server lỗi.

## Tích hợp và dữ liệu

Hiện `backend/src/visitors/private-routes.ts` chỉ có các route GET, và permission registry chỉ khai báo `customer_access.view`. Bổ sung các route mutation có auth, permission, kiểm tra origin/CSRF theo convention hiện có và validation. Route cấu hình đặt trước route động `/:id`.

Định hướng API: GET/PUT `/api/customer-access/exclusions`, DELETE `/api/customer-access/:id`, POST `/api/customer-access/bulk-delete`, DELETE `/api/customer-access/:id/sessions/:sessionId`. Giữ response/error theo contract hiện có, không phá route đọc hoặc relay public.

Tận dụng DataTable selection, shared Modal/Button/confirmation, React Query và audit hiện có. Migration bổ sung quyền và cấu hình, không down-migrate phá dữ liệu. Không cấp quyền cho role tùy chỉnh ngoài Admin theo mặc định.

## Kiểm chứng và phát hành

- Test backend: quyền mặc định/cấp riêng/403; validation rule; IP wildcard/canonicalization; excluded batch không ghi analytics và không gọi geo lookup; đổi rule; concurrent collector/delete; xóa đúng một hoặc nhiều khách; FK, counter, probe protection và audit.
- Test UI: checkbox nhiều dòng, bỏ chọn khi scope đổi; confirmation cancel/confirm/error; không sản phẩm; refresh loading; quyền độc lập cho nút/modal; refetch đúng và trang cuối sau xóa.
- Verify trực tiếp desktop/mobile: đọc chú thích, scrollbar không chạm góc, thao tác bàn phím, xóa phiên không toggle accordion, dialog focus và tooltip/aria cho icon.
- Thử xóa trên fixture local, không xóa khách production để kiểm thử. Build và checks phải đạt trước khi xin phát hành. Theo `docs/build-and-deploy.md` khi triển khai thật, bảo đảm backup và rollback ứng dụng tương thích schema mới; rollback ứng dụng không phục hồi bản ghi người dùng đã xóa.
- Đợt hiện tại mới duyệt thiết kế; chưa có lệnh deploy production cho thay đổi này. Không coi ảnh mockup là bằng chứng backend đã hoạt động.

## Phần giao cho người triển khai

Chọn tên bảng migration/contract và cách tách service theo convention hiện có; rà soát đầy đủ bảng phụ thuộc trước khi viết delete. Chọn kích thước icon và spacing từ design token admin, không mang CSS standalone của mockup vào toàn ứng dụng. Chốt danh sách nút tải lại thủ công trong admin bằng tìm kiếm source và kiểm chứng từng nhóm tương đương.

