# BiBi Studio — hướng dẫn develop, build và deploy

**Trạng thái ngày 31/10/2026:** local FE + Express API, check, build và preview đã triển khai. [CI main 41166043229](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41166043229) và [deploy staging 41166133570](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41166133570) thành công. Release đã nghiệm thu staging/production: `27f4d41f7a2ea9d51ae6497be68c63662c077320-41166043229`, artifact ID `13029302597` (179 MB). [Promotion production 41167399214](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41167399214) đã đạt với cùng artifact; [rollback baseline 41168044956](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41168044956) đạt và checksum trang cũ được xác nhận qua HTTPS. [Khôi phục release 41168281680](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41168281680) cũng đạt; production cuối cùng phục vụ release nêu trên, FE/BE khớp qua smoke độc lập và browser, kể cả hostname www. Key riêng từng môi trường đã được người dùng cấp phép và lưu GitHub secrets. Staging tự nhận push main tiếp theo nên có thể đi trước production.

Bằng chứng: Windows check mới nhất 48 tests (47 đạt, 1 quyền POSIX bỏ qua), Linux CI/check/build đạt, actionlint đạt. Runner SSH check/upload/deploy thật; HTTP và browser kiểm tra FE/BE cùng release, API JSON404, route sâu, ảnh sản phẩm; tab từ baseline giữ được 2 assets cũ khi tải không cache và điều hướng sau deploy. Fixture staging trả HTTP503 đã được kích hoạt có kiểm soát: receiver báo lỗi và tự phục hồi release tốt; smoke độc lập xác nhận phục hồi. Run cũ bị từ chối trước activation. Fixture chỉ phục vụ diễn tập, không phải artifact CI để promotion. `/node-test` và vhplastic.com vẫn trả HTTP200 qua kiểm tra bên ngoài. Production đã qua cùng HTTP/browser smoke và kiểm tra tab cũ; checksum archive staging/production trùng `6165cf01f68aeb9253ed510d0f194234ab14d2e376c403db8f1c6ac7050d6720`.

**Lỗi phát hiện ở lần deploy tiếp theo và đã sửa:** staging run `41168646955` tự rollback vì browser nhận index cũ trong khi API đã mới. LiteSpeed giữ bytes của file public khi đổi symlink nhưng kích thước và mtime epoch vẫn giống nhau. Test HTTP tái hiện fail trước sửa; deploy tool `de98fdf` cập nhật mtime tăng đơn điệu của file public không có hash mỗi lần activation/rollback, giữ nguyên nội dung artifact và assets có hash. [Linux CI 41169611969](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41169611969) đạt. Tool đã cài trên hosting từ đúng commit/checksum; thử thật rollback `27f4d41` rồi deploy lại `0e6cdcc` xác nhận HTML, API và browser đồng bộ cả hai chiều. Run thất bại ban đầu vẫn được giữ nguyên làm bằng chứng, không đổi thành công giả.

