# BiBi Studio — develop, build, deploy và rollback

## Chế độ hiện tại: chỉ production, phát hành thủ công

Luồng hoạt động: **code → CI kiểm tra/build → Run workflow Deploy production → duyệt production → deploy → smoke test → tự phục hồi nếu lỗi**. Push main chỉ tạo artifact, không tự thay đổi website.

Staging tạm ngừng theo yêu cầu người dùng. YAML được giữ tại `.github/workflows-disabled/staging.yml`; domain, files, credentials và lịch sử run được giữ để bật lại. Production không còn yêu cầu một deployment staging thành công. Đổi lại, release mới được thử trên hosting lần đầu ngay tại production; giữ gate duyệt, baseline/bản trước và rollback.

Trạng thái website hiện tại phải đọc từ [API version](https://bibistudio.vn/api/version) hoặc [API test](https://bibistudio.vn/api-test), đối chiếu với run GitHub. Không suy luận website đã cập nhật chỉ từ một build thành công.

## 1. Ba lệnh local

Dùng **Node 24**; cài dependencies lần đầu hoặc sau đổi lockfile bằng `npm ci`. Hook cài cả backend và deploy tools theo lockfile riêng. Không cần secret hosting, MySQL hoặc Docker để chạy API demo.

| Việc | Lệnh | Kết quả cần thấy |
|---|---|---|
| Develop/debug FE và BE | `npm run dev` | FE/BE cùng READY, `/api-test` gọi API local |
| Kiểm tra | `npm run check` | TypeScript, lint theo phạm vi, ảnh và tests đều đạt |
| Build FE và BE | `npm run build` | Artifact và checksum được tạo, exit 0 |

Tùy chọn xem bản build local: `npm run build -- --preview`.

FE mặc định `http://localhost:5173`; `/api` proxy tới BE `127.0.0.1:3001`. Trang `/api-test` hiển thị version FE/BE, dữ liệu demo, lỗi và nút thử lại. FE có HMR; BE tự restart khi sửa source. Inspector BE là `127.0.0.1:9230`; debugger hỗ trợ Node có thể attach, pause/resume và debug TypeScript. Log có tiền tố FE/BE, báo UNAVAILABLE khi BE lỗi và READY sau khi phục hồi. Ctrl+C dừng cả hai; có thể khởi động lại mà không bị giữ cổng.

`.env.example` mô tả tùy chỉnh local; env thật bị gitignore. Không chép key/env production vào source. API hiện tại chỉ có GET `/api/health`, `/api/version`, `/api/demo`, JSON404/405; chưa có database, đăng nhập, quản trị hoặc upload.

## 2. CI và artifact

[CI](../.github/workflows/ci.yml) chạy cho PR và push main/codex. PR không nhận deploy secrets. CI dùng Node24, `npm ci`, `npm run check`, `npm run build`. Chỉ successful main-push CI mới tạo artifact phát hành.

Artifact tên `release-<source SHA đầy đủ>-<CI run ID>`, chứa `<release ID>.tgz` và `.tgz.sha256`, giữ 30 ngày theo giới hạn GitHub. Archive gồm frontend static, backend JavaScript đã biên dịch, backend package/lockfile và manifest; không chứa env thật, private key, node_modules, symlink hoặc source triển khai tùy ý. Local build mang tiền tố `local-` và không được dùng để phát hành.

Production xác minh CI run là push main thành công, đúng repository/workflow/SHA; chọn đúng artifact còn hạn theo tên/ID, tải chính artifact đó và so sánh SHA256 archive với sidecar của artifact CI. Không build lại trên đường phát hành. Khi staging tắt, không có checksum độc lập lấy từ staging; cả archive và sidecar phải đến từ artifact CI đã xác minh.

## 3. Deploy production

Workflow: [Deploy production](../.github/workflows/production.yml).

1. Mở CI main đã thành công, lấy release ID `<SHA>-<run ID>` từ tên artifact. Không dùng latest main thay cho một release cụ thể.
2. Actions → Deploy production → Run workflow → chọn branch `main` → nhập release ID.
3. Mở run → Review deployments → chọn production → Approve and deploy. Environment chỉ nhận main, required reviewer là `quangminhit1102`; cho phép chủ repo tự duyệt, không phải người duyệt độc lập.
4. Workflow kiểm tra nguồn CI/artifact, SSH check, upload và checksum, chuẩn bị release, cài dependencies production BE, đổi current, restart Passenger.
5. Chỉ báo deploy đạt sau HTTP/version/API404, browser ảnh sản phẩm, `/api-test` FE/BE khớp và kiểm tra assets/điều hướng của tab còn mở từ bản trước.
6. Mở website kiểm tra một sản phẩm và `/api-test`; đối chiếu release ID của API với run.

CI hoặc upload lỗi trước activation thì website không chuyển. Receiver kiểm tra hosting sau activation; nếu lỗi sẽ trả current/routing về bản trước và xác minh phục hồi. Nếu HTTP/browser/old-client smoke phía runner lỗi sau server activation, deploy client gọi rollback bản trước, kiểm tra phục hồi rồi báo job thất bại. Nếu rollback cũng lỗi, job báo rõ `ROLLBACK FAILED`; không coi đây là deploy thành công.

## 4. Rollback production

Workflow: [Rollback production](../.github/workflows/rollback.yml). Chỉ có production, không cần chọn môi trường.

1. Actions → Rollback production → Run workflow trên main.
2. Nhập release ID đã thành công và còn trên hosting; hoặc `baseline` để về website static trước cutover.
3. Duyệt production như deploy. Hosting kiểm tra release, đổi con trỏ, phục hồi routing phù hợp, restart và xác minh HTTP.
4. Đối chiếu FE/BE, trang sản phẩm và ảnh. Baseline chưa có API demo nên kiểm tra static và checksum baseline. Có thể chọn lại release thành công vừa rời đi để phục hồi sau diễn tập.

Deploy và rollback dùng chung concurrency group `deploy-production`, không cancel run đang chạy; receiver còn khóa `flock` trên server. Baseline/bản thành công trước là điều kiện bắt buộc trước activation production. Giữ active, previous, baseline và năm release thành công gần nhất. Rollback không rewrite Git history và không rebuild.

Không cố tình đưa fixture hỏng lên production. Mọi diễn tập rollback gây chuyển website thật phải thuộc phạm vi người dùng duyệt. Khi thêm database sau này, cần thiết kế migration/rollback dữ liệu riêng.

## 5. Hosting và những thứ phải giữ

| Thành phần | Giá trị |
|---|---|
| Website | `https://bibistudio.vn`, gồm hostname www |
| Document root | `/home/vhplasti/bibistudio.vn` |
| Release root | `/home/vhplasti/bibi-deploy/production` |
| Stable Passenger app | `production/app`, startup `app.cjs`, mount `/api`, Node24 |
| Runtime bin | `/home/vhplasti/nodevenv/bibi-deploy/production/app/24/bin` |
| Baseline | `production/releases/baseline`, routing `production/baseline.htaccess` |
| Receiver/config | `/home/vhplasti/bibi-deploy/tools/receiver.cjs`, `production/config.json` |
| SSH | `vhplasti@h217103.tino.org:22` |

`/node-test` vẫn là app riêng hiện có. Giữ `.well-known`, catalogue và website vhplastic.com trên cùng tài khoản. Public `_bibi` trỏ frontend của current, `/assets` giữ assets có hash cho tab cũ. Source release nằm ngoài document root.

Deploy tool làm mới mtime của các file public không có hash mỗi lần activation/rollback vì LiteSpeed đã từng giữ index cũ có cùng kích thước/mtime epoch. Nội dung artifact và checksum không đổi; assets có hash được giữ nguyên. Marker thời gian theo môi trường tăng ít nhất một giây để đổi nhanh/rollback cũng không dùng lại bytes cũ.

Quota hiện cấu hình 4 GiB/môi trường, kiểm tra thêm disk space/extraction/runtime headroom. Assets có hash chưa tự prune, giữ lâu hơn tối thiểu 30 ngày; quota sẽ chặn upload mới khi hết ngân sách. Kiểm tra dung lượng trước khi tăng quota hoặc dọn file đã hết hạn.

## 6. Truy cập và bootstrap

Secret hoạt động là `DEPLOY_SSH_KEY` trong GitHub environment `production`. Key riêng có `restrict` và forced-command receiver cố định config production; không phải shell tùy ý. Private key không nằm trong Git/chat/log. Host ED25519 được pin trong deploy client, fingerprint đã đối chiếu qua cPanel: `SHA256:92PBre+MLZdaWoqr7qS8vtHaj8aiCXIDpKlOrZJ5p90`. Không dùng `StrictHostKeyChecking=no`.

Deploy tools ở `/home/vhplasti/bibi-deploy/tools`, ngoài archive ứng dụng. Sửa `ops` cần kiểm tra source và bootstrap qua cPanel với đúng commit/checksum; deploy ứng dụng không tự ghi đè receiver. Bản `deploy.cjs` đã kiểm chứng là `de98fdffdf38e8dbcd96f4abdec69077f16f4d8e`, SHA256 `2186f97d95e127c7a5c30d00437774efed73f60959ea4ba22ae8c4e45a4a7ede`. Thay đổi production-only ở workflow/scripts không cần đổi tool này.

Tạo/cấp quyền key mới, mở rộng truy cập hoặc chuyển production lần đầu cần xác nhận phù hợp. Không đọc/in private key để điều tra một job lỗi.

## 7. Staging đang tắt và cách bật lại

Staging hosting cũ vẫn được giữ tại `/home/vhplasti/staging.bibistudio.vn`, release root `/home/vhplasti/bibi-deploy/staging`. Hostname tạm `bibi-staging.103-130-217-103.sslip.io` đã dùng được DNS/HTTPS; domain `staging.bibistudio.vn` chưa resolve DNS công khai khi nghiệm thu. Staging không thuộc luồng phát hành hiện tại.

Để khôi phục luồng staging → production:

1. Kiểm tra lại hosting/DNS/HTTPS, Node app, secret và main-only environment staging. Hostname tạm phụ thuộc DNS bên ngoài; có thể đổi BASE_URL sau khi domain chính được xác minh.
2. Chuyển `.github/workflows-disabled/staging.yml` về `.github/workflows/staging.yml`, bật lại workflow trong GitHub nếu đang disabled.
3. Đổi `REQUIRE_STAGING_BEFORE_PRODUCTION` thành `true` trong `scripts/release-policy.mjs`. Cả validation GitHub và checksum client cùng dùng chính sách này; phải khôi phục gate staging, không chỉ chuyển YAML.
4. Cập nhật policy tests theo chế độ mới, chạy check/actionlint và main CI/staging thật. Chỉ promote sau successful staging evidence đúng artifact ID/checksum; không suy luận từ build.

Không xóa domain, key, secret hoặc các run cũ chỉ để làm sạch sidebar GitHub. Lịch sử staging có thể còn hiển thị dù workflow đã tắt.

## 8. Bằng chứng đã có và xử lý lỗi

Đây là các mốc nghiệm thu lịch sử, không phải nguồn trạng thái live:

- Windows local FE/BE/watch/recovery/debug inspector/stop và artifact preview đã thử thật; Linux CI/check/build và actionlint đã đạt.
- [Production20f9f2a](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41173071609) đạt HTTP/browser/images/old-client, FE/BE cùng release; www và `/node-test`200.
- [Rollback baseline](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41168044956) và [khôi phục release](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41168281680) đã thử qua gate thật; checksum baseline index khớp qua HTTPS.
- [Staging20f9f2a](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41170107813) đạt sau sửa LiteSpeed cache. Trước đó fixture503 tự rollback và run cũ bị từ chối; [run41168646955](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41168646955) giữ nguyên trạng thái lỗi để ghi nhận bug cache và recovery.
- Production-only đã nghiệm thu bằng [CI main41188480787](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41188480787) và [manual production41188651522](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41188651522), release `0bc74538db34e673123370cfc422f449e7823533-41188480787`, không có staging deployment cho SHA này. HTTP/browser/images/old-client đạt; kiểm tra độc lập FE/BE khớp, www/API200. Receipt giữ bản trước20f9f2a để rollback. Đây không phải một lần diễn tập rollback mới.

| Lỗi | Kiểm tra đầu tiên |
|---|---|
| Local không chạy | Node24, npm ci, cổng5173/3001/9230 |
| API trả HTML | Passenger mount/routing, content-type, `/api-test` |
| Ảnh lỗi | URL catalogue, file/signature và browser decode |
| Artifact bị từ chối | CI main push/repository/SHA, artifact name/ID/expiry, sidecar SHA256 |
| SSH lỗi | Environment secret, key scope, host pin, preflight; không mở shell rộng hơn |
| FE/BE lệch | `/api/version`, `/version.json`, HTML script và mtime thực tế, log rollback |
| Deploy lỗi | Đọc lỗi đầu tiên và kết quả recovery; `ROLLBACK FAILED` cần xử lý ngay |

Agent cần đọc tài liệu này trước khi đổi local/CI/deploy/rollback; xác định release/môi trường, kiểm tra trước/sau, báo rõ commit/build/run/live state và giới hạn chưa kiểm chứng. Lệnh package.json, workflow source, response HTTP và kết quả browser là bằng chứng vận hành.

Luồng `deploy/cpanel-prod`/`deploy:cpanel:prod:push` cũ chỉ lưu lịch sử ở [cpanel-artifact-deploy.md](cpanel-artifact-deploy.md). Không chạy song song để tránh ghi đè routing release mới; không force-push lịch sử Lovable.
