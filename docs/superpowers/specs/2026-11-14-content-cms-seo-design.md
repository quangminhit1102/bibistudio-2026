# BiBi Studio — Bài viết, Danh mục và xuất bản HTML phục vụ SEO

Ngày: 14/11/2026. Trạng thái: **bản thiết kế chờ chủ website duyệt**. Chỉ phương án đã được chọn; chưa cho phép bắt đầu implementation từ tài liệu này. Không có thay đổi code, dependency, DB hoặc hosting trong bước thiết kế.

## 1. Mục tiêu và các quyết định từ cuộc trao đổi

Chủ website yêu cầu lên kế hoạch triển khai hai chức năng **Bài viết** và **Danh mục**. Qua trao đổi, phạm vi được hiểu là nhóm Nội dung, không phải danh mục sản phẩm. Chủ website ưu tiên SEO và giúp bài mới được tìm thấy trên Google sớm nhất có thể; đã chọn **phương án A: CMS gọn, tạo HTML khi xuất bản**.

Kết quả mong muốn: người có quyền soạn và đăng bài trong admin; bản công khai có nội dung, liên kết và metadata đầy đủ ngay trong HTTP HTML, đọc được khi tắt JavaScript. Đăng/cập nhật bài không cần chạy một đợt CI/deploy ứng dụng. Lưu nháp không thay bản đang công khai. Bài/danh mục/ảnh dùng chung giữa tài khoản và thiết bị, nằm trên server.

SEO kỹ thuật giúp máy tìm kiếm đọc và khám phá URL; không bảo đảm thời điểm được lập chỉ mục hoặc vị trí xếp hạng. Nghiệm thu implementation không phụ thuộc lời hứa “lên top” hay một thời hạn index do Google quyết định.

## 2. Hiện trạng đã đọc từ source và runbook

- Source hiện hành nằm trong linked checkout `C:/Users/Admin/.codex/worktrees/fullstack-cicd/bibistudio-2026`, nhánh `codex/admin-dashboard`, mốc `f190879`. Checkout `D:/Project/BiBiStudio/bibistudio-2026` còn công việc cũ chưa commit; không ghi đè hoặc dùng nó làm nguồn implementation mới.
- Admin React/TanStack đã có form TinyMCE tự host, bài viết, chuyên mục, tags và media local. `Post` hiện có title/slug/excerpt/content/categoryId/tagIds/authorId/status/publishAt/imageId/SEO. Chuyên mục local dùng chung bảng Category nhưng có `kind=content`; product/collection là các chiều độc lập, giữ nguyên theo AGENTS.md.
- Bài viết/danh mục/media hiện vẫn dùng IndexedDB. Auth, RBAC, account, audit và analytics đã có Express/MariaDB thật. Quyền `post.*` đã được đăng ký; role `system-admin` có `full_access=1`; không mặc định cấp thêm quyền cho custom role hoặc User.
- Blog public đọc `src/data/blog.ts` và ảnh bundle. Trang listing đang có 9 bài/trang. `cpanel.html` có root rỗng; `src/main.tsx` dùng `createRoot`, không hydrate HTML có sẵn. Metadata SEO hiện còn origin Lovable, chưa thấy sitemap trong source.
- Hosting production: frontend static cPanel/LiteSpeed, backend Node24/Passenger mount `/api`, PHP8.3.36 đã đo. Root routing hiện giữ `/api`, `/node-test`, `.well-known`, `/assets` rồi fallback về `_bibi/index.html`. Release có con trỏ current, deploy lock và giữ hashed assets. Việc PHP/routing mới phục vụ toàn bộ Blog vẫn cần thử nghiệm riêng, không suy luận từ relay analytics.
- `rich-content.ts` đang dùng DOMPurify và `document`; backend không thể import nguyên module đó làm sanitizer Node. Tracker FE và BE hiện dùng whitelist đường dẫn được sinh lúc build; bài CMS mới phải được nối vào whitelist mà không mở tracking cho URL tùy ý.

## 3. Các phương án và lựa chọn

| Phương án                                           | Đổi lại                                                                                                | Quyết định                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| A. Tạo HTML ở lúc đăng/cập nhật, phục vụ bản đã tạo | Cần quản lý generation, ảnh, routing và khôi phục khi xuất bản lỗi; không truy vấn DB mỗi lượt đọc bài | **Chủ website đã chọn**: phù hợp Blog và mô hình hosting hiện tại |
| B. Render Blog trên server mỗi request, có cache    | Linh hoạt nhưng phải bổ sung cách mount public Node runtime/cache và khả năng phục hồi request         | Đã trình bày; không chọn trong đợt này                            |
| Chỉ thêm API rồi fetch bài bằng CSR                 | Ít thay đổi frontend hơn, nhưng vẫn phụ thuộc bước chạy JavaScript để có bài trong HTML                | Không đáp ứng ưu tiên đã chọn                                     |

