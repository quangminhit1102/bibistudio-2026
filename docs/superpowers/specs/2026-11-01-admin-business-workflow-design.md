# BiBi Admin — khách mua hàng, phiếu mua hàng và phân tích gọn

Ngày viết: 01/11/2026 (Asia/Saigon). Người dùng đã duyệt thiết kế và bốn quy tắc nghiệp vụ ngày 02/11/2026, sau Lovable review và builder check. Tài liệu này thay thế yêu cầu analytics/bookstore/sales/notification tương ứng trong thiết kế admin ban đầu; các module khác giữ phạm vi hiện có. Bước tiếp theo là lập kế hoạch triển khai, chưa đồng nghĩa các chức năng đã được xây dựng.

## 1. Mục đích và quyết định đã có

Admin phục vụ BiBi quản lý khách mua sản phẩm và ghi nhận phiếu bán cho khách. “Nhà sách” là bên mua (nhà sách, cá nhân hoặc công ty), không phải kho đầu sách/tác giả/nhà xuất bản. Website cần đẹp, nhanh, dễ thao tác trên desktop/mobile, source không thêm nhiều tầng hoặc dependency.

Người dùng đã yêu cầu và xác nhận:

- Phân tích chỉ có một trang **Khách truy cập**: ID, IP, Location, thiết bị–hệ điều hành, trình duyệt, số phiên và thông tin liên quan.
- Quản lý bên mua: tên, địa chỉ, có/không áp dụng VAT, thông tin thêm.
- Quản lý **Phiếu mua hàng**: ngày giờ tạo, khách, các dòng sản phẩm có tên/số lượng/đơn giá, tổng tiền, nhãn có/không VAT. Không cần các trang Lịch sử/Giao dịch riêng.
- **VAT chỉ là nhãn**, không có thuế suất hoặc công thức cộng/trừ thuế.
- Báo cáo có biểu đồ doanh thu theo khách trong năm, lọc năm/khách; bảng và biểu đồ tổng số lượng/tổng giá trị bán từng sản phẩm.
- Thông báo là popup ngay cạnh chuông, có icon đã/chưa đọc; click đánh dấu đã đọc ngay và mở link nếu có; không có trang riêng.
- Đã chọn **cách 1: danh sách + trang thêm/sửa riêng cho khách và phiếu**.
- Lỗi treo Lịch sử → Giao dịch phải tái hiện trước khi sửa: đã có biên bản riêng, regression test và kiểm chứng local desktop/mobile. Giữ bản sửa này khi thay route cũ.

## 2. Phương án đã cân nhắc

| Phương án                                                       | Lợi ích                                                                                     | Đánh đổi                                                                                  | Quyết định      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------- |
| 1. Danh sách, trang thêm/sửa riêng                              | Form rộng, URL riêng, Back/refresh rõ, tận dụng router và form hiện có; dễ dùng trên mobile | Có chuyển trang khi mở biểu mẫu                                                           | Người dùng chọn |
| 2. Danh sách, ngăn bên phải cho khách; phiếu vẫn là trang riêng | Xem/sửa khách nhanh, giữ bảng phía sau                                                      | Thêm trạng thái ngăn/URL, focus và dữ liệu chưa lưu; mobile ngăn phải thành toàn màn hình | Không chọn      |

Cả hai dùng stack đang có. Phương án 1 không tạo app/cloud/database mới. Lovable hỗ trợ review UI ở plan mode; không cho cloud tự sửa nhánh đang kết nối trong lúc chuẩn bị thiết kế.

## 3. Giới hạn và các lựa chọn đề xuất để duyệt

Đây là chỉnh admin **demo local** hiện có, chưa phải backend/auth/MySQL hay phân tích khách thật. Dữ liệu vẫn ở IndexedDB; Express và CI/CD không mở rộng trong đợt này. Public catalogue không có giá/cart và không nhận thay đổi từ phiếu admin.

Các điểm dưới đây là đề xuất của người triển khai, không phải câu trả lời đã có của người dùng:

