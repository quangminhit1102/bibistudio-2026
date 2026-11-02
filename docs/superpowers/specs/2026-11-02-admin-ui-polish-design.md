# BiBi Admin — hoàn thiện giao diện và trải nghiệm quản trị

Trạng thái: thiết kế chờ người dùng duyệt. Chưa triển khai source ứng dụng hoặc phát hành. Bản phác thảo là tài liệu thảo luận, không phải giao diện đã hoàn thành.

## 1. Ý định và quyết định đã được người dùng chốt

- Hoàn thiện trên bộ UI dùng chung hiện có (hướng 1); giữ giao diện tối giản, đẹp, nhanh, dễ thao tác, source nhẹ.
- Toàn bộ giao diện admin dùng tiếng Việt trước, kể cả menu, trạng thái, thông báo và thư viện component. Tên sản phẩm/nội dung do người dùng nhập và thuật ngữ SKU/CSV/VAT không bị dịch máy.
- Không còn badge, dải thông báo, nút, mô tả, tên dữ liệu hoặc URL điều hướng hệ thống thể hiện đây là bản demo.
- Thay màn chọn tài khoản bằng Login. Tài khoản có thể gắn cứng lúc này, nhưng cấu trúc phải cho phép triển khai login thật sau này.
- Rà soát đủ thư viện component, kiểm chứng bằng thao tác trên UI; chỉ đề xuất component bổ sung để người dùng xác nhận riêng.
- Sửa màu nút Chỉnh sửa/Hủy phiếu và các nút tương tự, nhãn biểu đồ, khoảng cách section, footer tài khoản/dropdown, menu sản phẩm và chấm slider trang chủ.

## 2. Hiện trạng và bằng chứng

Source nền tảng đã review/phát hành ở `ddfdd4c` (source chạy production `4c6e070`). Stack React19, TanStack Router/Query/Table, Radix, Recharts, TypeScript, IndexedDB; Express/cPanel/CI/CD vẫn giữ.

Đã đếm trực tiếp catalogue: **96 mục /7 nhóm** (8 hành động,24 biểu mẫu,18 hiển thị dữ liệu,17 điều hướng,10 overlay,12 phản hồi,7 biểu đồ). Đây là inventory, chưa phải tuyên bố đã kiểm thử toàn bộ96 mục trong đợt này.

Đã quan sát trên production:

- Link Chỉnh sửa có nền và chữ cùng `rgb(24,24,27)`. `.admin-root a {color:inherit}` thắng `.a-btn-primary` do specificity.
- Hover `.a-btn:hover` đổi nền nút destructive nhưng không giữ cặp màu chữ/nền. Dark theme còn cần kiểm tra cặp màu trên nền đỏ sáng.
- Khoảng cách giữa section doanh thu theo khách và Tổng kết sản phẩm gần bằng0.
- Nhãn Y của biểu đồ nằm cùng mốc kết thúc nhưng căn phải (`text-anchor:end`); tên dài bị cắt theo20 ký tự trong cột120px nên mép bắt đầu nhấp nhô và thông tin khó đọc.
- Sidebar hardcode chữ MN và hiện vai trò thay vì tên tài khoản dù query hồ sơ đã có.
- Chấm hero đang nằm trong lớp có cả `clip-path` và transform/scale của Parallax; clipping khi scroll phải tái hiện/đo trên browser trước khi ghi nhận đã sửa.

Lovable đã cung cấp ý kiến review nguồn tại project `a92fe95d-ba22-47c3-be74-9ed93eadfc00`. Một số mục nó gọi là thiếu đã có trong source; không lấy danh sách đó làm scope bổ sung. Lovable chưa kiểm thử96 mục trên browser. File `.lovable/plan.md` của nó là ghi chú tham khảo, không thay thế thiết kế được người dùng duyệt này.

## 3. Các hướng đã cân nhắc

1. **Hoàn thiện UI dùng chung hiện có — người dùng chọn.** Chuẩn hóa primitives, tokens, bố cục, auth adapter và trình bày dữ liệu, sau đó rà các màn tiêu thụ. Ít lặp code, giữ trọng lượng app và hành vi đã có; cần regression vì thay đổi dùng chung.
2. Tạo bộ component thay thế rồi chuyển từng màn. Dễ so sánh cũ/mới riêng, nhưng có hai bộ UI trong giai đoạn chuyển đổi và tăng công bảo trì/kiểm chứng. Không chọn.