Các lựa chọn kỹ thuật sau đây là **đề xuất của người viết**, không phải điều chủ website đã mô tả chi tiết: bộ đọc PHP nhỏ; con trỏ generation làm mốc công khai; danh mục chính duy nhất; tác giả chọn từ danh sách tối thiểu hoặc thương hiệu; tags đơn giản; giới hạn ảnh; chưa có tự lưu nền/hẹn giờ/duyệt nhiều bước. Chủ website kiểm tra các lựa chọn này khi duyệt tài liệu.

## 4. Phạm vi và điều không làm

Trong phạm vi: HTTP CRUD bài/danh mục, ảnh dùng cho bài, phân quyền xuất bản, nháp và bản công khai độc lập, xem trước, xuất bản/cập nhật/gỡ bài, thùng rác và khôi phục, nhập Blog hiện tại, HTML Blog/danh mục/phân trang, SEO, sitemap, URL redirect, analytics Blog mới, backup/restore và khả năng deploy/rollback tương thích.

Không làm trong đợt này: danh mục sản phẩm/catalogue CMS, bán hàng, bình luận, đa ngôn ngữ bài viết, tự tạo bài bằng AI, chấm điểm từ khóa như cam kết xếp hạng, hẹn giờ, quy trình Chờ duyệt, public preview chia sẻ bằng token, giao diện khôi phục mọi phiên bản biên tập, full media manager dùng chung cho sản phẩm. Không chuyển toàn bộ website sang SSR hoặc framework/CMS khác.

Không được xảy ra: lưu nháp làm lộ bài/ảnh; xuất bản nửa chừng; mất URL/ảnh cũ; Google nhận HTML khác người dùng; sửa bài buộc deploy ứng dụng; rollback ứng dụng tự quay lại toàn bộ dữ liệu nội dung; khôi phục backup đè DB live; thay đổi catalogue, auth, relay IP hoặc lịch sử analytics ngoài seam cần thiết.

## 5. Bài viết và quy trình biên tập

Một bài có ID cố định, **bản đang soạn** với revision tăng dần và **bản đang công khai** là snapshot bất biến. UI hiển thị độc lập “Đang công khai” và “Có thay đổi chưa đăng”; không dùng một dropdown status trong request lưu để vượt qua quyền đăng.

Các thao tác:

1. Tạo/sửa và **Lưu nháp**: lưu server, giữ form nếu lỗi; chưa thay HTML public. Không tự lưu nền ở v1; có dirty guard như hiện tại. Publish luôn lưu đúng dữ liệu form trước rồi yêu cầu đăng revision vừa lưu, không vô tình đăng dữ liệu cũ.
2. **Xem trước**: dùng dữ liệu đang nhập, HTML đã lọc và ảnh qua authenticated media adapter; desktop/mobile. Không tạo URL public của nháp.
3. **Đăng bài/Cập nhật bài**: yêu cầu quyền xuất bản, revision khớp và validate đầy đủ. Trả job202 nếu việc tạo HTML chạy nền; UI hiển thị rõ Đang xuất bản/Thành công/Thất bại. Chỉ thông báo thành công khi generation mới đã hoạt động và được kiểm tra đọc lại.
4. **Gỡ về nháp**: bỏ bài khỏi public listing/sitemap và làm URL trả404; giữ bản soạn và nội dung đã lưu. Cần quyền xuất bản vì thay đổi website.
5. **Đưa vào thùng rác**: với bài công khai phải gỡ bằng cùng cơ chế publication trước; không xóa mất nội dung. Bài nháp chỉ cần quyền xóa. **Khôi phục** trở về nháp, không tự đăng lại. Không hard delete/TTL dọn bài hoặc ảnh trong v1.
6. Nhân bản nếu giữ nút hiện có: tạo ID mới ở trạng thái nháp, slug mới chưa chiếm URL và không mang trạng thái công khai của nguồn. Bài lỗi revision trả409, không ghi đè người sửa khác.

Trường dữ liệu: title, slug, excerpt, nội dung html-v1, categoryId chính, tags, tác giả, cover media và alt, seoTitle/seoDescription. Tác giả chọn “BiBi Studio” (Organization) hoặc một account active với tên hiển thị; endpoint chỉ trả ID/tên cần thiết, không cấp đọc account/email/phone. Snapshot public cố định tên tác giả; sửa profile không âm thầm đổi toàn bộ bài đã đăng.