1. Sidebar đổi “Nhà sách” thành **Khách mua hàng**, trong đó có bộ lọc loại Nhà sách/Cá nhân/Công ty để diễn đạt đúng cả ba nhóm.
2. **Doanh thu ghi nhận** = tổng giá trị phiếu đã lưu và chưa hủy. Không diễn đạt là tiền đã thu; không thêm thanh toán/công nợ. Phiếu hủy bị loại khỏi báo cáo. UI có giải thích ngắn ngay cạnh chỉ số.
3. **Phiếu không tự thay đổi tồn kho/reserved**. Tồn kho sản phẩm hiện có vẫn chỉnh qua chức năng riêng. Việc trừ kho theo phiếu sẽ cần quy tắc phát hành/hủy/hoàn nếu có yêu cầu sau.
4. VAT của khách là giá trị mặc định khi tạo phiếu; người lập phiếu được đổi nhãn của từng phiếu. Phiếu lưu bản chụp VAT để việc đổi khách sau này không sửa phiếu cũ.
5. Dữ liệu sách/đơn/giao dịch demo cũ được giữ nguyên ở legacy stores, không tự chuyển thành phiếu mới vì thiếu nghĩa VAT và có dòng sách sai mô hình. Bộ demo mới có nhãn, seed riêng và không cộng legacy vào báo cáo mới.
6. Phiếu chỉ có trạng thái **Đã lưu/Đã hủy**; biểu mẫu chưa lưu nằm trong bộ nhớ và có cảnh báo rời trang. Không thêm workflow giao hàng/thanh toán. Hủy thay cho xóa cứng phiếu đã lưu; hủy là trạng thái kết thúc.

Không thêm mã số thuế, hóa đơn điện tử, thuế suất, giao dịch tài chính, cổng thanh toán, tracking/geolocation thật hay cron/email/push notification. Không reset dữ liệu local của người dùng để đổi mô hình.

## 4. Điều hướng và tương thích URL

| Mục            | URL chính (dưới `/admin`) | Trang con                                                          |
| -------------- | ------------------------- | ------------------------------------------------------------------ |
| Khách truy cập | `/analytics/visitors`     | Không có trang con riêng; chi tiết/phiên trong dialog cùng trang   |
| Khách mua hàng | `/customers`              | `/customers/create`, `/customers/$id`, `/customers/$id/edit`       |
| Phiếu mua hàng | `/sales/slips`            | `/sales/slips/create`, `/sales/slips/$id`, `/sales/slips/$id/edit` |
| Báo cáo        | `/sales/reports`          | Hai khối báo cáo trong cùng trang                                  |
| Thông báo      | Không có route/menu riêng | Chuông trong header mở popup                                       |

Danh sách giữ query tìm kiếm/lọc/sắp xếp/phân trang khi đi form và quay lại. Cancel không tự ghi. Refresh/deep link và basepath `/~vhplasti` phải hoạt động như `/`.

Các route analytics overview/sessions/pages/traffic-sources redirect tới visitors. Visitor detail cũ redirect tới visitors với `visitor=<id>` để mở dialog cùng trang. Bookstore/books/authors/publishers/genres/inventory cũ redirect customers; không giả định book ID là customer ID. Orders/order-history/transactions cũ và order detail/edit redirect slips; không giả định order ID là slip ID. `/notifications` cũ redirect dashboard. Redirect dùng router, không tạo vòng lặp hoặc nạp lại cả app. Cập nhật breadcrumbs, command search, quick links, docs và các href seed/notification để không còn link nội bộ tới các trang bỏ.

Các trang Products/Content/Accounts/Settings/Audit/Components vẫn giữ. Dashboard chỉ điều chỉnh những phần phụ thuộc mô hình sales/notification cũ, không redesign toàn bộ dashboard.

## 5. Khách mua hàng

### Dữ liệu và thao tác

`Customer`: BaseRecord + `name`, `kind: bookstore|individual|company`, `address`, `vatApplied: boolean`, `notes`, `active: boolean`; `phone`/`email` là trường tùy chọn hữu ích, không bắt buộc. Tên và loại bắt buộc; địa chỉ/ghi chú cho phép bổ sung sau. Không bắt tên duy nhất vì các cá nhân/công ty có thể trùng tên; UI hiển thị mã khách ngắn để phân biệt.

