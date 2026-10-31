# BiBi Studio: phát triển và CI/CD cho frontend + API trên cPanel

Trạng thái ngày 31/10/2026: thiết kế đã được người dùng duyệt và triển khai. Staging và promotion production đã có run thật; key mỗi môi trường và diễn tập production được xác nhận riêng. Kết quả nghiệm thu hiện hành nằm trong [build-and-deploy.md](../../build-and-deploy.md), các quan sát trước triển khai dưới đây là lịch sử.

## 1. Mục tiêu và quyết định đã có

Người dùng chọn React + Node.js/Express và quy trình CI/CD với staging, production. Backend đầu tiên chỉ là API công khai để thử toàn bộ đường phát triển và phát hành; chưa dùng MySQL, đăng nhập, quản trị hoặc upload. Giữ giao diện catalogue hiện tại và đồng bộ source với Lovable.

Kết quả cần đạt: code local, kiểm tra PR, tự cập nhật staging từ main, phát hành đúng release đã thử lên production, xác minh FE/BE và quay về release trước được.

## 2. Bằng chứng từ hosting và source trước triển khai

- Repository: `quangminhit1102/bibistudio-2026`, source chính là `main`; chưa có GitHub workflows.
- Frontend hiện được build bằng `vite.cpanel.config.ts`, đầu ra `dist-cpanel`; document root production `/home/vhplasti/bibistudio.vn`.
- Node.js Selector chạy thành công app thử tại `https://bibistudio.vn/node-test/`, Node `24.22.1`, mode production, app root `/home/vhplasti/bibi-node-test`.
- Passenger cấu hình app thử trong `/home/vhplasti/bibistudio.vn/node-test/.htaccess`; `.htaccess` ở document root phục vụ React SPA. Deploy mới phải bảo toàn cấu hình app con.
- Shell tài khoản `vhplasti` là `/bin/bash`; có `ssh`, `tar`, `curl`, `flock`; không tìm thấy `rsync` trong PATH.
- Host `h217103.tino.org`, port `22` phản hồi OpenSSH từ máy người dùng. Khóa host ED25519 đối chiếu qua phiên cPanel có fingerprint `SHA256:92PBre+MLZdaWoqr7qS8vtHaj8aiCXIDpKlOrZJ5p90`.
- Chưa có SSH key trong cPanel. Chưa thử xác thực SSH tài khoản hoặc kết nối từ GitHub-hosted runner; không được coi bước này là đã đạt.
- Chưa có domain hoặc bản ghi A cho `staging.bibistudio.vn`; cPanel có form tạo subdomain với document root riêng. DNS nameserver hiện là `ns1.tino.vn`, `ns2.tino.vn`.

## 3. Approaches: phương án đã cân nhắc

1. CI tự kiểm tra/build, người dùng deploy qua cPanel: ít thiết lập truy cập nhưng vẫn cần thao tác cho mỗi release.
2. CI/CD với staging tự động và production phát hành chủ động: người dùng đã chọn. Có môi trường thử và promotion release, phù hợp source còn nhận thay đổi từ Lovable.
3. Tự deploy production mỗi lần main thay đổi: ít thao tác nhưng thay đổi Lovable cũng xuất bản trực tiếp; không chọn.

Cách vận chuyển đề xuất của người triển khai: GitHub Actions dùng SSH và luồng tar, không phụ thuộc rsync. Chỉ chốt khả năng vận hành khi preflight từ runner đạt. Nếu SSH bị nhà cung cấp chặn, dừng thiết lập CD để điều chỉnh thiết kế; không âm thầm thay bằng thao tác cPanel thủ công rồi coi CI/CD hoàn tất.

## 4. Phạm vi ứng dụng và source