Tags là tối đa10 tên ngắn đã chuẩn hóa, lưu dùng chung trong CMS và gắn qua form. Không tạo trang tag public trong v1. Không dùng local tag/user ID cứng (`user-1`, `cat-journal`) trong HTTP payload. Màn tags local không còn được trình bày như nguồn thật của bài HTTP; có thể ẩn trong HTTP session, giữ demo adapter cho module chưa chuyển.

Nháp cho phép thiếu nội dung/ảnh/danh mục. Khi đăng bắt buộc có tiêu đề, slug hợp lệ, nội dung có ý nghĩa, danh mục phù hợp và ảnh bìa có alt. SEO title/description có fallback từ title/excerpt; gợi ý độ dài là hướng dẫn, không phải điều kiện bảo đảm thứ hạng. Body chỉ có một H1 từ tiêu đề; heading nội dung H2–H4. Ngày đăng đầu tiên và ngày sửa công khai được ghi từ server; giữ ngày gốc khi nhập bài cũ. Trường ngày hiện có không trở thành scheduler hoặc cho phép giả ngày để làm mới SEO.

Giới hạn đề xuất: title/SEO title tối đa300 ký tự, excerpt/description tối đa1000, body sau sanitize tối đa256KiB, request không chứa ảnh tối đa512KiB, depth/node count được chặn. Các giá trị được khóa trong shared contract, có thông báo lỗi tiếng Việt.

## 6. Danh mục bài viết

Một bài thuộc một danh mục chính; product category, product type và collection không bị trộn với content category. Danh mục có name, slug, description, parentId, position, active, SEO title/description và revision. Slug danh mục duy nhất trong content; quan hệ cha–con không nằm trong URL nên đổi cha không đổi URL con.

- Chặn tự làm cha, vòng lặp và parent không tồn tại; độ sâu v1 tối đa3 cấp, thứ tự có tie-break ID ổn định.
- `active=false` nghĩa là ẩn khỏi menu và không chọn cho bài mới; không tự gỡ bài đang công khai. Archive đã có bài vẫn truy cập được từ breadcrumb/liên kết cũ; cập nhật bài đang dùng danh mục inactive được phép giữ nguyên hoặc chuyển sang mục active.
- Không cho xóa danh mục còn con hoặc được bản soạn/bản công khai/thùng rác tham chiếu. UI chỉ rõ cần chuyển bài và xử lý mục con; không tự chuyển sang một mục ngẫu nhiên. V1 chuyển qua thao tác sửa bài rồi đăng cập nhật, không thêm wizard bulk di chuyển.
- Tạo/sửa danh mục lưu working revision. **Áp dụng lên website** yêu cầu quyền publish riêng và đi qua publication job; một thao tác không được âm thầm sửa public nhờ quyền update. Danh mục mới có thể áp dụng cùng lần đăng bài đầu tiên nếu actor có cả hai quyền, hoặc được người có quyền áp dụng trước.
- Archive rỗng có thông báo rõ, trả200 kèm noindex và không vào sitemap; danh mục không tồn tại hoặc đã xóa trả404. Đổi slug đã công khai tạo301, không mất các URL bài trực thuộc.

## 7. Ảnh và HTML an toàn

Post media adapter mới có kho server; picker/upload cho bài không dùng Blob/IndexedDB của thiết bị làm nguồn bền vững. Product editor/media local chưa chuyển tiếp tục dùng adapter cũ và ghi rõ phạm vi; không thay backend sản phẩm chỉ để tái sử dụng picker.

Nhận JPEG/PNG/WebP tối đa5MiB, tối đa16MP, chặn header giả, ảnh lỗi và quá kích thước. Server decode/re-encode trong worker có giới hạn thời gian/tài nguyên, loại metadata và tạo responsive variants với master tối đa2400px. Codec cụ thể do builder chọn nhưng phải chứng minh hoạt động trên Node24 Linux hosting và Windows local trước khi phụ thuộc nó; không âm thầm bỏ WebP hoặc dựa vào MIME/kiểm tra client.

DB giữ metadata và reference; file gốc/normalized/variants nằm ngoài application release và webroot, tên do server tạo. Media nháp chỉ đọc qua quyền `post.view` và HTTP adapter tạo/revoke Blob URL ở frontend; không có token trong URL ảnh. Tham chiếu cover/inline/alt/caption nằm trong working content và published snapshot, không dùng URL tùy ý hoặc đường dẫn người dùng cung cấp.

