# BiBi — Biên tập Bài viết và Sản phẩm với TinyMCE

Ngày: 02/11/2026. Trạng thái: người dùng đã duyệt bố cục và chọn Tiny Cloud dùng API key. Tiếp tục lập kế hoạch triển khai local; chưa triển khai source ứng dụng.

Builder check độc lập ngày 02/11: không còn câu hỏi quan trọng ngoài lựa chọn Tiny Cloud/self-host; người dùng sau đó chọn Tiny Cloud. Không tự tạo tài khoản hoặc chấp nhận điều khoản thay người dùng.

## Mục tiêu và phạm vi đã thống nhất

Biên tập nội dung và hình ảnh thuận tiện như trang quản trị tin tức thực tế, có xem trước nội dung chưa lưu trên desktop/mobile. Người dùng chọn TinyMCE, ưu tiên nhẹ, dễ tích hợp, tính năng đủ dùng. Đợt này chỉ UI, dữ liệu mẫu và lưu cục bộ trong trình duyệt; không kết nối backend/MySQL, không phát hành catalogue/blog public, không push/deploy.

Bố cục đã duyệt qua phác thảo tương tác ngày 02/11: vùng nội dung chính bên trái, thuộc tính/ảnh bìa bên phải; trên mobile xếp một cột. Phác thảo trong `.superpowers/brainstorm/40-1793636166/content/editor-product-layout.html` là tài liệu tham khảo bỏ đi, không chuyển nguyên mã vào ứng dụng và không phải TinyMCE thật.

Không thêm AI, cộng tác realtime, video nhúng, quản lý đơn hàng hay hệ CMS mới. Không thay sidebar, login, routing hoặc public catalogue. Giá và tồn kho là thông tin quản trị nội bộ, không xuất hiện trên preview catalogue và không thêm giỏ hàng.

## Các hướng đã xem xét

- Nâng cấp Tiptap đang có: giữ dependencies, nhưng cần tự xây nhiều công cụ biên tập; người dùng đã chọn thay bằng TinyMCE.
- TinyMCE: người dùng chọn vì bộ công cụ quen thuộc, tích hợp React và đủ nhu cầu biên tập.
- CKEditor: đã được nhắc như ví dụ ban đầu; không chọn, không cài thêm editor song song.

Cách tải/cấp phép được xem xét riêng sau khi duyệt mockup:

1. Tiny Cloud: wrapper React tải editor khi mở form qua API key do người dùng cung cấp; không cần chép bộ editor vào artifact, cần mạng và cấu hình domain/plan theo tài khoản. Đề xuất khi muốn giữ source riêng và tích hợp ít công sức.
2. Self-host: tải editor từ asset cùng ứng dụng, không phụ thuộc Tiny Cloud lúc chạy; cần chọn tuân thủ GPL hoặc giấy phép thương mại. Không tự đặt `licenseKey='gpl'`, không tự mua license hay đăng ký tài khoản thay người dùng.

Người dùng chọn phương án 1 qua câu trả lời “Tiny Cloud — dùng API key”. Cài wrapper React, không cài runtime self-host, không dùng `licenseKey='gpl'`. API key đọc từ `VITE_TINYMCE_API_KEY` trong `.env.local`; chỉ kiểm tra có/không, không in giá trị. Đây là key được dùng phía client nên xuất hiện trong browser theo cơ chế Tiny Cloud; người dùng cấu hình domain phù hợp trong tài khoản Tiny. Không có chế độ `no-api-key` hay editor lỗi được coi là đã hoàn thành.