Danh sách: tên/mã, loại, địa chỉ, nhãn VAT, trạng thái và thao tác. Search tên/mã/địa chỉ; filter loại/VAT/đang dùng; sort và phân trang theo component hiện có. Chi tiết hiển thị thông tin và các phiếu của đúng customerId, liên kết sang danh sách phiếu đã lọc. Nút thêm/sửa đi trang riêng. Không tạo các mục tác giả/NXB/thể loại/tồn kho sách.

Biểu mẫu desktop gọn một trang, nhóm Thông tin khách và Ghi chú; mobile một cột. VAT có nhãn rõ “Áp dụng VAT” và hai trạng thái Có/Không. Gọi là nhãn mặc định của phiếu, không phải tính thuế. Ngừng sử dụng khách thay vì xóa khách đã có phiếu; các phiếu cũ vẫn xem/lọc được. Khách ngừng dùng không xuất hiện trong chọn khách khi lập phiếu mới, nhưng vẫn có trong filter báo cáo và phiếu.

## 6. Phiếu mua hàng

### Dữ liệu

`PurchaseSlip`: BaseRecord + số phiếu duy nhất, `customerId`, snapshot khách (`name`, `address`, `kind`), `vatApplied`, `items`, `total`, `notes`, `status: saved|void`, `voidedAt`, `voidReason`.

Mỗi dòng có `lineId`, `productId`, snapshot `sku`/`name`, `quantity` nguyên dương, `unitPrice` VND nguyên không âm. Chỉ chọn sản phẩm admin, không chọn legacy books. Không lấy giá từ public catalogue. Sản phẩm có thể gợi ý giá admin hiện có, nhưng đơn giá trên phiếu được sửa theo lần bán đó.

Ngày giờ tạo là timestamp hệ thống, hiển thị giờ Việt Nam gồm giờ/phút; không đổi khi sửa phiếu. Demo seed có timestamp cố định để test lặp lại. Số phiếu sinh trong giao dịch lưu, không dựa riêng trên độ dài danh sách, không trùng khi hai tab cùng tạo.

`lineTotal = quantity × unitPrice`; `total = tổng lineTotal`. Không shipping/discount hay thuế tính ngầm. Chặn NaN, số âm, số lẻ ở quantity, giá trị/tổng vượt safe integer; tối thiểu một dòng. Mỗi productId chỉ có một dòng trên phiếu: nếu chọn lại sản phẩm đã có thì focus dòng hiện tại để người dùng sửa số lượng, không tự thêm dòng/gộp hoặc đổi đơn giá. Đơn giá khác giữa các phiếu vẫn hợp lệ.

Khi lưu: validate và kiểm quyền, kiểm customer/product còn tồn tại và được chọn hợp lệ; tính lại tổng trong service, không tin total từ form. Ghi phiếu + audit atomically và kiểm revision khi sửa/hủy. Không tăng/giảm stock hoặc tạo Payment/StockEvent. Không thay đổi ngày tạo/số phiếu khi sửa. Snapshot tên/giá/VAT của phiếu không đổi theo cập nhật catalogue/khách; sửa phiếu là thao tác rõ ràng và có audit before/after. Đổi sang khách khác trên form cập nhật snapshot/VAT theo khách mới trước khi lưu.

Chặn xóa sản phẩm đang được tham chiếu bởi phiếu mới (hoặc ngừng hiển thị sản phẩm để lưu lịch sử); không để việc xóa catalogue làm mất khả năng đọc phiếu. Khách/sản phẩm cũ ngừng dùng vẫn hiển thị trên phiếu cũ. Không refresh lại snapshot chỉ vì mở trang sửa.

### UI