URL ảnh đã xuất bản dạng `/media/content/<hash>.<ext>`, immutable và không thực thi PHP/script. Public reader chỉ phục vụ hash nằm trong registry của một generation đã commit; file chuẩn bị trước publication không tự trở thành public. Registry hiện hành giữ cả ảnh từng công khai để URL/tab cũ không hỏng. Gỡ bài không thu hồi các bản ảnh từng công khai hoặc bản sao đã cache; UI không hứa điều ngược lại. Không xóa file đang dùng trong working snapshot, public generation hoặc backup; v1 chưa có dọn file tự động.

Sanitize ở backend là quyết định cuối cùng. Dùng cùng whitelist hành vi với TinyMCE hiện tại (định dạng, bảng, màu, link và media đã quản lý), với module chạy được trong Node; không import code phụ thuộc browser `document`. Chặn script/on-event/iframe/SVG nguy hiểm/javascript URL/CSS định vị tùy ý. Escape title, metadata, JSON-LD và text; không chèn raw HTML vào JSON script. Preview và output public phải cho cùng nội dung đã sanitize.

## 8. Module và interface

Các module đủ sâu để caller không tự phối hợp DB/file/routing:

| Module                    | Interface cho caller                                                                  | Implementation giữ bên trong                                                             |
| ------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Content editing           | list/get/saveDraft/trash/restore; revision + lỗi typed                                | Validation, repository, transaction, tags/tác giả, references và audit                   |
| Content media             | upload/list/readPrivate/resolvePublished                                              | Decode/variants, kích thước, file containment, quyền và reference pins                   |
| Content publication       | request(action, target, expectedRevision, idempotencyKey), status(jobId), reconcile() | Snapshot, hàng đợi bền vững, render, manifest/checksum, lock, activation và recovery     |
| Public document rendering | render(snapshot, assets, canonicalOrigin) → output generation                         | HTML full document, link, pagination, schema, sitemap-blog, routes/redirect/media maps   |
| Public reader             | normalized public request → status/headers/body                                       | Chọn generation một lần, path containment, conditional cache, 301/404 và immutable media |

Frontend không import SQL hoặc phối hợp ghi file. Các seam media/publication được dependency injection ở composition root để test qua đúng interface production. HTTP session dùng adapter CMS server cho các entity đã chuyển; lỗi mạng/API không fallback sang IndexedDB hoặc seed local. Product/demo adapter chưa chuyển giữ nguyên. Không tạo lớp passthrough cho từng câu SQL.

HTTP dự kiến `/api/content/posts`, `/api/content/categories`, `/api/content/media`, `/api/content/authors`, `/api/content/tags`, `/api/content/publications/:jobId`. Public JSON read cho CSR compatibility chỉ đọc active generation, không query working drafts; có thể đặt `/api/public/content/...`. Admin response no-store, AbortSignal và pagination tối đa100; lỗi400/401/403/404/409/413/415/429/503 theo contract hiện có. Media JSON base64 có giới hạn riêng để phù hợp kinh nghiệm LiteSpeed upload406; phải thử5MiB thực trên host, không tăng global analytics/body limit cho mọi route.

## 9. Publication: dữ liệu, mốc commit và recovery

Migration feature riêng `content_schema_migrations`; không sửa checksum auth/profile/history/context cũ. Các nhóm bảng cần có: working posts/categories + revisions, tags/link, media/reference, immutable published snapshots, publication jobs, generations và metadata nhập seed. SQL cụ thể do builder quyết định trong các bất biến sau.

Kho nội dung độc lập, ví dụ `<deploy-root>/content/`, có private media, immutable generations, active pointer, job/recovery metadata. Không lưu nội dung do admin tạo vào Git, `public/` trong repo hoặc thư mục `releases/<app release>`. Root/config tuyệt đối do bootstrap quản lý, không nhận từ request. Budget ban đầu giữ trong ngân sách deploy4GiB hiện hành; chưa được tự tăng quota. Task đầu phải đo dung lượng, khả năng codec/PHP/file ownership và đặt headroom trước khi chọn các cap generation cụ thể; hết dung lượng thì từ chối publication mà không xóa dữ liệu để lấy chỗ.

Một generation gồm HTML công khai, immutable public-data snapshot, route/redirect/media maps, sitemap-blog, renderer/schema/assets version và checksum. Chỉ các file đã verify mới được reader dùng. **Active filesystem pointer là mốc commit công khai duy nhất**. DB published flags/job là dữ liệu được reconcile theo pointer; public reader/public JSON/analytics catalogue không lấy “published” từ working DB để đi trước HTML.