- Giữ frontend ở root repository để tránh phá workflow Lovable. Thêm `backend/` có package.json, lockfile và tsconfig riêng. Không chuyển toàn bộ frontend sang monorepo framework.
- Backend dùng Express và TypeScript, build ra CommonJS JavaScript; launcher Passenger là CommonJS. Dùng Node major 24 cho dev, CI và runtime hosting; khóa dependencies bằng lockfile.
- Người dùng yêu cầu ít lệnh: ba lệnh chính là `npm run dev`, `npm run check`, `npm run build`. Cài dependencies bằng lệnh chuẩn `npm ci`; root setup hook cài backend theo lockfile riêng để không cần thêm một lệnh setup. Không đưa các lệnh nội bộ vào quy trình dùng hằng ngày.
- Local: Vite proxy `/api` sang Express. Staging và production đều dùng `/api` cùng origin, không cần đổi API URL trong bundle FE.
- API: GET `/api/health` trả trạng thái sống; GET `/api/version` trả release ID và source SHA; GET `/api/demo` trả dữ liệu mẫu cố định. Đường dẫn không tồn tại trả JSON 404; phương thức không hỗ trợ trả 405 cho các endpoint này. Không trả env, đường dẫn máy chủ, token hoặc dữ liệu riêng.
- FE thêm trang thử `/api-test` có liên kết công khai rõ là trang kiểm tra kỹ thuật, hiển thị phiên bản frontend, phiên bản backend và phản hồi demo; có trạng thái đang tải và lỗi kết nối. Không thêm thông tin kỹ thuật vào các trang catalogue.
- Release ID gồm SHA đầy đủ và CI run ID để lần build khác nhau không ghi đè nhau. Thông tin FE được tạo lúc build, BE đọc manifest của release. Không dùng timestamp động làm nhận dạng phiên bản.

## 4a. Local development và debug là yêu cầu chính

Người dùng yêu cầu local thuận tiện: chạy cả FE/BE để develop, debug và kiểm tra mà không cần deploy. Không yêu cầu cPanel, SSH, GitHub secrets, Docker hoặc MySQL cho vòng lặp local hiện tại.

| Lệnh đề xuất | Hành vi bắt buộc |
|---|---|
| `npm ci` | Cài FE và BE theo hai lockfile, kiểm tra Node major 24; chỉ cần khi mới lấy source hoặc dependencies thay đổi |
| `npm run dev` | Một terminal chạy FE và BE; đợi API sẵn sàng rồi báo URL; hot reload hai phía; backend inspector chỉ trên loopback, không chờ debugger attach |
| `npm run check` | TypeScript, lint thuộc phạm vi quy định, kiểm tra ảnh và toàn bộ test FE/BE/script; trả exit code khác 0 nếu bất kỳ bước nào lỗi; không tự sửa file |
| `npm run build` | Build gói FE/BE bằng cùng đường thực thi mà CI sử dụng, manifest local rõ ràng; kiểm tra ảnh trước build |

`npm run build -- --preview` là tùy chọn của cùng lệnh build để build rồi chạy FE/BE từ đầu ra local trong production mode. Không tạo thêm lệnh preview/debug/setup bắt buộc cho người dùng. Cổng inspector chỉ mở khi chạy dev, không bật trong preview hoặc production.