**Staging tạm khi chưa vào được Tino:** dùng [bibi-staging.103-130-217-103.sslip.io](https://bibi-staging.103-130-217-103.sslip.io/api-test), DNS công khai đúng IP tài khoản và HTTPS hợp lệ, đã kiểm tra từ máy dev, hosting và runner. `staging.bibistudio.vn` vẫn cần sửa DNS công khai khi lấy lại quyền quản lý. Domain cPanel `inventive-tan-mole.103-130-216-108.cpanel.site` trỏ IP khác nên không dùng. Production tiếp tục dùng `bibistudio.vn`.

Tài liệu này dành cho người phát triển và agent khi cần chạy local, kiểm tra thay đổi, phát hành, rollback hoặc điều tra deploy. Quyết định kiến trúc và điều kiện triển khai được ghi tại [thiết kế CI/CD](superpowers/specs/2026-10-30-bibistudio-cicd-design.md).

## 1. Đọc nhanh

Chỉ cần nhớ ba lệnh local:

| Việc cần làm | Lệnh | Khi nào hoàn thành |
|---|---|---|
| Develop và debug | `npm run dev` | FE/BE cùng sẵn sàng, trình duyệt gọi được API local |
| Kiểm tra trước commit/PR | `npm run check` | TypeScript, lint theo phạm vi, ảnh và toàn bộ test đều đạt |
| Build FE + BE | `npm run build` | Có gói phát hành và manifest nhận dạng phiên bản, exit code 0 |

Cài dependencies lần đầu hoặc khi lockfile thay đổi bằng `npm ci`; hook tự cài backend và deploy tools theo các lockfile riêng. Dùng Node major 24 và bảo đảm `node --version` trả v24 trước khi chạy npm. Node khác sẽ bị hook từ chối. Sau khi provisioning CD hoàn tất, GitHub Actions đảm nhiệm deploy, máy dev không cần SSH để phát hành.

Muốn thử bản build trên máy: `npm run build -- --preview`. Đây là tùy chọn của lệnh build, không phải một luồng deploy.

## 2. Ba môi trường

| Môi trường | Frontend | API | Mục đích |
|---|---|---|---|
| Local | http://localhost:5173 | /api qua proxy tới 127.0.0.1:3001 | Code và debug |
| Staging — đã deploy và test | https://bibi-staging.103-130-217-103.sslip.io | /api cùng tên miền | Thử bản phát hành trên cPanel |
| Production | https://bibistudio.vn | /api cùng tên miền | Website công khai |

Backend ban đầu có ba API GET: `/api/health`, `/api/version`, `/api/demo`. Chưa có database hoặc tài khoản đăng nhập. `/api-test` là trang riêng để xem trạng thái, phiên bản FE/BE, dữ liệu demo và lỗi kết nối.

Production có các API này qua Passenger Node24. App thử cũ `https://bibistudio.vn/node-test/` vẫn riêng biệt.

## 3. Chạy và debug local

1. Cài Node 24, lấy source và chạy `npm ci` tại root repository. Hoàn thành khi dependencies của cả FE/BE đã sẵn sàng; không cần secret hosting, MySQL hoặc Docker cho API demo.
2. Chạy `npm run dev`. Terminal phải báo URL FE và tình trạng BE; log có tiền tố `[FE]` và `[BE]`. Nếu lỗi hoặc cổng bận, xử lý lỗi thay vì coi một tiến trình còn sống là đủ.
3. Mở `/api-test` trên URL FE. Hoàn thành khi giao diện hiển thị được dữ liệu từ API local; browser request `/api` không được đi sang hosting.
4. Sửa FE để kiểm tra HMR; sửa BE để kiểm tra restart. FE debug bằng browser DevTools. BE debug TypeScript bằng Node inspector `127.0.0.1:9230`; đặt breakpoint và attach bằng debugger hỗ trợ Node. Debugger phải gắn lại được sau restart. Cấu hình editor là tiện ích tùy chọn.
5. Chạy `npm run check` trước khi gửi thay đổi. Sửa các kiểm tra thất bại, đọc đúng exit code và kết quả từng nhóm.
6. Nhấn Ctrl+C để dừng cả FE/BE. Xác nhận có thể chạy lại ngay, không bị cổng chiếm bởi tiến trình cũ. Quy trình này phải được kiểm tra trên Windows.

Cấu hình tùy chỉnh được mô tả trong `.env.example`; file env thật ở máy người dùng và bị gitignore. API demo có mặc định đủ để khởi động, không yêu cầu chép secrets từ production.

## 4. Build khác với deploy như thế nào

Build biến source thành file có thể chạy/phục vụ trên hosting. Deploy đưa đúng file đó lên một môi trường, chọn nó làm bản đang hoạt động và kiểm tra bằng HTTP. Build thành công chưa chứng minh hosting chạy đúng; push main cũng chưa có nghĩa production đã cập nhật.

`npm run build` tạo artifact gồm frontend static, backend JavaScript đã biên dịch, manifests/lockfile cần cho dependencies runtime và release manifest. Không chứa private key, file env thật hoặc node_modules từ máy Windows.

Local build có nhận dạng local rõ ràng để thử; không được promotion như một bản CI đã kiểm tra. CI build có release ID từ source SHA đầy đủ và CI run ID, kèm checksum. Chính artifact CI này được dùng lại khi promotion staging sang production, không build lại từ latest main.

`npm run build -- --preview` chạy bản đã build local với debug tắt, giúp kiểm tra ảnh, refresh route sâu, API và trang thử bằng browser. Đầu ra preview không phải Passenger; staging vẫn cần kiểm tra routing cPanel thật.

## 5. Từ code đến staging

1. Tạo nhánh tính năng, code local, chạy check và mở PR. CI kiểm tra code PR nhưng không nhận secret deploy.
2. CI chạy cài dependencies, kiểm tra FE/BE và build. PR chỉ sẵn sàng khi các kiểm tra bắt buộc đạt.
3. Merge vào main hoặc nhận thay đổi từ Lovable trên main. CI chạy lại trên commit main và tạo artifact khi đạt.
4. Job staging nhận artifact, xác minh manifest/checksum và đưa lên hosting qua SSH. Thiết kế dùng luồng tar qua SSH với command giới hạn; không phụ thuộc rsync hoặc một shell tùy ý.
5. Hosting chuẩn bị release mới, cài dependencies production BE bằng Node của môi trường đó, kích hoạt release và restart Passenger. API và trang FE phải báo cùng release.
6. Smoke test kiểm tra health, version, demo, ảnh sản phẩm, refresh đường dẫn React sâu và trang `/api-test`. Chỉ đánh dấu staging thành công sau các kiểm tra này.

Nếu CI lỗi thì staging không đổi. Nếu staging lỗi sau activation thì phục hồi release trước và báo lỗi deploy; không tiếp tục production.

## 6. Phát hành production từ GitHub

Workflow phát hành là **Promote production** (`production.yml`).

1. Mở GitHub → Actions → workflow production → Run workflow từ định nghĩa tin cậy trên main.
2. Chọn release ID đã có CI main và staging smoke test thành công. Không chọn một SHA chưa được thử hoặc thay bằng latest main.
3. Workflow kiểm tra chứng cứ, tải đúng artifact và kiểm tra digest. Artifact hết hạn hoặc thiếu chứng cứ thì từ chối; tạo và thử release mới.
4. Hosting triển khai FE/BE cùng release. Job xác nhận version API, version FE và kiểm tra browser/HTTP trước khi báo thành công.
5. Người vận hành đọc kết quả job và mở website kiểm tra một trang sản phẩm cùng `/api-test`. Ghi nhận release ID, source SHA và môi trường đã phát hành.

Production không tự đổi chỉ vì main vừa được push. Environment production đã bật required reviewer `quangminhit1102` và chỉ nhận nhánh main. Sau Run workflow, mở run → Review deployments → chọn production → Approve and deploy. Cấu hình cho phép chủ repo tự duyệt; đây không phải quy trình có người duyệt độc lập. Staging tự chạy, không có gate này.

## 7. Những gì deploy phải giữ nguyên

- Cấu hình Passenger cho `/api`, app root ổn định, env và Node virtualenv do môi trường quản lý.
- Ảnh catalogue, API test hiện có `/node-test` và tài nguyên cần cho tab còn mở ở release trước.
- `.well-known` phục vụ việc xác minh SSL và website vhplastic.com trên cùng tài khoản.

Source release nằm ngoài document root; frontend chỉ phục vụ tài nguyên công khai. Giữ asset JS/CSS có hash theo chính sách retention của thiết kế, không xóa ngay chunk cũ khi đổi index. Hai job không được deploy chồng nhau; hosting khóa theo môi trường và ngăn staging cũ ghi đè bản mới.

## 8. Rollback

Workflow phục hồi là **Rollback** (`rollback.yml`). Dùng khi bản mới sai hoặc kiểm tra sau deploy thất bại.

1. Mở Actions → Rollback → Run workflow trên main; chọn environment và release_id thành công còn trên hosting, hoặc `baseline` cho website static trước cutover.
2. Với production, duyệt Review deployments. Hosting kiểm tra release tồn tại, đổi con trỏ và restart Passenger. Có thể chọn lại release thành công vừa rời đi để khôi phục sau diễn tập; vẫn dùng đúng files trên hosting.
3. Kiểm tra lại API, version FE/BE, trang sản phẩm và ảnh. Baseline static chưa có API demo nên kiểm tra trang/ảnh và checksum baseline. Chỉ coi rollback hoàn thành khi mục tiêu thực sự phục vụ HTTP đúng.
4. Giữ log của lần deploy lỗi để sửa bằng commit mới. Rollback không rewrite Git history.

Baseline production đã sao lưu tại `/home/vhplasti/bibi-deploy/production/releases/baseline`, routing gốc tại `production/baseline.htaccess`. Diễn tập staging lỗi503/tự phục hồi và production baseline/khôi phục release đều đạt ngày 31/10/2026. Hiện chưa dùng MySQL, nên không có migration hoặc phục hồi dữ liệu trong quy trình này.

## 9. Thiết lập một lần trước khi dùng CI/CD

Đây là việc provisioning, tách khỏi thao tác phát hành hằng ngày:

| Bước | Tiêu chí hoàn thành |
|---|---|
| Staging domain, DNS và SSL | Hostname staging tạm nêu trên đã có DNS/HTTPS hợp lệ |
| Node apps staging/production | /api mount đúng từng môi trường, app root riêng |
| Routing và chuyển release | Chứng minh symlink/current, SPA fallback và restart Passenger trên staging |
| Bootstrap deploy wrapper | Chỉ cho check/upload/deploy/rollback trong môi trường được phép |
| SSH deploy keys | Có xác nhận tạo/cấp quyền; khóa chuyên dụng, không đưa private key vào Git/chat/log |
| GitHub environments/secrets | Cấu hình đúng môi trường, host key được pin, preflight từ runner thành công |
| CI và staging | Commit main hợp lệ tạo artifact và tự deploy staging |
| Production baseline | Có bản cũ để phục hồi, diễn tập rollback staging đạt |

Host SSH: `h217103.tino.org:22`, tài khoản cPanel `vhplasti`. Fingerprint ED25519 đã đối chiếu qua phiên cPanel nằm trong tài liệu thiết kế và được pin trong deploy client. SSH staging bằng deploy key đã đăng nhập/check thực tế; GitHub runner authentication/check/upload/deploy đã đạt trong run 41166133570. Public key staging có `restrict` và forced-command receiver cố định cấu hình staging; private key không nằm trong Git/log/chat. GitHub environment staging chỉ cho nhánh main. Production cũng có key riêng và forced-command trỏ config production; runner check/upload/deploy đã đạt trong run 41167399214.

Secret được source sử dụng là `DEPLOY_SSH_KEY`, riêng trong mỗi GitHub environment `staging` và `production`. Host, user và ED25519 known-host key được pin trong `scripts/deploy-client.mjs`. Không dùng `StrictHostKeyChecking=no`. Đường dẫn deploy nằm trong cấu hình receiver ngoài Git trên server, không nhận đường dẫn từ workflow input.

Workflow source: [CI](../.github/workflows/ci.yml), [Deploy staging](../.github/workflows/staging.yml), [Promote production](../.github/workflows/production.yml), [Rollback](../.github/workflows/rollback.yml). CI chạy check/build giống local; chỉ main push mới xuất artifact `release-<SHA>-<run ID>`, giữ 30 ngày. Production nhận đúng release ID, kiểm tra CI main thành công và deployment staging thành công cùng artifact ID/checksum trước SSH; không build lại. Hết hạn artifact thì tạo release mới qua CI/staging.

Deploy tools nằm riêng tại `/home/vhplasti/bibi-deploy/tools`, không bị archive ứng dụng ghi đè. Khi sửa `ops`, agent phải kiểm tra source, cài đúng commit qua cPanel administration và đối chiếu checksum; push/deploy ứng dụng không tự cập nhật receiver. Bản `deploy.cjs` đang bootstrap là `de98fdffdf38e8dbcd96f4abdec69077f16f4d8e`, SHA256 `2186f97d95e127c7a5c30d00437774efed73f60959ea4ba22ae8c4e45a4a7ede`. Đây là provisioning; ba lệnh local và thao tác phát hành hằng ngày không thay đổi.

Receiver dùng `flock` theo môi trường, kiểm tra archive/checksum trước giải nén, cài runtime dependency bằng `npm ci --omit=dev --ignore-scripts`, chuyển current, restart Passenger và kiểm tra HTTP. Giữ current/previous/baseline và năm release thành công gần nhất. Assets có hash được giữ lâu hơn tối thiểu 30 ngày; hiện không tự prune assets, quota chặn upload mới khi vượt ngân sách. Operator phải kiểm tra dung lượng trước khi tăng quota hoặc dọn assets.

## 10. Khi gặp lỗi

| Hiện tượng | Kiểm tra đầu tiên | Điều kiện xử lý xong |
|---|---|---|
| Local không khởi động | Phiên bản Node, kết quả npm ci, cổng FE/BE/inspector | Cả FE/BE sẵn sàng và trang test nhận JSON |
| API trả HTML | API mount có bị React fallback bắt không, Passenger còn cấu hình không | API trả JSON và đúng mã HTTP |
| Ảnh sản phẩm lỗi | Kiểm tra ảnh catalogue, URL và Content-Type thực tế | File ảnh tồn tại, trình duyệt decode được |
| CI thất bại | Đọc bước lỗi đầu tiên, chạy check/build local tương ứng | Kiểm tra thất bại đã được sửa và CI mới đạt |
| SSH từ runner lỗi | Host/port, key scope, host-key pin, thông báo xác thực | Preflight đúng tài khoản và đúng thư mục, không cần shell tùy ý |
| Staging/production còn bản cũ | Release ID, kết quả activation/restart, cache index | FE và BE báo đúng release dự kiến |
| Deploy lỗi sau activation | Log bước lỗi và kết quả rollback | Release trước hoạt động hoặc báo rõ rollback cũng thất bại |

## 11. Checklist cho agent

1. Đọc trạng thái đầu tài liệu và source thực tế. Lệnh trong package.json, workflow files và kết quả HTTP là bằng chứng vận hành; câu mô tả dự kiến không chứng minh tính năng đã có.
2. Xác định yêu cầu là chạy local, sửa code, build, deploy staging, production hay rollback. Ghi rõ môi trường và release cần tác động.
3. Khi sửa code: giữ mô hình catalogue theo AGENTS.md, chạy check và build đúng phạm vi; kết quả test không thay thế kiểm tra hosting khi nhiệm vụ là deploy.
4. Khi deploy: dùng luồng phát hành đã thống nhất, kiểm tra trước/sau và giữ rollback. Thao tác cấp credential phải có xác nhận cần thiết.
5. Báo cáo kết quả: commit/release, môi trường, checks đã chạy, kết quả thực tế, còn bước nào chưa hoàn tất. Phân biệt source đã push, artifact đã build và website đã cập nhật.
6. Khi quy trình được triển khai: cập nhật trạng thái tài liệu, tên lệnh/workflow, link tới source cấu hình và bằng chứng nghiệm thu. Giữ hướng dẫn nhất quán với thiết kế; nếu thay đổi kiến trúc thì cập nhật cả hai.

## 12. Luồng deploy FE cũ — chỉ lưu để tham khảo

Nhánh artifact `deploy/cpanel-prod` thuộc luồng cũ đã được thay bằng CI/CD release. `npm run build:cpanel` build FE; `npm run deploy:cpanel:prod:push` build, commit và có thể push nhánh artifact; cPanel dùng Update from Remote → Deploy HEAD Commit.

[Hướng dẫn cPanel cũ](cpanel-artifact-deploy.md) chỉ lưu để tham khảo. Script hiện chỉ push khi tạo được commit mới; nếu đã có commit artifact local mà build không đổi thì cần kiểm tra trạng thái nhánh và push commit đó riêng theo tài liệu.

Không dùng luồng deploy FE cũ song song với CI/CD release vì nó có thể ghi đè routing mới. Giữ lịch sử để tham khảo; rollback dùng release của hệ thống mới hoặc baseline đã chuẩn bị, không force-push.