Trình tự bắt buộc:

1. Request đã xác thực kiểm quyền, lưu job + revision mục tiêu + actor/session/auth version + idempotency key trong DB. Không giữ request mở trong suốt native build. Retry cùng key và cùng payload trả cùng job; payload khác bị409.
2. Worker dùng cùng environment lock với deployment/paired backup, lấy snapshot consistent từ active generation và working revision mục tiêu. Các job khác nhau được serialize và áp dụng lên active generation mới nhất, không khiến một bài ghi đè kết quả bài khác. Không giữ DB transaction xuyên toàn bộ render.
3. Render vào thư mục staging private mới, kiểm đủ body/metadata/links/media/digests rồi hoàn thành generation immutable. DB ghi prepared generation và snapshot trước activation. Job không có quyền còn hiệu lực hoặc draft đã bị sửa sẽ thất bại, không đăng revision cũ âm thầm.
4. Ngay trước đổi pointer, khóa/recheck actor, session, quyền publish và revision bằng cơ chế transaction/RBAC hiện có; chỉ giữ lock ngắn quanh bước activation. Fsync dữ liệu cần thiết và atomic rename pointer trên cùng filesystem; Windows adapter chỉ dùng cho test/local, production phải chứng minh POSIX semantics.
5. Đọc lại active generation và HTTP canary để kiểm body, title, canonical, status và cache thực. Nếu lỗi phục vụ, khôi phục pointer trước và xác minh phục hồi; báo job thất bại rõ ràng. Chỉ sau đó finalize DB/job/audit thành công. Mốc changed_public_at không lấy từ draft save.
6. Nếu process chết sau đổi pointer trước finalize DB, startup/status request reconcile idempotently từ active pointer và prepared generation đã ghi; public không phụ thuộc DB finalize. Nếu chết trước pointer, bản cũ vẫn hoạt động. Không xóa prepared generation còn cần để recovery, không tự diễn giải job pending là success.

Jobs phải bền vững, chỉ có một worker môi trường. Builder chọn cơ chế wakeup phù hợp Passenger, nhưng phải chứng minh enqueue rồi process chết vẫn được phục hồi khi runtime khởi động/admin poll; không cần thêm cron hệ thống hoặc daemon thủ công. Timeout/stuck worker có lease/recovery, không bỏ lock bằng cách giết process không thuộc worker. UI có Retry cho failed job, không tạo publication trùng. Recovery sau pointer đổi nhưng chưa có canary phải chạy canary/recovery trước khi báo success, không chỉ finalize theo job pending.

Media có thể decode vào private temp trước lock, nhưng commit file/metadata/reference pins phải dùng cùng thứ tự lock với paired backup. Backup không được dump một media row mới trong khi bản sao file chỉ chứa danh sách cũ. Các working draft save chỉ tham chiếu media đã commit; không physically delete media trong v1.

## 10. Phục vụ HTML trên cPanel

Đề xuất dùng **stable PHP public reader** chỉ đọc generation/media đã tạo, không render template hoặc query MariaDB trên mỗi lượt truy cập. Loader/root path được bootstrap cố định ngoài app release như mô hình launcher đang có. Reader không nạp DB credential; không giả định PHP/Node được tách Unix account trên cPanel. Cập nhật code reader là thao tác deploy có checksum/backup, không phải nội dung người dùng sửa.

Routing chỉ bổ sung các namespace được sở hữu: `/blog...`, `/sitemap.xml`, `/sitemaps/blog.xml`, `/media/content/...`; `/sitemaps/site.xml` là file static của application build. Giữ `/api` (gồm PHP analytics relay), `/node-test`, `.well-known`, `/assets`, catalogue và website khác. Đường private/internal không mở thành endpoint debug hoặc directory listing. Quy tắc cụ thể phải qua PHP/LiteSpeed spike trước khi implementation lớn.

Reader chỉ GET/HEAD; chọn realpath generation một lần sau khi clear stat/realpath cache, không đọc các file thuộc hai generation khác nhau trong cùng request. Tra route allowlist với URL normalize/percent decode rõ ràng; traversal, double encoding và internal/private path không được suy ra file path. Không cần User-Agent Googlebot riêng.