## 4. Phạm vi và giới hạn

Đây là một dự án hoàn thiện UI có thay đổi nhỏ ở auth/session, dữ liệu khởi tạo và resolver URL; không phải viết lại admin hoặc làm backend quản trị thật.

- Không thêm framework, chart/table/editor/auth SDK hoặc dependency mới mặc định.
- Không chuyển sang Supabase hay đổi Express/MySQL/cPanel/CICD hiện có.
- Không thêm endpoint auth thật, MFA, khôi phục mật khẩu, tracking/IP/location thật, thanh toán hoặc writeback catalogue công khai.
- Không xóa/reset IndexedDB của người dùng, không đổi primary ID hàng loạt, không sửa counter/số tiền/stock/reserved của phiếu cũ để làm đẹp dữ liệu.
- Giữ VAT là nhãn có/không; tổng phiếu = số lượng×đơn giá; phiếu không thay kho; báo cáo dùng phiếu đã lưu/chưa hủy, không khẳng định tiền đã thu.
- Giữ hình ảnh, font, kính lúp3x, link bidiary, reduced motion và catalogue public không có giá/cart. Public chỉ thay phần điều khiển hero.
- Làm và nghiệm thu local trước. Không tự push/deploy từ lần duyệt thiết kế này; phát hành theo yêu cầu riêng.
- Giao diện không còn chữ demo; tài liệu kỹ thuật vẫn nói đúng local adapter/IndexedDB và giới hạn xác thực. Login phía frontend không bảo vệ API hay thay cho auth/RBAC server.

## 5. Login và seam cho auth thật

### Trải nghiệm

Màn `/admin/login` có Tên tài khoản, Mật khẩu, hiện/ẩn mật khẩu, Đăng nhập; Enter submit; lỗi validation/auth rõ bằng tiếng Việt. Không chọn vai trò/tài khoản, không nút dùng thử, không quên mật khẩu hoặc nhớ đăng nhập giả.

Login hợp lệ mở URL admin đã yêu cầu, mặc định dashboard. `returnTo` chỉ nhận đường dẫn admin nội bộ cùng basepath; từ chối URL ngoài, protocol-relative hoặc đường dẫn public. Logout về Login và dọn session/cache. Lỗi không làm mất tên tài khoản đã nhập; password không lưu vào storage/log.

### Cấu trúc

`AuthService` có `login(credentials)`, `getSession()`, `logout()` và DTO người đang dùng; UI không tự so password, không gọi IndexedDB trực tiếp để quyết định đăng nhập. Local adapter đối chiếu một cấu hình tài khoản cố định, gắn với account quản trị hiện có. Tên/mật khẩu fixture được ghi trong tài liệu để review, không dùng mật khẩu cá nhân hoặc secret hosting.

Provider nhận adapter qua điểm cấu hình/injection. Sau này HTTP adapter có thể thay `login/getSession/logout` bằng API/cookie; không cần viết lại Login/sidebar. Việc nối CRUD và phân quyền server vẫn là công việc backend riêng, không được mô tả là tự có chỉ nhờ adapter này.

Session hiện chỉ chứa tham chiếu account và thông tin cần cho UI, không tạo JWT giả. Adapter kiểm tra account còn hoạt động/role hợp lệ. Đổi user/logout phải invalidate generation và dọn Query cache/mutation cũ như quy tắc đã kiểm thử. Fixture/test có thể inject tài khoản vai trò khác mà không đưa bộ chọn tài khoản trở lại UI.

Chuyển đổi một lần sẽ hết hạn session legacy từ màn chọn tài khoản, đưa về Login mới nhưng giữ nguyên dữ liệu DB. Refresh sau login khôi phục session hợp lệ; session hỏng/account inactive trở về Login. Chi tiết tên file/type và giá trị credential fixture là lựa chọn của builder; interface và hành vi trên là bắt buộc.

## 6. Copy, dữ liệu khởi tạo và đường dẫn