- Danh sách: số phiếu, ngày giờ, khách, số dòng/tổng số lượng, tổng tiền, nhãn VAT, trạng thái, Xem/Sửa/Hủy. Tìm số phiếu/tên khách; lọc khách/ngày/VAT/trạng thái. Một trang này thay chức năng lịch sử và giao dịch.
- Trang tạo/sửa: phía trên chọn khách có tìm kiếm, ngày giờ tạo, VAT; tiếp theo các dòng sản phẩm; cuối trang ghi chú, tổng và Lưu/Hủy thao tác nhập. Khi VAT được sửa khác mặc định, có nhãn “Khác mặc định của khách” và nút lấy lại mặc định; không tự đổi nhãn vì query khách refetch. Nút “Hủy phiếu” chỉ có trên phiếu đã lưu và khác nhãn Cancel form.
- Desktop dùng bảng dòng sản phẩm với các cột tên/SKU, số lượng, đơn giá, thành tiền, bỏ dòng. Mobile mỗi dòng là card, ô số có bàn phím số và lỗi ngay cạnh trường; thanh tổng/Lưu không che trường, footer hoặc bàn phím.
- Chi tiết phiếu: thông tin khách đã chụp, ngày giờ, bảng dòng, tổng, nhãn VAT, trạng thái/ghi chú; có Sửa và Hủy phiếu theo quyền. Hủy yêu cầu xác nhận và lý do ngắn, có cập nhật audit/báo cáo; không hiện Delete cứng. Không cần page lịch sử timeline/giao dịch. Export CSV/in theo khả năng nhẹ đã có, không thêm PDF library.

## 7. Báo cáo và dashboard

Thanh lọc chung: **Năm** và **Khách mua hàng** (một khách hoặc Tất cả); mặc định năm hiện tại theo múi giờ Việt Nam. Danh sách năm gồm các năm có phiếu và năm hiện tại. Bộ lọc ghi vào URL và áp dụng giống nhau cho biểu đồ, bảng, KPI và CSV; đổi filter reset trang bảng.

Tập tính toán: tất cả phiếu `saved` có ngày tạo thuộc năm chọn (01/01 00:00 đến 01/01 năm sau theo Asia/Ho_Chi_Minh, cận cuối loại trừ), và customerId chọn nếu có. Phiếu void không tính; không chỉ tính trang đang nhìn thấy. Không cộng thêm hoặc bóc VAT. Giá trị là doanh thu ghi nhận từ phiếu, không phải xác nhận thanh toán.

1. **Theo khách**: biểu đồ thanh ngang tổng doanh thu từng customerId trong năm, bảng tên khách/số phiếu/tổng giá trị. Nếu nhiều khách, chart Top 10 có nhãn rõ, bảng/CSV vẫn đủ toàn bộ; chọn riêng một khách vẫn dùng cùng phép tính. Trường hợp khách đổi tên, group theo ID và hiện tên hiện tại, fallback snapshot nếu thiếu record.
2. **Theo sản phẩm**: bảng SKU/tên/tổng số lượng/tổng giá trị; chart thanh ngang chuyển chỉ tiêu Số lượng/Giá trị để không trộn hai đơn vị trên một trục. Group theo productId, dùng số lượng và đơn giá snapshot. Top 10 của chart và thứ tự sort phải rõ; bảng/CSV đủ các sản phẩm trong tập lọc. Cùng một ID có nhiều đơn giá vẫn cộng đúng từng dòng.

Tổng footer theo khách, theo sản phẩm và tổng phiếu phải bằng nhau. Empty state “Chưa có phiếu trong bộ lọc này”, không dựng số ngẫu nhiên; loading/error/retry có thật. VND format vi-VN; không vẽ sản lượng trên trục tiền. Desktop chart/bảng chia khối rộng; mobile xếp một cột, tên dài xuống dòng và bảng cuộn trong container khi cần; không ép toàn trang tràn ngang.

Dashboard chuyển doanh thu/số đơn/gần đây/bestseller sang cùng aggregate phiếu và nhãn Phiếu mua hàng. Các KPI trạng thái giao hàng/thanh toán cũ được bỏ hoặc thay chỉ số phiếu đã lưu/hủy, không trình bày trạng thái giả. Tỷ lệ chuyển đổi visitor → đơn cũ không suy ra từ customer: hiển thị “Chưa có dữ liệu liên kết” thay vì invent nối IP/customer hoặc tính 0%. Các panel không liên quan vẫn giữ.

## 8. Khách truy cập — chỉ một trang