HTML Blog là full document độc lập, dùng CSS brand và hashed assets đã bundle. **Không chạy `src/main.tsx/createRoot` trên HTML đó**; chỉ entry nhỏ progressive enhancement cho menu, consent và tracker. Nội dung, pagination, breadcrumb và liên kết đọc được khi JS tắt. Public header/footer giữ phong cách hiện có bằng presentation module/link adapter; không kéo admin/TinyMCE vào public graph. Cover article giữ khung3:2 theo AGENTS.md, card vuông, ảnh inline đúng tỉ lệ.

Toàn bộ links từ CSR tới Blog mới dùng full-document navigation; thin TanStack route adapters chuyển về public document nếu vẫn đi vào bằng client navigation. Back/forward và Ctrl-click hoạt động bình thường. Các consumer ngoài Blog như home highlights/search nếu có phải đọc published read model, không tiếp tục đưa bài static đã gỡ ra website; đây không phải mở rộng SSR cho Home. Route cho preview local/Lovable có adapter đọc published fixture; không dùng static `blog.ts` như nguồn thứ hai sau cutover. Old JS có thể hiện snapshot cũ đến khi refresh; không mất assets và có đường mở lại bằng document navigation. Đây là giới hạn tab cũ đã mở trước release, không cam kết thay được code đang chạy trong tab đó.

Không đặt cache HTML dài trong v1: no-store trên HTML/redirect/404/sitemap để publish/gỡ có hiệu lực ngay, canary chống LiteSpeed trả bytes cũ. Media/assets immutable có cache dài theo hash. Chỉ cân nhắc page/CDN cache sau khi có purge/versioning được đo thật. Không bật cache riêng cho bots.

## 11. URL, SEO và sitemap

Canonical origin production duy nhất `https://bibistudio.vn`; loại bỏ Lovable origin trong shared SEO config và Blog metadata. Không thay giá/Offer schema catalogue ngoài phạm vi. Canonical HTML, og:url và sitemap thống nhất; preview/local/staging có noindex phù hợp và không tạo canonical trỏ domain thử nghiệm.

URL canonical đề xuất:

- `/blog` và `/blog/page/2` trở đi, 9 bài/trang, thứ tự publishedAt giảm dần + ID ổn định.
- `/blog/<post-slug>` giữ toàn bộ URL bài public hiện có.
- `/blog/category/<category-slug>` và `/blog/category/<category-slug>/page/2`.
- Alias `/blog?page=N` cũ chuyển301 tới URL phân trang tương ứng; page1/trailing slash/slug cũ có một đường chuẩn, không redirect loop. Bài/danh mục dùng slug ASCII do server normalize, unique case-insensitive, chặn reserved path segments và không tái sử dụng alias từng thuộc nội dung khác. Đổi slug nhiều lần rút về301 một hop tới URL mới nhất.

HTTP www→apex/HTTPS canonical redirect chỉ cho public content/sitemap namespace trong đợt này; không redirect `/api` hoặc thay origin auth/analytics www. Other CSR page SEO origin được sửa qua config chung; không tuyên bố đã SSR/tối ưu toàn bộ product/home. UTM không tạo canonical/sitemap khác; malformed pagination bị400 hoặc redirect policy cố định, page vượt phạm vi trả404, không biến mọi URL lạ thành SPA200.

Mỗi trang có title/description riêng, canonical tuyệt đối, một H1, breadcrumbs với link thật, OG/Twitter ảnh có kích thước thật. Bài có JSON-LD `BlogPosting`, publisher BiBi Studio, author đúng Organization/Person, headline/images/datePublished/dateModified và BreadcrumbList; schema khớp nội dung nhìn thấy. Không bảo đảm rich result, không fake rating/FAQ/ngày sửa.

Sitemap index `/sitemap.xml` tham chiếu hai nguồn: `/sitemaps/site.xml` từ application build (trang tĩnh/catalogue hợp lệ) và `/sitemaps/blog.xml` từ active content generation (bài, danh mục và pagination indexable). Cách tách này tránh sitemap Blog giữ bản catalogue của app cũ. Chỉ URL canonical200/indexable, không admin/draft/trash/preview/tag/filter/query/redirect; lastmod phản ánh sửa công khai thật, không cập nhật hằng ngày cho đẹp. Robots.txt khai báo sitemap và không chặn resource cần render; noindex không được dùng như cơ chế xác thực nháp.

Internal links: listing, danh mục, breadcrumb và bài liên quan đều là `<a href>` có thể crawl. Liên kết liên quan chọn tối đa3 bài cùng danh mục theo ngày, loại chính bài đó và bài chưa công khai; không cần thuật toán AI. Import giữ ảnh, alt/chú thích và ngày gốc; thẻ SEO fallback rõ ràng, không nhồi từ khóa.