- Rà toàn bộ copy runtime: layout/login/footer, toast, error, empty state, tooltip, aria-label, badge/KPI/chart, form, search, settings, gallery component và đoạn code minh họa hiển thị trên UI. Không dùng CSS để giấu chữ còn nằm trong accessible tree.
- Bỏ dải cảnh báo và badge DEMO; footer chỉ giữ thương hiệu/copyright cần thiết. Giữ các mô tả nghiệp vụ hữu ích như không tự tính VAT, phiếu hủy không vào doanh thu, thay vì xóa mọi trợ giúp.
- Bỏ khỏi menu/UI các tính năng giả như Reset demo, MFA và session-timeout chưa thực thi. URL bảo mật cũ chuyển hợp lý về hồ sơ/cài đặt hiện có, không tạo trang hoặc công tắc giả để lấp chỗ trống. Hàm reset nội bộ có thể giữ cho automated tests.
- DB mới dùng dữ liệu sản phẩm/bài viết từ catalogue/blog hiện có, ảnh nội bộ đúng đường dẫn, không nhân bản tên “mẫu2/mẫu3” chỉ để đủ số dòng. Khách và hồ sơ khởi tạo có tên tiếng Việt hợp lý, không giả là khách hàng/đối tác thật đã được xác minh; không bịa số thuế hay liên hệ cá nhân. Có thể để trống thông tin chưa có.
- Bỏ marker demo khỏi dữ liệu khởi tạo/hiển thị: tên, slug kiểu `bibi-demo-*`, anonymous visitor ID, mô tả và email mẫu cũ khi an toàn. Không đọc IP thật để làm dữ liệu có vẻ thật; dữ liệu lượt xem vẫn là fixture ghi rõ trong tài liệu.
- Có migration có version, idempotent, retry an toàn. Chỉ đổi field thuộc seed cũ có giá trị còn khớp baseline đã biết; giữ field đã sửa, record tự nhập, custom role, ảnh Blob và liên kết. Không chỉ kiểm tra revision1 rồi ghi đè cả record. Audit và snapshot nghiệp vụ đã phát sinh phải giữ nguyên; không search/replace mù trong nội dung người dùng. Nội dung tự nhập có chữ “demo” không bị kiểm duyệt tự động.
- Số lượng fixture không là hợp đồng; seed mới có thể phản ánh đúng số sản phẩm thật. Các baseline seed không khớp catalogue không bị xóa hàng loạt khỏi DB đang dùng; cách xử lý an toàn được ghi trong migration/test.
- Khi cập nhật DB đã có, chỉ map sản phẩm/bài viết sang catalogue/blog theo định danh hoặc nội dung khớp thực sự; không dùng vị trí mảng để gán một primary ID cũ cho sản phẩm khác. Bản ghi mẫu trùng tên được phân biệt bằng SKU/ID sẵn có, không tự bịa quy cách A5/A6 để che trùng. Record đã phát sinh phiếu của người dùng giữ nguyên danh tính và snapshot; nếu không map chắc chắn thì chỉ chuẩn hóa field hiển thị an toàn, không đổi nghĩa sản phẩm.
- Phiếu dùng số phiếu ổn định làm URL canonical, ví dụ `/admin/sales/slips/PMH-2026-0001` và `/edit`. Giữ primary ID `slip-demo-1` nội bộ để không gãy references/audit/counter. Resolver chấp nhận ID cũ hoặc số phiếu, rồi replace URL cũ sang canonical và giữ query quay lại danh sách. Không resolve ngẫu nhiên nếu phát hiện trùng số; trả lỗi có thể phục hồi.
- URL khác vẫn có thể dùng ID ổn định, không cần biến toàn bộ ID thành slug SEO. Các link sinh bởi UI không lộ marker demo; link legacy vẫn mở được. Không đổi URL public vì thay slug admin.

Ngoại lệ bảo toàn dữ liệu cần thể hiện rõ trong nghiệm thu: văn bản do người dùng đã tự nhập và lịch sử audit/snapshot không bị sửa chỉ để đạt phép tìm chuỗi “demo”. Mục tiêu kiểm tra “không còn demo” áp dụng cho UI hệ thống và bộ dữ liệu khởi tạo đã chuẩn hóa, không phải che/xóa hồ sơ nghiệp vụ của người dùng.

## 7. Menu và footer tài khoản

Nhóm quản lý sản phẩm chỉ có các link con trực tiếp: Danh sách sản phẩm, Thêm sản phẩm, Danh mục, Tồn kho. Bỏ lớp summary “Trang trong Sản phẩm”. Các nhóm khác dùng cùng nguyên tắc, không phát sinh mục trung gian chỉ để mở nhóm. Tên nhóm tiếng Việt đề xuất: **Quản lý sản phẩm**. Các resource keys/quyền/custom roles và deep links vẫn giữ.