Bảng desktop: Visitor ID (ID ẩn danh), IP, Vị trí (`city, country`), Thiết bị–Hệ điều hành (ví dụ Mobile–Android), Trình duyệt, Số phiên, Lần cuối. Có tìm ID/IP, filter thiết bị/browser/vị trí/ngày lần cuối, phân trang/sắp xếp. Không đưa ID khách mua hàng vào visitor ID hoặc suy ra danh tính từ IP.

Click dòng/“Xem chi tiết” mở dialog ngay trên trang: đầy đủ các trường và danh sách phiên gọn (bắt đầu/kết thúc, trang vào/ra, nguồn, số trang). Các phiên được lọc visitorId và phân trang, không chỉ lấy 200 dòng rồi giả định đã đủ. URL có thể mang `visitor` để Back/Escape đóng chi tiết; không thêm mục/menu trang phiên.

Mobile: card có ID, vị trí, thiết bị–OS, số phiên; IP/browser/thời gian vẫn truy cập được trong chi tiết, không loại bỏ dữ liệu vì thiếu chiều rộng. Khuyến nghị touch target 44px, focus rõ. Phiên = một lần truy cập trong mô hình dữ liệu, không đồng nghĩa số người duy nhất.

Đợt này dùng visitors/sessions demo hiện có, nhãn dữ liệu mô phỏng và IP mẫu được che như hiện tại; không gọi dịch vụ geo/IP và không gắn tracking script. Mối quan tâm sản phẩm trước đây là mục tiêu người dùng đã nói: có thể trình bày **Sản phẩm đã xem** bằng cách gom URL sản phẩm hợp lệ trong các phiên demo, không timeline click chi tiết và không tạo record cho mỗi lần bấm. Chỉ gắn nhãn “đã xem”, không coi đó là ý định mua hay đơn hàng. Builder không tự triển khai collector/thời gian lưu/batching thật trong đợt chỉnh UI này.

## 9. Thông báo cạnh chuông

Dùng Radix Popover đã có trong package radix-ui. Trigger là chuông, badge số chưa đọc; popup căn dưới/phải sát trigger, collision detection theo viewport, rộng tối đa khoảng 360px và không vượt `viewport - 24px`. Cả mobile cũng bám chuông, không đổi thành page riêng/bottom sheet. List có max-height và cuộn riêng; tải thêm/phân trang khi vượt một trang dữ liệu, không cắt 5 dòng rồi mất đường xem thông báo khác.

Mỗi mục có tiêu đề, mô tả ngắn, thời gian, icon/chấm chưa đọc hoặc icon check đã đọc (có accessible label; không chỉ dùng màu). Mục không có href vẫn bấm được để đánh dấu đọc. Có “Đánh dấu tất cả đã đọc” trên popup, thao tác áp dụng toàn bộ thông báo của người dùng chứ không chỉ trang đang hiển thị.

Đề xuất trạng thái đọc theo **tài khoản demo hiện tại** bằng `notificationReads` (notificationId, userId, readAt; ID duy nhất theo cặp), không làm tài khoản khác đọc theo. `notifications` giữ nội dung/href. Để giữ trạng thái seed cũ, `isRead = notification.read || receipt của user hiện tại tồn tại`; `notification.read` legacy chỉ là mặc định bất biến, không ghi vào trường đó khi click/mark-all. Không có thao tác “đánh dấu chưa đọc” trong đợt này. Dấu đọc được tạo sau nâng cấp thuộc đúng người click, không chuyển từ user A sang user B khi đổi phiên.

Click: optimistic mark-read ngay trong list và giảm badge; gọi service lưu receipt, sau đó điều hướng nếu có link hợp lệ. Lỗi lưu thì khôi phục unread/badge, hiển thị lỗi và giữ popup để thử lại, không báo thành công. Khi không có href giữ popup mở, khi điều hướng thành công đóng popup. Chặn double click bằng pending ID; mark-read idempotent trong transaction. Mark-all cũng optimistic và rollback khi lỗi.

Chỉ cho URL nội bộ router hoặc http(s) đã validate; không javascript:/data:. Href nội bộ phải tôn trọng basepath và aliases cũ. Dùng nguyên tab cho link trong app; link ngoài dùng noopener khi mở tab mới và có thông báo accessible. Không tạo trang Settings notification mới.