Kiểm tra Search Console: dùng property của chủ website nếu đã có, xác minh ownership/gửi sitemap ở bước vận hành được ủy quyền; trạng thái property hiện chưa được cung cấp. Không tự tạo OAuth/API key hoặc dùng Google Indexing API cho bài blog. URL Inspection/Rich Results Test kiểm một bài/danh mục thật sau release; ghi trạng thái quan sát được. Nếu Google chưa index ngay, ghi pending và hướng dẫn theo dõi, không gọi đó là lỗi publication hoặc hứa “index trong24h”.

## 12. Auth, audit và analytics

Giữ access-token/refresh-cookie/origin guard/rate limit hiện tại. Bổ sung `post.publish`, `post.restore` và namespace quyền `content_category.view/create/update/delete/publish`; `post.delete` không đủ gỡ bài công khai nếu thiếu publish. Upload dùng post.create hoặc post.update; read ảnh nháp dùng post.view. System Admin full_access tiếp tục có quyền qua cơ chế hiện có; User/custom role không tự nhận publish do từng có post.update. Dùng seed/migration permission idempotent có chủ đích; không reset account/role mappings.

Backend kiểm lại quyền ở mutation và activation, không tin nút ẩn. Audit lưu actor/action/ID/revision/generation/job và kết quả, không log token, raw article body, cookie hoặc ảnh base64. Lỗi revision, khôi phục hoặc publication không mất bản nháp của người đang nhập.

Progressive Blog entry tái sử dụng tracker/transport/privacy hiện có, giữ batch15giây, phiên30phút, opt-out/DNT/GPC và cookie scope. FE nhận published-route whitelist/bootstrap của generation; BE bổ sung route/label của active generation vào catalogue khi pointer đổi. Không chấp nhận mọi `/blog/*` chỉ vì prefix, không cần rebuild app khi có slug mới. Draft/preview không ghi thành public URL. Báo cáo lịch sử vẫn giữ path/label đã ghi và không tự xóa nếu bài bị gỡ.

## 13. Nhập dữ liệu, build và vận hành

Build tạo seed manifest có version từ `src/data/blog.ts`, toàn bộ bài public hiện có và bytes ảnh bundle tương ứng; không tải lại ảnh từ URL remote. Seed chạy có chủ đích một lần trong migration/cutover, giữ slug/ngày/cover/inline/alt/caption, chuyển category names thành content IDs, author BiBi Studio. Idempotent bằng khóa nguồn; không ghi đè bài admin đã sửa, không reset IndexedDB và không coi dữ liệu riêng trong trình duyệt là dữ liệu production. Nếu cần nhập bài local do người dùng tự viết, đó là yêu cầu import riêng chưa có trong scope.

Setup local mở rộng lệnh `npm run db:setup:local`; hằng ngày vẫn dev/check/build. Dev/compiled preview phải chạy cùng public reader PHP thật, module sanitize/codec và MariaDB, không dùng mock CSR làm bằng chứng SEO. Lovable preview/install/build output hiện có được giữ bằng adapter/fixture có nhãn, không đòi credential hosting ở preview.

Artifact thêm content schema capability (đề xuất manifest7) và checksums SQL, seed, renderer/public assets, stable PHP loader contract. Receiver cũ phải từ chối candidate chưa biết capability; native paired backup mở rộng DB + profile assets + content media/generation/pointer metadata, restore vào verifier riêng và đối chiếu references/file digests. Không sửa dữ liệu migration cũ. Readiness có content schema/private storage/active generation compatibility khi capability bật; health đơn thuần không chứng minh CMS sẵn sàng.

Bootstrap content root/config/reader, root routing và content lock phải được sao lưu/checksum. Mọi app deploy/backup/restore/publication dùng thứ tự lock thống nhất. App rollback chỉ thay app, giữ active content generation và data; stable reader/media và hashed assets đang được active generation dùng phải được pin. Rollback về pre-CMS app được phép khi public reader vẫn tương thích và admin content writes bị tắt rõ ràng, không quay về Blog static trong app cũ; quay lại app CMS thì thấy nội dung mới còn nguyên. Nếu không chứng minh được điều này, chặn live cutover thay vì down-migrate hoặc ghi đè nội dung.

Giữ active/previous content generations và các generation cần job recovery/backup/asset pins. Chưa auto prune generation/media trong v1; dung lượng đạt ngưỡng thì báo rõ và chặn publication mới. Giới hạn chính xác gắn với quota đo tại host, không dựa disk free của cả máy như dung lượng riêng của tài khoản.