- Cổng mặc định của full-dev: FE `http://localhost:5173`, BE `http://127.0.0.1:3001`; truy cập qua FE tại `/api-test`, request `/api` được proxy về BE. Cổng tùy chỉnh dùng cấu hình local, proxy luôn khớp. Nếu cổng bận, báo rõ và dừng thay vì tự đổi cổng làm sai proxy/debugger.
- Dev dùng cùng entry CSR `src/main.tsx` và route tree như bản cPanel, hỗ trợ refresh đường dẫn sâu; không phụ thuộc SSR của TanStack Start để coi bản CSR đã được thử. Việc đổi root scripts phải kiểm tra tương thích Lovable (cài dependencies, cổng/host, preview và build output `.output` hiện có khi Lovable cần), giữ các script build cPanel cũ ở mức nội bộ trong quá trình chuyển đổi. Gói production cPanel vẫn là frontend CSR + backend riêng; không thay đổi đích hosting Lovable như một hệ quả ngầm của việc gộp lệnh.
- Sửa FE thì HMR; sửa BE thì restart tự động. Hiển thị log có tiền tố `[FE]`, `[BE]`, request method/path/status và thời gian xử lý; không ghi secret. Nếu một tiến trình crash, báo rõ và dừng tiến trình còn lại để không giả vờ môi trường vẫn đủ thành phần.
- Ctrl+C dừng cả cây tiến trình trên Windows PowerShell và Git Bash, giải phóng cổng; không để backend/debugger chạy ngầm. Không yêu cầu người dùng mở ba terminal hoặc dùng lệnh Bash thủ công.
- Debug backend bằng breakpoint TypeScript qua Node inspector, mặc định `127.0.0.1:9230`; FE qua browser DevTools và source maps. Debugger phải gắn lại được sau BE restart. Các tùy chọn debug không được bật trong runtime production.
- Cấu hình VS Code là tiện ích tùy chọn, không điều kiện để chạy project; chỉ thêm launch/task phù hợp editor người dùng xác nhận. Hướng dẫn attach DevTools hoạt động khi không dùng VS Code.
- Có `.env.example` ghi rõ biến, mặc định local chạy được ngay với API demo không secret. Không lấy env staging/production về máy; `.env` thật bị gitignore. API URL FE dùng `/api`, không nhúng địa chỉ production khi chạy local.
- Hướng dẫn local một trang: cài đặt, chạy, debug FE/BE, kiểm tra `/api/health`, dừng, xử lý cổng bận và chạy preview bản build. Trang `/api-test` có loading/error/retry, cho phép thấy FE còn chạy khi API mất kết nối trong kiểm tra giao diện độc lập.
- Tài liệu vận hành cho người và agent nằm tại `docs/build-and-deploy.md`: phân biệt rõ hiện trạng và quy trình dự kiến, bao phủ local, CI, staging, production, rollback, thiết lập một lần và điều kiện xác nhận thành công. Mọi tên workflow/command dự kiến phải được cập nhật theo source khi triển khai.
- Nghiệm thu local gồm: khởi động từ checkout mới, hot reload hai phía, breakpoint FE/BE, attach lại sau restart, lỗi cổng bận, Ctrl+C rồi chạy lại ngay, FE hiển thị lỗi nếu API không kết nối và preview release. Các kiểm tra vòng đời tiến trình phải được xác minh trên Windows thực tế.

## 5. Môi trường và hạ tầng

| Môi trường | Frontend | Backend | Đường dẫn quản lý release đề xuất |
|---|---|---|---|
| Local | Vite | Express local | Workspace dev |
| Staging | https://staging.bibistudio.vn | /api trên staging | /home/vhplasti/bibi-deploy/staging |
| Production | https://bibistudio.vn | /api trên production | /home/vhplasti/bibi-deploy/production |

Tạo staging với document root riêng, đề xuất `/home/vhplasti/staging.bibistudio.vn`, và DNS/SSL hợp lệ trước khi nhận deploy. Staging công khai để thử, đặt `noindex` để tránh được lập chỉ mục. Không dùng bản sao dữ liệu production. Hai môi trường là tách biệt về cấu hình/vận hành, không phải ranh giới bảo mật mạnh vì cùng tài khoản UNIX.

Mỗi môi trường có app root Passenger ổn định dưới thư mục môi trường, launcher ngoài release, cấu hình runtime riêng và release directories bất biến. Source backend, lockfile và cấu hình bí mật không được phục vụ như static files. Document root chỉ chứa phần frontend, tài nguyên công khai và cấu hình mount `/api`.

## 6. Pipeline CI

- PR: cài đúng lockfile FE/BE, lint các file mới/thay đổi (ghi nhận và tách lỗi có sẵn nếu cần), TypeScript, toàn bộ test catalogue/deploy/backend và build thử. Không truyền deploy secrets vào PR, không dùng pull_request_target để chạy code PR có quyền deploy.
- Main: chạy cùng kiểm tra; chỉ khi thành công mới tạo artifact FE/BE cùng release manifest và SHA-256 của gói. Artifact không chứa node_modules của máy Windows hoặc secrets.
- Backend chỉ dùng dependencies production cần thiết; `npm ci --omit=dev` chạy trong release mới bằng môi trường Node của hosting. Không build TypeScript trên hosting.
- Staging nhận artifact từ CI main thành công. FE/BE được thử qua HTTP với kiểm tra release ID; browser smoke test kiểm tra ảnh sản phẩm và `/api-test`.
- Không hủy giữa chừng một deploy đang chuyển release. Xếp hàng hoặc bỏ deploy chưa bắt đầu nếu đã lỗi thời. Chặn release staging cũ hoàn tất muộn rồi ghi đè release mới bằng số thứ tự CI run của main.

## 7. Production promotion

Workflow `workflow_dispatch` chạy từ định nghĩa workflow tin cậy trên main. Người vận hành chọn release ID có CI main thành công và staging smoke test thành công. Production tải lại chính artifact đó, kiểm tra manifest/digest; không build lại, không checkout latest main để thay nội dung release.