Esc/click ngoài đóng; bàn phím Tab/focus quay lại chuông; nút mark-read không lồng button trong link. Popup có loading/empty/error/retry. Dashboard hoặc vị trí hiển thị notification khác phải dùng cùng read-state/badge và không còn nút tới `/notifications`.

## 10. Kiến trúc nhẹ, nâng cấp dữ liệu và quyền

Giữ React19/TypeScript, TanStack Router/Query/Table, Tailwind4, Zod, Radix và Recharts đã cài. Không thêm chart package/global state/form framework. Routes mỏng, module lazy; chart chỉ nạp trong dashboard/report, seed chỉ nạp theo module. CSS trong `.admin-root`, giữ theme/accessibility/reduced motion và giới hạn bundle public của thiết kế trước.

Module `customers` sở hữu schema/service/form/pages; `sales` sở hữu phiếu và aggregate report; analytics gom UI vào visitors; notifications sở hữu popup/read receipts. Reuse form/unsaved guard/DataTable đã sửa. Hạn chế sửa generic CRUD để chạy nghiệp vụ phiếu: total/snapshot/void/counter là service nghiệp vụ được kiểm chứng riêng.

IndexedDB tăng version, **chỉ tạo stores mới còn thiếu**: customers, purchaseSlips, notificationReads. Giữ nguyên legacy stores books/authors/publishers/orders/payments và metadata cũ. Không đổi tên DB hoặc reset. Có migration marker/seed keys riêng (`customers:v2`, `purchaseSlips:v2`) và seed idempotent, không phụ thuộc `seed:sales` cũ. Nhóm seed mới không kéo bookstore cũ; seed/query tồn kho thủ công cũng không kéo legacy sales/bookstore làm dependency ngầm. Khởi tạo dữ liệu mới trong transaction; marker ghi sau thành công và retry không nhân bản. Xử lý connection blocking để báo người dùng đóng/reload tab cũ, không nuốt lỗi.

Legacy data không xuất hiện ở các màn quản lý mới nhưng còn nguyên trong DB, không tạo module Lịch sử/Giao dịch quay lại hoặc thêm công cụ export legacy ngoài phạm vi. Reset demo chỉ chạy khi người dùng dùng chức năng reset xác nhận, không dùng reset làm migration; giữ semantics reset toàn workspace demo hiện có, cập nhật nội dung xác nhận cho đúng stores mới. Sản phẩm, bài viết, ảnh Blobs, profile/theme/session và custom roles phải được giữ khi nâng cấp, không nhầm migration với reset.

Lựa chọn tương thích quyền: tạm giữ resource key `bookstore` cho quyền quản lý khách nhưng đổi nhãn trên UI thành Khách mua hàng; `sales` quản lý phiếu/báo cáo; `analytics` cho visitor. Không tự cấp thêm quyền cho custom roles. Manager có quyền khách/phiếu theo grants hiện tại; Viewer không có tạo/sửa/hủy. Mark-read là trạng thái cá nhân: service chỉ cho người có notifications:view ghi receipt của chính session.userId, không được sửa nội dung/href hoặc receipt của người khác; không phụ thuộc notifications:update để Viewer có thể đọc. Kiểm active session/generation ở service lẫn UI, invalidate Query khi đổi session/reset.

Invalidation sau customer write cập nhật list/detail và pickers; phiếu write/void cập nhật list/detail/report/dashboard/customer totals; mark-read cập nhật popup/badge/dashboard. Không có cache dùng chung dữ liệu cá nhân sau logout/đổi user. Revision conflict có thông báo reload dữ liệu, không ghi đè âm thầm.

## 11. Tiêu chí nghiệm thu