## 14. Các gate và tiêu chí nghiệm thu

1. **Khả thi trước implementation lớn:** PHP/LiteSpeed trên đúng hosting phục vụ initial HTML/routing301/404/HEAD/cache đúng; atomic pointer và paths private an toàn; codec Node24 hỗ trợ3format; kiểm quota/account ownership. Spike chỉ thực hiện trong implementation sau duyệt, tách khỏi public cutover. Không đạt thì dừng và sửa thiết kế, không lùi sang CSR mà vẫn gọi chuẩn SEO.
2. **Dữ liệu/auth thật:** MariaDB CRUD, parent cycle, slug/reserved/alias collision, input sanitize, permissions including revoked actor before activation, revision conflicts, trash/restore/media references, idempotent seed. Hai browser/account nhìn cùng dữ liệu.
3. **Publication failure matrix:** concurrent jobs, changed draft, disk full, render/asset failure, process chết trước/sau pointer và DB finalize, job retry, deploy lock contention; mỗi kết quả có generation cũ/mới đầy đủ, không trộn file hoặc lộ draft. Reconcile restart và phục hồi canary fail phải có test.
4. **Browser và raw HTTP:** cùng một bài mới/ảnh mới sau public202→success, HTML đầu tiên có body/meta/schema khi JS tắt; CSR→Blog full document, navigation/back, desktop/mobile, ảnh vuông listing và3:2 article, bảng rich text không tràn ngang. Nháp/ảnh nháp401/404, bài gỡ404, đổi slug301 một hop; cache cũ không giữ trang đã gỡ. Public assets không chứa admin/TinyMCE/secret.
5. **SEO thật:** correct origin/canonical/schema/date/internal links, sitemap index hai nguồn có đủ URL hợp lệ và không có nháp, robots và status đúng. Validate bằng parser/schema checker và Search Console/Rich Results khi có quyền. Không dùng điểm Lighthouse thay chứng minh HTML/indexability; hiệu năng mobile đo trước/sau cùng điều kiện, không hứa điểm tuyệt đối.
6. **Tích hợp và release:** full check/build/compiled preview trên exact source; native paired backup/restore có content; reviewed ops bootstrap; main CI artifact đúng nguồn; live publish/update/unpublish/redirect/restore và app rollback/forward giữ nội dung. Chưa có ủy quyền deploy cho feature mới chỉ vì lần relay trước đã deploy; thực hiện bước live theo phạm vi được chủ website cho phép ở giai đoạn implementation.

## 15. Điều builder được quyết định và giới hạn bàn giao

Builder được quyết định tên file/module, SQL index chi tiết, HTTP verb/DTO cụ thể trong contract, codec/sanitizer được duy trì và chạy được trên host, template/render tooling và cơ chế worker wakeup trong các bất biến trên. Có thể chia plan thành nền tảng CMS/media, publisher/SEO và vận hành; mỗi phần phải tích hợp qua các interface đã nêu, không phát hành từng phần làm website đọc nháp.

Các lựa chọn cần chủ website kiểm khi duyệt: một danh mục chính; tối đa3cấp; tác giả account hoặc thương hiệu, không có module tác giả mới; tags trong form, chưa tag public/full tags manager; không tự lưu nền/hẹn giờ/phê duyệt; thùng rác không hard-delete; ảnh5MiB/16MP; public PHP reader; chuẩn hóa URL phân trang mới với301 từ query cũ. Ownership Search Console và kết quả routing/codec/quota hosting là gate vận hành còn chưa đo cho feature này, không được ghi là đã đạt.

## Kiểm tra trước bàn giao

Một builder độc lập đã đọc toàn bộ bản thiết kế và các seam source liên quan theo brainstorming skill; kết luận **“nothing important left”**. Đây là kiểm tra mức đủ thông tin để lên plan, không phải bằng chứng implementation/hosting đã đạt. Sau kiểm tra, người viết làm rõ thêm adapter HTTP không fallback local, media commit dùng lock với backup, canary bắt buộc khi recovery và các consumer Blog ngoài trang Blog.

## Nguồn chính thức đối chiếu

- [Google: JavaScript SEO và HTML phía server/pre-render](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- [Google: canonical và URL trùng](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
- [Google: Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).
- [Google: yêu cầu crawl lại và giới hạn thời gian/indexing](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
- [WordPress: draft/publish và quyền xuất bản như mô hình tham khảo](https://wordpress.org/documentation/article/post-status/); không chuyển platform sang WordPress.