Nguồn chính thức kiểm tra ngày 02/11/2026: [License key](https://www.tiny.cloud/docs/tinymce/latest/license-key/), [React self-host](https://www.tiny.cloud/docs/tinymce/latest/react-pm-host/). Không coi tự host là mặc nhiên miễn phí cho mọi cách phân phối ứng dụng.

## Hiện trạng cần giữ và sửa

Hai trang editor đang dùng `RecordEditor` chung. Bài viết có Tiptap lưu JSON trong chuỗi `content`; sản phẩm có mô tả plain text. Dữ liệu qua service vào IndexedDB, có quyền truy cập, revision chống ghi đè, xác thực trường và cảnh báo rời trang khi chưa lưu. Các cơ chế đó phải giữ.

Ảnh đi qua MediaPicker/MediaAsset: ảnh mẫu có `url`, ảnh nhập có `blobKey`. RichEditor hiện tìm blob trực tiếp bằng mediaId, không theo hợp đồng này; phải dùng một resolver chung đúng hợp đồng. Seed bài viết hiện bỏ ảnh inline, cần bổ sung lại. Không reset dữ liệu trình duyệt để cập nhật seed.

## Bố cục và thao tác

### Bài viết

- Header: Quay lại, Xem trước, Lưu nháp, Lưu thay đổi (tạo mới: Tạo bài viết).
- Nội dung chính: tiêu đề, slug với tiền tố `/blog/`, tóm tắt, TinyMCE, SEO có thể thu gọn.
- Thuộc tính: trạng thái Nháp/Đã xuất bản, chuyên mục, tác giả, ngày xuất bản, thẻ; ảnh bìa chọn/thay/bỏ.
- Toolbar gọn: undo/redo, đoạn văn/H2/H3, đậm/nghiêng/gạch chân, danh sách, căn lề, trích dẫn, liên kết, ảnh, xóa định dạng. Không có H1 trong nội dung vì tiêu đề trang đã là H1.
- Chèn ảnh qua thư viện hiện có hoặc nhập file local; hỗ trợ alt, caption, thay/bỏ ảnh. Không yêu cầu nhập URL ảnh bên ngoài hoặc upload lên dịch vụ Tiny.

### Sản phẩm

- Header và cách lưu/xem trước thống nhất với bài viết.
- Nội dung: tên, SKU, slug, mô tả ngắn, gallery, mô tả chi tiết dùng cùng rich editor, SEO thu gọn.
- Thuộc tính: Nháp/Đang hiển thị/Đã ẩn, loại sản phẩm, bộ sưu tập, danh mục, thẻ. Loại và bộ sưu tập vẫn là hai chiều độc lập.
- Gallery tối đa 10 ảnh theo giới hạn hiện có; ảnh đầu là ảnh chính. Đổi thứ tự/đặt làm ảnh chính bằng nút có tên rõ, không buộc drag. Bỏ khỏi gallery không xóa MediaAsset.
- Giá, giá so sánh, tồn kho giữ trong mục thông tin nội bộ thu gọn, không bị mất khi sửa mô tả.

### Lưu và dữ liệu

Form dùng service hiện tại và quyền create/update/media theo đúng resource; read-only/detail không khởi tạo TinyMCE. Lưu nháp dùng cùng validation bắt buộc tối thiểu và trạng thái draft; không tự xuất bản. Lưu giữ trạng thái đang chọn, disable trong lúc lưu, báo lỗi cụ thể, không mất dữ liệu khi lỗi. Revision conflict giữ form hiện tại để người dùng quyết định tải lại. Không ghi đè bản sửa khác âm thầm.

Lần tạo mới chưa lưu, slug tự sinh ASCII từ tiêu đề/tên cho đến khi người dùng tự sửa; sau đó không tự ghi đè. Bản sửa giữ slug cũ. Dùng validation và tính duy nhất đã có ở service; bổ sung nếu chưa có, không đổi URL public từ việc lưu local.

## Nội dung và ảnh bền vững

Đề xuất kỹ thuật của agent: lưu rich text mới bằng chuỗi có envelope JSON với `format: 'html-v1'` và `html` đã làm sạch. Bài viết dùng `content`; sản phẩm tiếp tục dùng `description` chuỗi để không thay schema IndexedDB, nhưng mọi chỗ đọc mô tả quản trị phải qua adapter, không hiển thị JSON thô. Kiểm tra toàn bộ consumers trước khi chốt implementation.

Adapter nhận ba dạng: Tiptap JSON cũ, envelope mới, plain text cũ. Phân loại chặt bằng shape/version; plain text có ký tự `<` không bị hiểu thành HTML. Chuyển JSON bảo toàn heading, paragraph, mark, link, list, quote, code, break và mediaId; không ghi lại dữ liệu chỉ vì mở trang. Lần lưu thành công mới đổi định dạng. Không sửa public static data.

Ảnh lưu mediaId ổn định trong HTML đã chuẩn hóa, không lưu object URL, base64 hay đường dẫn Blob làm nội dung bền vững. Khi editor/preview hiển thị, resolver lấy MediaAsset.url hoặc getBlob(blobKey) và cấp object URL tạm; thu hồi khi đổi record/đóng/unmount. Khi lưu, đổi src tạm về marker nội bộ và giữ mediaId/alt/caption. Media thiếu hiển thị trạng thái rõ, không crash hoặc mất nội dung còn lại.

Dùng DOMPurify đã có với allowlist thống nhất khi đọc, khi lưu và khi preview. Chỉ cho tags/attrs phục vụ toolbar, giới hạn alignment vào các giá trị đã hỗ trợ. Loại script, event handler, iframe, style tùy ý và URL nguy hiểm. Link chỉ http/https/mailto hoặc đường dẫn nội bộ an toàn, link tab mới có noopener/noreferrer. Ảnh chỉ từ media đã giải quyết; sanitizer không nhận blob tùy ý từ dữ liệu lưu.

## Xem trước và dữ liệu mẫu

Preview lấy snapshot form hiện tại, không đòi lưu và không tự gọi create/update. Overlay có desktop/mobile, tiêu đề rõ, nút đóng, Escape, focus trap và trả focus. Dùng renderer nhẹ của nội dung đã sanitize, không dùng TinyMCE read-only để xem. Chia sẻ quy tắc typography/crop với public article/product; không nhúng nguyên route public vì các route đó đọc dữ liệu static.

Bài viết preview gồm ảnh bìa, chuyên mục, tiêu đề, tác giả/ngày, tóm tắt và nội dung có ảnh/caption. Sản phẩm gồm gallery, loại, tên, bộ sưu tập, mô tả, liên hệ; không giá/cart. Preview phải hiển thị ảnh Blob chưa lưu record, ảnh local seed và nội dung đang sửa.

Seed bài viết lấy nội dung/ảnh thật từ blog public, gồm inline images. Seed sản phẩm lấy catalogue thật, không bịa specs hay ảnh bổ sung không khớp. IndexedDB mới có dữ liệu mẫu đủ kiểm tra; dữ liệu hiện hữu giữ nguyên. Nếu cần bổ sung media seed, chỉ thêm ID xác định còn thiếu, không ghi đè record đã sửa hoặc chạy reset.

## Nhẹ và hòa hợp ứng dụng

Lazy-load TinyMCE/wrapper chỉ trong create/edit route; một component dùng cho cả hai module. Chỉ tải plugins đã dùng. Giữ theme trắng/xám, font, radius, focus và dark mode theo admin hiện có. Toolbar tràn thành menu trên mobile; textarea/editor có chiều cao phù hợp, không ép trang tràn ngang. Chỉ một bộ editor tồn tại sau chuyển route, destroy listener/instance đúng lifecycle.

Public page, dashboard, danh sách và preview không tải TinyMCE. Đo output build và network trước/sau, ghi số thực vào acceptance; không tuyên bố TinyMCE nhỏ hơn Tiptap nếu chưa đo. Gỡ Tiptap khỏi dependencies sau khi tìm hết consumers và thay các kiểu JSON liên quan; giữ adapter độc lập thay vì kéo runtime Tiptap chỉ để đọc dữ liệu cũ.

Nếu editor tải lỗi: báo lỗi và nút thử lại, giữ tiêu đề/metadata/nội dung hiện tại; chặn lưu có nguy cơ ghi rỗng nội dung. Không âm thầm thay bằng textarea mất định dạng. TinyMCE/vendor credits giữ theo license được chọn; yêu cầu UI production không phải lý do để ẩn attribution trái điều khoản.

## Tiêu chí kiểm chứng

1. Regression có ý nghĩa cho JSON cũ/plain text/envelope round-trip, mediaId, caption, sanitizer và URL nguy hiểm; không mất mark/list khi mở-lưu-mở lại.
2. Kiểm tra quyền, validation, dirty guard, lỗi lưu và revision conflict qua service/form thực.
3. Trên giao diện thật: tạo bài viết có định dạng/ảnh/link, preview desktop/mobile, lưu nháp, reload và mở sửa; lặp lại với sản phẩm/gallery. Ảnh và nội dung còn đúng sau reload.
4. Trên giao diện: thay/bỏ ảnh bìa; đổi ảnh chính; thiếu media; sửa chưa lưu rồi preview/đóng/rời trang; keyboard/Escape/focus; chọn trạng thái.
5. Viewport 1440, 768 và 390: không overflow ngang, toolbar/dialog dùng được, nút lưu đọc được, giao diện admin khác không bị đổi.
6. Kiểm tra chuyển liên tiếp list/detail/create/edit hai module không treo/crash và không lộ JSON trong bảng/detail.
7. Chạy check/build theo docs, kiểm tra artifact local qua browser. Ghi commit/build và kết quả thật, không lấy phác thảo làm bằng chứng TinyMCE hoạt động.
8. Xác minh public route không tải editor, không thay catalogue/blog public, không phát sinh remote upload nội dung/ảnh. Không push/deploy trong đợt này.

## Phần builder được quyết định

Tên component/hook, cách tái sử dụng form lifecycle, vị trí styles, chiều cao editor và vị trí responsive chi tiết được quyết định khi lập plan theo code thực. Không đại tu RecordEditor cho tất cả modules chỉ để phục vụ hai form. Không thêm state library, CMS framework hoặc dependency upload mới. Version TinyMCE/wrapper và cách asset/license lấy theo phương án người dùng chọn và docs chính thức tại thời điểm cài.