- Test upgrade từ DB v1 có custom product/post/media/profile/roles và legacy orders: dữ liệu giữ nguyên, stores mới có thể đọc/ghi, seed mới không trùng, retry/blocking có lỗi rõ.
- Customer CRUD/active/VAT mặc định, tên trùng không gộp sai, khách ngừng dùng vẫn có phiếu/báo cáo cũ.
- Phiếu nhiều dòng tính đúng; chặn input lỗi; snapshot không đổi theo danh mục; đổi khách đúng; số phiếu không trùng qua hai tab; update/void atomic và revision/role được kiểm tra; tồn kho/reserved không thay đổi.
- Report đủ dataset, năm Việt Nam qua ranh giới UTC, filter khách, void/giá 0/đổi tên/đơn giá khác nhau; tổng theo khách = theo sản phẩm = tổng phiếu; chart/table/CSV cùng filter; Top 10 chỉ là giới hạn chart có nhãn.
- Notification click có/không link, optimistic/read persistence/failure rollback/mark-all, read isolation giữa hai user, safe links, basepath, Esc/focus/mobile clamp.
- Visitors một trang, detail/phiên cùng trang có paging, aliases cũ không vòng lặp; không có collector ghi mỗi click hoặc request geo thật.
- Browser desktop/mobile tạo khách → lập phiếu → reload → sửa VAT khách không đổi phiếu → xem báo cáo → hủy phiếu → tổng giảm đúng; notification và role-switch kiểm chứng thực tế. Không reset dataset đang review.
- Routes bị bỏ redirect an toàn; global search/dashboard/notification không mở module sách/giao dịch cũ. Regression DataTable render loop vẫn đạt, navigation/filter/sort/page tiếp tục phản hồi.
- Chạy `npm run check` và `npm run build`; kiểm chứng preview artifact. Browser 375/768/1024/1440, public home/product images/zoom không regression, public không tải admin/chart/editor chunks. Báo rõ test/ảnh/run nào thật sự đã thực hiện; không gọi build là production deployment.

## 12. Phần giao cho builder và thứ tự triển khai

Builder quyết exact field/component APIs, tên file/chunk, cap độ dài/số dòng và bộ seed vừa đủ (gợi ý 12 khách, 30 phiếu phân bố nhiều tháng/năm, VAT cả hai trạng thái), icon/spacing theo style admin đã duyệt. Không đổi lựa chọn nghiệp vụ mục 3 nếu chưa cập nhật thiết kế. Kích thước/tokens cụ thể không cần tạo dependency mới.

Sau khi người dùng duyệt tài liệu: lập implementation plan; triển khai data contracts/upgrade/permissions → customers → phiếu → report/dashboard → visitor/notification/routes/search → verification/docs. Kiểm chứng theo hành vi xuyên suốt, không chỉ build UI tĩnh. Không tự commit các thay đổi sửa lỗi hiện còn ở working tree khi chỉ commit tài liệu thiết kế, không push/merge/deploy.

## 13. Nguồn và liên kết

- Thiết kế gốc: `docs/superpowers/specs/2026-11-01-admin-dashboard-design.md` (các mục được thay thế theo tài liệu này).
- Build/local/deploy: `docs/build-and-deploy.md`; không có thay đổi hosting trong thiết kế này.
- Tái hiện/sửa treo: `docs/superpowers/reports/2026-11-01-admin-history-freeze-repro.md`.
- Lovable project: https://lovable.dev/projects/a92fe95d-ba22-47c3-be74-9ed93eadfc00 ; tư vấn đầu `umsg_01m6bz1d3berqar212nj1edxm5`, review lựa chọn 1 `umsg_01m6c0g9e7fr6brxx5155y4gm5`. Tư vấn không đồng nghĩa UI đã được triển khai.
- Review lựa chọn 1 đã hoàn tất ở plan mode, không mở/sửa source cloud. Áp dụng góp ý về form mobile/card, VAT override rõ và bàn phím số. Không lấy đề xuất gõ tên sản phẩm tự do/gộp report theo tên vì hai sản phẩm trùng tên hoặc đổi tên có thể bị cộng nhầm; dùng productId và snapshot như mục 6–7. Không lấy đề xuất reset riêng hai stores vì khác chức năng reset workspace hiện có; migration không xóa dữ liệu.
- Builder check độc lập theo skill brainstorming: `business_design_builder_check` trả về “nothing important left”. Các đề xuất tại mục 3 vẫn chờ người dùng duyệt cùng thiết kế; kết quả review không thay thế sự duyệt đó.