Khách hàng thuộc nhóm Kinh doanh cùng Phiếu mua hàng/Báo cáo; đây là đề xuất bố trí của builder để tách người mua khỏi catalogue, chưa phải yêu cầu nguyên văn của người dùng. Active state chỉ đánh dấu đúng mục/nhánh tương ứng, không tô đồng thời nhiều trang sibling. Sidebar thu gọn và drawer mobile vẫn thao tác được.

Footer sidebar là một trigger đầy hàng: avatar, **tên tài khoản đang dùng**, vai trò tiếng Việt; không hardcode MN hoặc dùng role thay tên. Avatar ưu tiên ảnh nếu profile/config có, thiếu ảnh thì lấy initials từ tên hiện tại, có tên truy cập được. Không tự dùng ảnh người thật/remote placeholder. Dropdown chỉ **Hồ sơ**, **Đăng xuất**, bám trigger và xử lý va chạm viewport; Escape trả focus, click ngoài đóng. Sidebar thu gọn vẫn mở menu được.

Không để hai menu tài khoản trùng nhau trên desktop. Trên mobile cần nút tài khoản dễ truy cập khi sidebar đang đóng; dùng cùng component/menu/footer logic, hai lựa chọn giống nhau. Chức năng tải/đổi ảnh hồ sơ là bổ sung riêng, chưa tự triển khai.

## 8. Trạng thái thống nhất

| Đối tượng            | Nhãn tiếng Việt              | Ý nghĩa giữ nguyên                                                 |
| -------------------- | ---------------------------- | ------------------------------------------------------------------ |
| Khách hàng/tài khoản | Hoạt động / Ngừng hoạt động  | Có thể dùng / tạm ngừng, giữ hồ sơ và liên kết                     |
| Sản phẩm             | Nháp / Đang hiển thị / Đã ẩn | Trạng thái nội dung, không đồng nghĩa có hàng                      |
| Bài viết             | Nháp / Đã xuất bản           | Không thêm lịch đăng tự động hoặc trạng thái mới chưa có nghiệp vụ |
| Phiếu                | Đã lưu / Đã hủy              | Hủy là terminal, giữ số phiếu/lịch sử, loại khỏi doanh thu         |

Khách inactive không được chọn cho phiếu mới, nhưng phiếu cũ vẫn đọc được. Tồn kho dùng số lượng/khả dụng, không gom vào Active/Inactive. Tài khoản inactive không đăng nhập được. Giá trị lưu trong DB và permission keys không cần đổi chỉ để dịch nhãn.

Màu badge dựa trên ý nghĩa và luôn có chữ: xanh cho hoạt động/đã lưu/hiển thị; trung tính cho nháp/ngừng hoạt động; trạng thái ẩn/hủy có sắc thái riêng phù hợp, không chỉ dựa màu. Không đổi trạng thái nghiệp vụ vì thay badge.

## 9. Nút và tương tác dùng chung

Sửa ở primitives/CSS scoped, sau đó rà các nút trên màn thật lẫn96 ví dụ. Link-button và button dùng cùng quy tắc màu. Mỗi variant có cặp background/foreground rõ cho light/dark và normal/hover/active/focus/disabled/loading; không để opacity hoặc hover chung phá tương phản.

Chỉnh sửa là primary. Hủy phiếu trên trang là hành động phụ nguy hiểm, đề xuất nền nhẹ/viền đỏ; nút Xác nhận hủy trong dialog là destructive rõ ràng. Đây là lựa chọn thiết kế được đề xuất, không thay quy tắc xác nhận/lý do hủy. Không hover dịch vị trí hoặc làm chữ mất đi. Contrast chữ thao tác đạt4.5:1 khi bật; focus rõ, hit target mobile tối thiểu44px hoặc vùng chạm tương đương.

Link disabled/loading phải ngăn hành động thật và có semantics, không chỉ đổi màu. Modal không cho submit lặp; error giữ form; Escape/focus return theo từng flow không bị mất draft. Giữ các regressions route-ID/snapshot/refetch/filter đã có.

## 10. Báo cáo và nhịp bố cục