Nếu artifact đã hết hạn hoặc không đủ bằng chứng staging thành công, từ chối promotion và yêu cầu tạo/thử release mới. Giữ artifact GitHub ít nhất 30 ngày nếu gói tài khoản hỗ trợ, đồng thời giữ các release đã deploy trên hosting để rollback. Giới hạn này cần được xác minh khi setup repository.

Tạo GitHub environments staging/production. Nếu gói GitHub hỗ trợ required reviewers thì áp dụng cho production; nếu không, workflow_dispatch là thao tác phát hành chủ động, không giả định có cổng phê duyệt của GitHub. Quyền khởi chạy theo quyền ghi hiện có của repository, không hứa phân quyền người duyệt độc lập khi gói tài khoản không hỗ trợ.

## 8. Cấp quyền SSH và preflight

Đây là bước provisioning một lần, cần xác nhận tại thời điểm tạo/cấp quyền truy cập:

- Tạo khóa deploy chuyên dụng, ưu tiên tách staging/production. Không dùng hoặc thu thập password cPanel, không đưa private key vào Git/log/chat.
- Public key được cấp quyền trên hosting; private key lưu trong GitHub secrets đúng môi trường. Pin host key đã đối chiếu; không tắt StrictHostKeyChecking.
- Cấu hình khóa SSH bằng forced-command wrapper: chỉ nhận check/upload/deploy/rollback đã cho phép cho đúng môi trường, với release ID được kiểm tra; tắt PTY, agent/X11/port forwarding. Không cấp một shell tùy ý cho CI chỉ để vận chuyển artifact. Builder chọn chi tiết giao thức stdin để không phụ thuộc scp/sftp subsystem với forced command.
- Wrapper không cho truyền lệnh shell, đường dẫn ngoài thư mục môi trường hoặc archive traversal/symlink độc hại. Bootstrap wrapper được cài qua phiên quản trị hiện có, không tự thay thế từ artifact trong cùng lượt deploy.
- Preflight GitHub runner chỉ dùng check action để xác nhận xác thực, quyền truy cập đúng thư mục, Node/npm và các công cụ cần thiết. Không deploy production trong preflight.

Tài khoản hosting còn phục vụ vhplastic.com; kiểm tra giới hạn wrapper bắt buộc bao gồm việc không nhận path hoặc thao tác lên website đó. Giới hạn này giảm rủi ro truy cập bằng key, không sandbox code Node độc hại cùng UNIX user.

## 9. Kích hoạt release và routing

Mỗi artifact được xác minh checksum rồi giải nén vào thư mục release mới. Giữ `flock` suốt upload/kích hoạt/rollback của một môi trường. Không giải nén trực tiếp lên website đang chạy, không xóa document root để deploy.

Đề xuất dùng một con trỏ `current` đổi bằng rename/symlink nguyên tử trên cùng filesystem, với launcher Passenger ổn định đọc backend từ current. Cấu hình frontend ổn định phục vụ nội dung frontend của current và bỏ qua `/api`, `/node-test`, `.well-known`. Passenger mount và cấu hình Node không thuộc các file FE bị chép đè mỗi lần deploy.

Đây là giả định cần chứng minh trên staging: Apache có thể phục vụ symlink nội bộ tài khoản và SPA fallback đúng; launcher đọc current đúng sau restart. Nếu không đạt, dừng trước production và sửa thiết kế activation, không hứa zero downtime.

Sau khi chọn current mới, restart Passenger và poll `/api/version` đến đúng release, sau đó kiểm tra frontend release và browser smoke test. Thời gian chuyển có thể có độ trễ; backend MVP phải tương thích với frontend trước đó. Không mô tả FE/BE như một giao dịch HTTP nguyên tử hoặc hệ thống zero downtime.

File JS/CSS có hash được giữ trong kho assets công khai dùng chung trong từng môi trường để tab còn mở vẫn tải được chunk cũ sau khi index đổi. Không ghi đè file cùng hash bằng nội dung khác; giữ ít nhất 30 ngày, không prune file thuộc current/previous hoặc release còn được giữ. Index/manifest dùng no-cache hoặc no-store, API test dùng no-store. Giữ nguyên URL `/catalogue` và các tài nguyên công khai hiện có; lần chuyển đầu phải chứng minh các ảnh này vẫn đọc được.