Biểu đồ khách/sản phẩm có cột nhãn nhất quán **căn trái**, vùng bar bắt đầu cùng một trục, giá trị không chồng chữ. Nhãn dùng tên dễ đọc; ID khách/SKU là dòng phụ hoặc metadata để phân biệt tên trùng. Tooltip có tên đầy đủ + ID/SKU và giá trị/đơn vị, không chỉ chuỗi đã cắt. Không cắt theo số ký tự cố định để đoán độ rộng chữ.

Giữ Recharts. Có thể dùng tick tùy biến/label renderer và responsive label width; trên mobile vẫn đọc được tên và giá trị, không biến tooltip hover thành cách duy nhất để biết tên. Đề xuất mobile dùng danh sách xếp hạng có thanh ngang gọn từ cùng dữ liệu, nếu chart SVG quá chật; cách render cụ thể để builder chọn nhưng không thêm request, dữ liệu hoặc tính tổng khác.

Biểu đồ vẫn Top10 có nhãn rõ; bảng/CSV giữ toàn bộ dữ liệu lọc. Không thay aggregate theo lượng dòng đang hiện. Căn chỉnh tooltip/legend/đơn vị/empty state cho các loại chart còn lại.

Tạo nhịp section dùng chung: khoảng cách đề xuất32px desktop/24px mobile; heading, mô tả, filter, chart/table có khoảng cách thống nhất. Áp dụng báo cáo và những trang có section tương tự, không tăng margin riêng rải rác. Kiểm tra tên dài, số tiền lớn, empty/error/loading, filter năm/khách và reload.

## 11. Chấm slider trang chủ

Đưa điều khiển ra lớp ổn định ngoài transform/clip-path của ảnh và bên trong khung hero có tọa độ rõ; chỉ ảnh tham gia Parallax/unveil. Chấm vẫn tròn: vòng mảnh khi chưa chọn, chấm đặc rõ khi chọn, không đổi thành thanh dài. Đề xuất bỏ nền pill blur nặng, dùng tương phản/vòng nhẹ, vùng chạm44px, focus và aria-current.

Khi ảnh/hero còn trong viewport, chấm không bị cắt do scroll/animation. Khi toàn bộ hero đã cuộn khỏi màn hình, chấm đi theo hero bình thường; không sticky đè lên các section dưới. Giữ autoplay hiện có, thao tác chọn ảnh và reduced motion; kiểm tra vị trí trước/sau load ảnh, resize, scroll lên/xuống, desktop/mobile và bàn phím.

## 12. Audit96 component và tiêu chuẩn nghiệm thu

Lập inventory từng tên hiện có, đường dẫn màn, trạng thái kiểm tra và bằng chứng; không đánh dấu cả nhóm pass từ một screenshot. Mọi component có tương tác phải được thao tác; tên khác nhau nhưng dùng cùng primitive có thể chia sẻ regression, vẫn kiểm tra presentation/use case cụ thể. Rà component được dùng trên trang thật, không chỉ trang thư viện.

| Nhóm            | Phải kiểm tra                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Hành động (8)   | click, Link vs button, loading/disabled, keyboard, copy success/error, dropdown/split/toggle                                   |
| Biểu mẫu (24)   | nhãn, required/invalid/disabled, nhập/xóa, số/tiền, select/multi/combobox/date/time, file/image validation, resize và keyboard |
| Hiển thị (18)   | bảng/filter/sort/paging/selection, badge/avatar/tooltip, progress/skeleton/empty, preview, dữ liệu dài                         |
| Điều hướng (17) | route/Back/deep link/basepath, tabs/menus/tree/accordion/stepper, keyboard, active state, drawer mobile                        |
| Overlay (10)    | open/close, Escape, focus/return focus, scroll/collision, nested interactions, pending/error                                   |
| Phản hồi (12)   | thành công/lỗi/cảnh báo, dismiss/retry/empty/loading và aria-live, không báo thành công giả                                    |
| Biểu đồ (7)     | label/legend/tooltip/unit/empty, responsive, contrast và reduced motion                                                        |

Đo tại360/390/768/1024/1440px; các page trọng tâm gồm Login, dashboard, khách hàng, products, slip list/detail/create/edit, reports, profile,7 nhóm component và public hero. Light/dark + bàn phím; thay theme không ảnh hưởng public. Không tràn ngang toàn trang; bảng có thể cuộn bên trong nếu hợp lý.