## 10. Rollback, chuyển đổi lần đầu và lưu trữ

- Giữ tối thiểu current và 5 release thành công gần nhất, cộng các assets cần retention. Kiểm tra dung lượng trước upload để không làm đầy hosting 15 GB; cleanup không xóa active release, mount API, env, Node virtualenv hoặc file website khác.
- Nếu health/version/frontend smoke thất bại sau activation: đổi current về previous, restart, kiểm tra lại và báo deploy thất bại. Nếu rollback không đạt, báo riêng; không đánh dấu thành công.
- Workflow rollback thủ công chọn release trước đã có trên hosting, không yêu cầu artifact vẫn còn trên GitHub.
- Trước cutover production đầu tiên, chụp lại bản static đang hoạt động thành baseline release và lưu cấu hình routing cũ, để rollback được ngay cả khi chưa có release Node chính thức trước đó. Không thay đường dẫn document root trong cutover nếu chưa chứng minh trên staging.
- Chứng minh rollback trên staging trước khi kích hoạt production. Chưa có database nên không có migration hay rollback dữ liệu.
- Giữ app /node-test hiện tại trong giai đoạn chuyển đổi. Cơ chế deploy/cpanel-prod cũ được giữ để tham khảo nhưng không tiếp tục chạy đồng thời sau cutover; tài liệu nêu rõ nó có thể ghi đè routing mới. Không force-push hoặc xóa lịch sử nhánh cũ.

## 11. Điều kiện nghiệm thu

1. Local đạt toàn bộ mục 4a: một lệnh chạy FE/BE, reload/debug hai phía, cleanup tiến trình Windows, kiểm tra và preview release; trang /api-test thể hiện lỗi khi backend không kết nối.
2. PR lỗi bị CI phát hiện; tất cả kiểm tra liên quan chạy được mà không cần secret production.
3. Main thành công tạo artifact nhận dạng duy nhất; staging tự deploy và version FE/BE khớp release.
4. Routing API trả JSON, kể cả 404; đường dẫn React sâu và ảnh catalogue hoạt động sau refresh.
5. Production chỉ promotion artifact có chứng cứ CI/staging đạt, từ chối release thiếu chứng cứ hoặc checksum sai.
6. Bản deploy lỗi rollback được trên staging; production lần đầu có baseline rollback đã kiểm tra.
7. Deploy không thay đổi /node-test, cấu hình Passenger, secret hoặc website vhplastic.com.
8. Có log deploy cho biết release, môi trường, các bước và kết quả; không chứa private key/secret.

## 12. Việc còn giao cho người triển khai và các điểm dừng

Người triển khai chọn chi tiết cấu trúc module, thư viện test HTTP và cách viết wrapper, giữ Node 24 và TypeScript/Express như thiết kế. Chọn phiên bản dependencies tương thích tại thời điểm thực hiện, không suy diễn version hosting khác với kết quả đã đo.

Các bước chỉ triển khai sau duyệt thiết kế/kế hoạch: provisioning staging DNS/SSL và hai Node apps, cài wrapper, cấp SSH key, GitHub environments/secrets/workflows. Nếu gặp bước tạo/cấp credential phải xác nhận thao tác cụ thể tại thời điểm thực hiện. Chưa có xác thực SSH runner, chưa xác minh gói GitHub, chưa chứng minh symlink/routing staging: đây là các cổng kiểm tra của kế hoạch, không phải kết quả đã hoàn tất.


## Cập nhật triển khai 31/10/2026

Do người dùng không vào được Tino DNS, staging dùng hostname tạm `bibi-staging.103-130-217-103.sslip.io` đã kiểm chứng DNS/HTTPS; document root vẫn `/home/vhplasti/staging.bibistudio.vn`. Đây là phụ thuộc DNS bên ngoài tạm thời; đổi lại hostname khi DNS gốc được khôi phục. Production vẫn `bibistudio.vn`. GitHub runner SSH/Node24.22.2, immutable artifact, Passenger, smoke và giữ assets tab cũ đã được kiểm chứng qua run thật. Production environment chỉ nhận main và có required reviewer chủ repo, cho phép tự duyệt; không coi đó là người duyệt độc lập.