Browser evidence có steps/expected/observed, screenshot sau animation ổn định, console errors và trường hợp chưa chạy. Mọi lỗi xác nhận cần có bước tái hiện trước sửa và kiểm chứng sau sửa; automated regression cho lỗi logic/shared primitives khi có giá trị, không viết test chỉ lặp CSS.

Full `npm run check`, `npm run build`, artifact preview thật; không suy thành công từ ảnh phác thảo. Giữ budget gốc public JS gzip tăng≤10240bytes/CSS≤2048bytes so với `docs/admin-baseline.json`, lazy-load chart/editor/seed/admin, không tính lại budget từ đầu. Bộ96 ví dụ không được import vào public initial graph hoặc admin shell chỉ vì sửa dùng chung.

Migration/auth tests bao gồm DB cũ đã sửa dữ liệu, partial/quota/retry, snapshot/number/Blob/custom role được giữ, URL legacy/canonical, login sai/đúng/reload/logout/session đổi giữa mutation, role inactive, safe returnTo và basepath `/~vhplasti`.

## 13. Bổ sung có ích — mặc định CHƯA làm

Các mục sau không thuộc sửa lỗi bắt buộc và cần người dùng chọn riêng; không đề xuất thêm lại Dialog/Empty State/Skeleton/Combobox/Unsaved Guard vốn đã có.

| Mục | Bổ sung                              | Giá trị                                                                                   |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| A   | Thanh báo thay đổi chưa lưu          | Thấy rõ đã sửa gì/chưa lưu; tái dùng guard hiện có                                        |
| B   | Chip bộ lọc + Xóa tất cả             | Dễ biết danh sách đang lọc bởi gì và quay về toàn bộ                                      |
| C   | Ô nhập tiền VND/số lượng chuyên dụng | Định dạng dễ đọc nhưng lưu số nguyên, xử lý nhập/dán rõ ràng                              |
| D   | Luồng nhập CSV có xem trước          | Nhập nhiều khách/sản phẩm, kiểm tra cột/lỗi trước khi lưu; scope lớn hơn component đơn lẻ |
| E   | Đổi ảnh đại diện trong Hồ sơ         | Có ảnh cá nhân thật thay initials; cần validation/lưu ảnh và quyền cá nhân                |

Mặc định không chọn A–E. Avatar hiển thị/fallback và định dạng tiền đang có vẫn được sửa trong scope chính; không tự mở rộng thành upload/import mới.

## 14. Những lựa chọn của builder để người dùng duyệt

- Tên nhóm Quản lý sản phẩm; đưa Khách hàng sang Kinh doanh; desktop chỉ một menu tài khoản, mobile có trigger dễ chạm dùng chung menu.
- Avatar thiếu ảnh dùng initials từ tên; chưa có tính năng tải/đổi ảnh nếu E chưa được chọn.
- Credential fixture, file/type names và adapter injection cụ thể do builder chọn, ghi rõ trong tài liệu; không đưa credential người thật vào source.
- Chuẩn hóa seed an toàn theo field, không reset hoặc sửa lịch sử nghiệp vụ; link phiếu dùng số phiếu làm canonical và nhận alias ID cũ.
- Nút Hủy phiếu phụ viền/nền nhẹ, xác nhận hủy đỏ đặc; nhịp section32/24px; nhãn chart căn trái và có đầy đủ metadata.
- Không thêm bất kỳ mục A–E, dependency, backend hoặc phát hành production khi chưa được yêu cầu.

Sau khi người dùng duyệt tài liệu này mới viết implementation plan bằng `superpowers:writing-plans`. Nếu họ chọn bổ sung A–E hoặc thay các lựa chọn trên, cập nhật thiết kế trước khi lập plan.

## 15. Builder check và phác thảo

Builder check độc lập, read-only, đã đọc thiết kế sau khi người dùng chọn hướng1; kết quả: “nothing important left”. Không thay thế bước người dùng duyệt thiết kế.

Phác thảo riêng có ba tab Login, Sidebar & Báo cáo, Chấm slider. Đã mở và chuyển tab trên browser để xác nhận bản phác thảo hoạt động. Các tên/giá trị/biểu đồ trong phác thảo minh họa cách trình bày, không phải số liệu đã tích hợp hay lời hứa thêm KPI mới. Ảnh phác thảo trong thư mục visualizations của chat: `admin-polish-login-mockup.jpg`, `admin-polish-report-mockup.jpg`.
