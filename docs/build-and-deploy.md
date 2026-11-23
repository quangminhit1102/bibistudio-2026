# BiBi Studio — develop, build, deploy và rollback

## Chế độ hiện tại: chỉ production, tự phát hành khi CI main đạt

Luồng hoạt động: **push main → CI kiểm tra/build song song → Deploy production tự chạy với đúng artifact của lần CI đó → deploy → smoke test → tự phục hồi nếu lỗi**. Vẫn chạy tay được Deploy production và Rollback production bất cứ lúc nào (mục 3 và 4). PR và nhánh khác không bao giờ deploy.

Tạm dừng tự phát hành: đặt repository variable `AUTO_DEPLOY` = `false` (Settings → Secrets and variables → Actions → Variables), hoặc ghi `[skip deploy]` trong commit message của commit mới nhất trong lần push. Xóa biến hoặc đổi giá trị khác `false` để bật lại. Khi tạm dừng, CI vẫn tạo artifact và deploy tay vẫn dùng được.

**Relay IP/quốc gia đã phát hành 14/11:** release `032ec991fe11673b8a00298c0276fbcad59fa83b-43563390060`, production43566445860 và forward43568216450 Success; rollback43567948441 về v5 đã kiểm chứng. Hai nguồn Windows/hosting, hai hostname, HMAC/replay/privacy/auth và UI desktop/mobile đạt. Giữ trust=false; IP Chưa xác minh, quốc gia Ước lượng. Xem [biên bản và giới hạn](superpowers/reports/2026-11-14-visitor-relay-acceptance.md).

**Analytics13/11 đã phát hành production:** release `ee12307cf68f45484d59c3b77c2f6f7f83a07f47-43382604855`, [workflow43383614666](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/43383614666) Success. Có bộ lọc ngày1/6/12tháng/custom, chart theo phiên, chi tiết gọn và lịch sử không TTL. Manifest5 dùng visitor ledger1 riêng, auth schema vẫn4. Đã nâng receiver, native backup/restore, gỡ đúng importer/TTLcron và rollback thật về3beb58f rồi forward; giữ dữ liệu log cũ. Sửa CageFS bằng cách bỏ SSH_ORIGINAL_COMMAND chỉ khỏi child crontab, không khỏi receiver. **IP thật vẫn chưa đạt; trust=false, UI hiển thị Chưa xác định** theo phạm vi chủ website yêu cầu deploy. Xem [biên bản production](superpowers/reports/2026-11-13-visitor-analytics-production-release.md), [vận hành analytics](visitor-analytics-operations.md) và [yêu cầu Tino](visitor-ip-hosting-request.md).

Staging tạm ngừng theo yêu cầu người dùng. YAML được giữ tại `.github/workflows-disabled/staging.yml`; domain, files, credentials và lịch sử run được giữ để bật lại. Production không còn yêu cầu một deployment staging thành công. Đổi lại, release mới được thử trên hosting lần đầu ngay tại production; giữ gate duyệt, baseline/bản trước và rollback.

Trạng thái website hiện tại phải đọc từ [API version](https://bibistudio.vn/api/version) hoặc [API test](https://bibistudio.vn/api-test), đối chiếu với run GitHub. Không suy luận website đã cập nhật chỉ từ một build thành công.

**Profile đợt2 đã phát hành07/11:** release `da41998cafcce0feee301e168995874c590303bb-42356811515`, hồ sơ tự phục vụ/phone/avatar, feature schema1/manifest4, receiver và private assets đã cấu hình. CI/build, upload PNG/JPEG/gần2MiB, UI desktop/mobile và paired restore có ảnh đạt; đợt đầu gặp LiteSpeed406 đã rollback rồi phát hành bản JSON có giới hạn. Xem [biên bản production](superpowers/reports/2026-11-07-admin-profile-production-release.md) và [vận hành hồ sơ](admin-profile-operations.md). Local chạy lại `npm run db:setup:local` một lần khi nâng source; lệnh develop hằng ngày không đổi.

## 1. Ba lệnh local

**Relay IP/quốc gia đã kiểm chứng local/CI, chưa phát hành:** sau khi cập nhật source, bật Docker Desktop và chạy `npm run db:setup:local` một lần để chuẩn bị feature schema, khóa relay riêng và dữ liệu quốc gia đã khóa checksum. `npm run dev` tự chạy FE, Node và PHP; không cần cài PHP trên Windows hay chạy lệnh PHP riêng. Lần đầu cần tải Docker image PHP đã khóa digest. Ctrl+C dừng cả ba, inspector Node vẫn ở `127.0.0.1:9230`. Preview tự chạy relay nếu runtime có cấu hình tương ứng. IP loopback/private ở local được ghi là chưa xác định; các IP công khai trong bài test là fixture riêng. Khóa local không được dùng cho production. `npm run check` bao gồm kiểm tra PHP/MySQL và trình duyệt thật; `npm run build` vẫn là lệnh đóng gói.

**In phiếu giao hàng đã phát hành12/11:** release `3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf-43259550001`, production43261003682 thành công. Editor bản in riêng lấy dữ liệu khách hàng/sản phẩm browser hiện có, VAT tính thêm, A4 và chữ ký theo mẫu đã duyệt; không ghi phiếu gốc hay đổi schema. Có boundary chỉ đọc để thay API sau này. CI/check/build, UI production và hộp thoại in Edge đã kiểm chứng; giữ release trước `da41998…-42356811515` làm rollback. Xem [biên bản phát hành](superpowers/reports/2026-11-12-delivery-slip-print-release.md).

**Usability06/11 đã phát hành cùng release07/11:** sửa màn edit phiếu bị chờ role local trong HTTP session, dirty guard sản phẩm/bài viết, tooltip sidebar thu gọn, trạng thái chỉ đọc và badge semantic. Đợt1 không đổi DB schema/RBAC; đã đưa source lên production cùng hồ sơ đợt2. Xem [biên bản đợt1](superpowers/reports/2026-11-06-admin-usability-wave1-acceptance.md); các biên bản production bên dưới vẫn chỉ áp dụng release cũ.

**Nhật ký cPanel đã deploy05/11:** release `d7a47285ddd54848b34c58ed6948b871d2b0ba99-42063626652`, workflow42065964107 thành công; API thật đọc được Log mới và9392record archive. Cùng trang Khách truy cập có Log mới (snapshot cache, mặc định), Lịch sử archive (giữ lâu dài) và Khách và sản phẩm hiện có. Feature schema2/manifest3 tách auth schema4, có backup/rollback giữ dữ liệu. Cron `*/15 * * * *` đã cài06/11; quan sát job tự chạy07:45VN thành công, Log mới575record. UI production đã kiểm tra Tải lại/chi tiết/chuyển nguồn/trang94 archive. Owner đã đồng ý kiểm chứng chu kỳ archive thật sau deploy; nguồn IP thực vẫn chưa được xác minh. Xem [vận hành nhật ký](access-log-operations.md) và [acceptance local/live](superpowers/reports/2026-11-05-cpanel-access-log-acceptance.md).

**Đợt auth đã phát hành05/11:** login/RBAC/account/audit/visitor dùng MariaDB cPanel, artifact `e7257b4962d1afd7689234c70cb65fb176e828d3-41852205705`. Deploy, native backup/restore-check và rollback/phát hành lại đã qua; xem [biên bản thực tế](superpowers/reports/2026-11-04-admin-auth-acceptance.md), [vận hành](admin-auth-operations.md) và [API/schema](admin-auth-api.md). Receiver/Passenger đã hỗ trợ schemaVersion2. Riêng IP khách thực chưa đạt: proxy hosting chỉ đưa loopback, không sanitize forwarded headers; giữ trust=false, cần cấu hình phía hosting trước khi chấp nhận số liệu IP.

Admin demo local nằm tại `/admin`, dùng cùng lệnh dev/check/build. Đợt nghiệp vụ 02/11 đã kiểm chứng local và phát hành production tại commit `4c6e070`: khách mua hàng, phiếu VAT có/không, báo cáo, visitors và popup thông báo. Xem [biên bản production](superpowers/reports/2026-11-02-admin-production-release.md). Xem [hướng dẫn admin](admin.md) và [biên bản kiểm chứng](admin-acceptance.md). Dữ liệu/ảnh admin lưu trong trình duyệt, chưa nối Express/MySQL và chưa làm thay đổi catalogue public.

Đợt hoàn thiện UI trước đây dùng fixture login trong trình duyệt. Runtime mới trên `codex/admin-dashboard` dùng HTTP AuthService; không dùng fixture đó để đăng nhập. Account local `admin`/`user01` lấy password bootstrap trong file ignored do setup tạo. Acceptance local không thay đổi các biên bản production cũ.

Dùng **Node24**; cài dependencies lần đầu hoặc sau đổi lockfile bằng `npm ci`. Hook cài cả backend và deploy tools theo lockfile riêng. Để develop auth, bật Docker Desktop rồi chạy một lần `npm run db:setup:local`. DB local được tách khỏi test DB và hosting; không cần secret hosting. Những lần dev sau không tự migrate/seed.

Đợt biên tập 03/11 dùng TinyMCE GPL tự host và chỉ kiểm chứng local, chưa phát hành. `npm ci`, `npm run dev` và các prebuild chuẩn bị asset editor bằng `scripts/prepare-tinymce.mjs`; không cần API key Tiny Cloud hoặc secret CI mới. Asset vendor có version, kèm bản dịch tiếng Việt và giấy phép, được sinh từ dependencies vào `public/vendor/tinymce-<version>/` (Git bỏ qua) rồi đưa vào artifact FE. Cách biên tập/lưu local và tương thích nội dung cũ xem [hướng dẫn admin](admin.md#biên-tập-bài-viết-và-sản-phẩm--local). Không lấy UI local làm bằng chứng đã có CMS backend hay đã deploy production.

| Việc                   | Lệnh            | Kết quả cần thấy                                    |
| ---------------------- | --------------- | --------------------------------------------------- |
| Develop/debug FE và BE | `npm run dev`   | FE/BE cùng READY, `/api-test` gọi API local         |
| Kiểm tra               | `npm run check` | TypeScript, lint theo phạm vi, ảnh và tests đều đạt |
| Build FE và BE         | `npm run build` | Artifact và checksum được tạo, exit 0               |

Xem bản build local: chạy `npm run build`, lấy đường dẫn bundle `.releases/local-<SHA>` từ kết quả, rồi chạy `node scripts/preview.mjs .releases/local-<SHA>`. Shortcut `npm run build -- --preview` hiện gặp vòng import sau khi tạo artifact (đã quan sát ngày 01/11/2026); dùng hai lệnh riêng đến khi tooling được sửa.

FE mặc định `http://localhost:5173`; `/api` proxy tới BE `127.0.0.1:3001`, quản trị ở `/admin`. Trang `/api-test` hiển thị version FE/BE và API cơ bản; `/api/ready` còn kiểm tra private config, schema và Master account. FE có HMR; BE tự restart khi sửa source. Inspector BE là `127.0.0.1:9230`; debugger có thể attach, pause/resume và debug TypeScript. Log có tiền tố FE/BE, báo UNAVAILABLE khi BE lỗi và READY sau khi phục hồi. Ctrl+C dừng cả hai; có thể khởi động lại mà không bị giữ cổng.

`.env.example` mô tả tên cấu hình; env thật bị gitignore. Setup sinh `.env.local` cho runtime và `.env.migration.local` cho thao tác DB có chủ đích. Không chép key/env production vào source hoặc VITE_*. API local mới có auth/account/role/permission/audit/customer-access; các module kinh doanh/content/media vẫn lưu local. Chỉ `/api/health` đạt chưa đủ chứng minh đăng nhập/MySQL sẵn sàng.

### Cấu hình site (`site/`)

Mọi thứ riêng của thương hiệu nằm trong `site/`: `site.config.ts` (tên, domain, liên hệ, SEO, font, module admin), `catalogue.config.ts` (thuộc tính sản phẩm và cách nhóm sản phẩm trong một bộ sưu tập), `theme.css` (màu và font) và `assets/` (logo). Phần lõi (`src/`) chỉ đọc qua `src/platform/site.ts`; `scripts/site-boundary.test.mjs` chạy trong `npm run check` và báo lỗi khi tên thương hiệu, domain, số điện thoại hay email của site xuất hiện lại trong các thư mục lõi đã tách.

Build đọc site từ biến môi trường `SITE_DIR` (mặc định `site`), ví dụ `SITE_DIR=sites/khac npm run build:cpanel`. Thiếu `site.config.ts` hoặc `catalogue.config.ts` thì build dừng và nêu đường dẫn bị thiếu. Trang chủ, giới thiệu, liên hệ, dữ liệu mẫu và `src/data` chưa tách; tên kỹ thuật nội bộ có `bibi` (biến môi trường, cookie, header, khóa lưu trữ) giữ nguyên.

## 2. CI và artifact

[CI](../.github/workflows/ci.yml) chạy cho PR và push main/codex. PR không nhận deploy secrets. Chỉ successful main-push CI mới tạo artifact phát hành.

CI chia thành các job chạy song song, mỗi job một giai đoạn của `scripts/check.mjs`:

| Job       | Lệnh                                                                     | Cần thêm               |
| --------- | ------------------------------------------------------------------------ | ---------------------- |
| `static`  | `node scripts/check.mjs static` (TypeScript, lint, ảnh catalogue)        | không                  |
| `admin`   | `node scripts/check.mjs admin` (Vitest admin)                            | không                  |
| `backend` | `node scripts/check.mjs backend` (test backend/scripts)                  | MariaDB, PHP           |
| `e2e`     | `node scripts/check.mjs e2e <bộ>` — matrix 5 bộ trình duyệt              | MariaDB, PHP, Chromium |
| `build`   | `npm run build`, `node scripts/visitor-context-bundle-check.mjs`, upload | MariaDB, PHP, Chromium |

`npm run check` không tham số vẫn chạy toàn bộ các giai đoạn theo thứ tự như trước; thêm tên giai đoạn để chạy riêng một phần khi debug local. Thêm bộ trình duyệt mới thì thêm vào `E2E_SUITES` trong `scripts/check.mjs` và matrix của job `e2e`; policy test sẽ báo nếu hai nơi lệch nhau. Một job lỗi làm cả CI run lỗi, nên artifact của run đó không được phát hành dù job `build` đã upload.

Artifact tên `release-<source SHA đầy đủ>-<CI run ID>`, chứa `<release ID>.tgz` và `.tgz.sha256`, giữ 30 ngày theo giới hạn GitHub. Archive gồm frontend static, backend JavaScript đã biên dịch, backend package/lockfile và manifest; không chứa env thật, private key, node_modules, symlink hoặc source triển khai tùy ý. Local build mang tiền tố `local-` và không được dùng để phát hành.

Production xác minh CI run là push main thành công, đúng repository/workflow/SHA; chọn đúng artifact còn hạn theo tên/ID, tải chính artifact đó và so sánh SHA256 archive với sidecar của artifact CI. Không build lại trên đường phát hành. Khi staging tắt, không có checksum độc lập lấy từ staging; cả archive và sidecar phải đến từ artifact CI đã xác minh.

## 3. Deploy production

Workflow: [Deploy production](../.github/workflows/production.yml).

**Tự động:** khi CI của một push lên main đạt, workflow này tự chạy với release ID `<SHA>-<run ID>` của chính lần CI đó. Điều kiện: CI kết luận success, sự kiện push, nhánh main, cùng repository, `AUTO_DEPLOY` khác `false` và commit message không có `[skip deploy]`. Không cần thao tác gì; theo dõi ở Actions → Deploy production. Nếu khi run bắt đầu main đã có commit mới hơn (ví dụ chạy lại một CI run cũ), run tự bỏ qua deploy và ghi notice, để bản cũ không đè lên bản mới; muốn deploy bản đó thì chạy tay với release ID.

**Chạy tay** (deploy lại, deploy một bản cụ thể, hoặc khi đang tạm dừng tự phát hành):

1. Actions → Deploy production → Run workflow → chọn branch `main`.
2. Để trống release ID để deploy bản CI main đạt mới nhất; hoặc nhập release ID `<SHA>-<run ID>` (lấy từ tên artifact của CI run) để deploy đúng bản đó.

Cả hai đường đi qua cùng các bước:

1. Workflow kiểm tra nguồn CI/artifact, SSH check, upload và checksum, chuẩn bị release, cài dependencies production BE, chạy migration, đổi current, restart Passenger.
2. Chỉ báo deploy đạt sau HTTP/version/API404, browser ảnh sản phẩm, `/api-test` FE/BE khớp và kiểm tra assets/điều hướng của tab còn mở từ bản trước.
3. Sau deploy, mở website kiểm tra một sản phẩm và `/api-test`; đối chiếu release ID của API với run.

Environment `production` chỉ nhận main. Nếu environment còn required reviewer thì mọi run, kể cả run tự động, dừng ở Review deployments chờ Approve; muốn tự phát hành hoàn toàn phải gỡ reviewer trong Settings → Environments → production. Gỡ reviewer cũng bỏ bước duyệt của deploy tay và rollback.

Vì migration tự chạy khi deploy và rollback không down-migrate (mục 4), commit có migration phá vỡ tương thích nên dùng `[skip deploy]` hoặc `AUTO_DEPLOY=false`, rồi deploy tay khi sẵn sàng.

CI hoặc upload lỗi trước activation thì website không chuyển. Receiver kiểm tra hosting sau activation; nếu lỗi sẽ trả current/routing về bản trước và xác minh phục hồi. Nếu HTTP/browser/old-client smoke phía runner lỗi sau server activation, deploy client gọi rollback bản trước, kiểm tra phục hồi rồi báo job thất bại. Nếu rollback cũng lỗi, job báo rõ `ROLLBACK FAILED`; không coi đây là deploy thành công.

## 4. Rollback production

Workflow: [Rollback production](../.github/workflows/rollback.yml). Chỉ có production, không cần chọn môi trường.

1. Actions → Rollback production → Run workflow trên main.
2. Nhập release ID đã thành công và còn trên hosting; hoặc `baseline` để về website static trước cutover.
3. Nếu environment còn required reviewer thì duyệt production. Hosting kiểm tra release, đổi con trỏ, phục hồi routing phù hợp, restart và xác minh HTTP.
4. Đối chiếu FE/BE, trang sản phẩm và ảnh. Baseline chưa có API demo nên kiểm tra static và checksum baseline. Có thể chọn lại release thành công vừa rời đi để phục hồi sau diễn tập.

Rollback không tắt tự phát hành: push main tiếp theo đạt CI sẽ deploy lại. Nếu rollback vì bản mới lỗi, đặt `AUTO_DEPLOY=false` trước, sửa xong rồi bật lại.

Deploy (tự động lẫn tay) và rollback dùng chung concurrency group `deploy-production`, không cancel run đang chạy; receiver còn khóa `flock` trên server. Baseline/bản thành công trước là điều kiện bắt buộc trước activation production. Giữ active, previous, baseline và năm release thành công gần nhất. Rollback không rewrite Git history và không rebuild. Database rollback chỉ đổi app tương thích schema; không down-migrate hoặc restore đè dữ liệu.

Không cố tình đưa fixture hỏng lên production. Mọi diễn tập rollback gây chuyển website thật phải thuộc phạm vi người dùng duyệt. Release pre-auth được duyệt riêng báo `degradedAdmin:true`; không dùng để khẳng định auth vẫn hoạt động. Xem biên bản auth05/11 ở trên.

## 5. Hosting và những thứ phải giữ

| Thành phần           | Giá trị                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| Website              | `https://bibistudio.vn`, gồm hostname www                                 |
| Document root        | `/home/vhplasti/bibistudio.vn`                                            |
| Release root         | `/home/vhplasti/bibi-deploy/production`                                   |
| Stable Passenger app | `production/app`, startup `app.cjs`, mount `/api`, Node24                 |
| Runtime bin          | `/home/vhplasti/nodevenv/bibi-deploy/production/app/24/bin`               |
| Baseline             | `production/releases/baseline`, routing `production/baseline.htaccess`    |
| Receiver/config      | `/home/vhplasti/bibi-deploy/tools/receiver.cjs`, `production/config.json` |
| SSH                  | `vhplasti@h217103.tino.org:22`                                            |

`/node-test` vẫn là app riêng hiện có. Giữ `.well-known`, catalogue và website vhplastic.com trên cùng tài khoản. Public `_bibi` trỏ frontend của current, `/assets` giữ assets có hash cho tab cũ. Source release nằm ngoài document root.

Deploy tool làm mới mtime của các file public không có hash mỗi lần activation/rollback vì LiteSpeed đã từng giữ index cũ có cùng kích thước/mtime epoch. Nội dung artifact và checksum không đổi; assets có hash được giữ nguyên. Marker thời gian theo môi trường tăng ít nhất một giây để đổi nhanh/rollback cũng không dùng lại bytes cũ.

Quota hiện cấu hình 4 GiB/môi trường, kiểm tra thêm disk space/extraction/runtime headroom. Assets có hash chưa tự prune, giữ lâu hơn tối thiểu 30 ngày; quota sẽ chặn upload mới khi hết ngân sách. Kiểm tra dung lượng trước khi tăng quota hoặc dọn file đã hết hạn.

## 6. Truy cập và bootstrap

Secret hoạt động là `DEPLOY_SSH_KEY` trong GitHub environment `production`. Key riêng có `restrict` và forced-command receiver cố định config production; không phải shell tùy ý. Private key không nằm trong Git/chat/log. Host ED25519 được pin trong deploy client, fingerprint đã đối chiếu qua cPanel: `SHA256:92PBre+MLZdaWoqr7qS8vtHaj8aiCXIDpKlOrZJ5p90`. Không dùng `StrictHostKeyChecking=no`.

Deploy tools ở `/home/vhplasti/bibi-deploy/tools`, ngoài archive ứng dụng. Sửa `ops` cần kiểm tra source và bootstrap qua cPanel với đúng commit/checksum; deploy ứng dụng không tự ghi đè receiver. Bản `deploy.cjs` hiện đã bootstrap từ `032ec991fe11673b8a00298c0276fbcad59fa83b`, SHA256 `52132e6231d0360f61608fd12e8b6431780342f4e4402fbc6bc8950ab93bba53`; stable Passenger và visitor-context/PHP tools cùng source. Thay đổi production-only ở workflow/scripts không cần đổi tool này.

Khi một bước deploy lỗi, log của run Deploy production nêu lý do, không cần vào hosting:

- `npm ci` (cài thư viện backend của bản mới, chạy với `--loglevel=verbose`): `npm ci failed: stopped at the 180 s limit` hoặc `exit code N`, kèm tối đa 25 dòng cuối npm đã in.
- Bước tự kiểm tra (probe): `Private database probe failed (exit code 1; step "version"; SyntaxError, after GET /api/version HTTP 200)`. Tên bước, request cuối và mã HTTP là chữ cố định; lỗi chỉ được nêu bằng tên lớp và mã lỗi (`TypeError ECONNRESET`, `TimeoutError`), không bao giờ in thông báo lỗi, vì thông báo có thể chứa host hay tài khoản DB.
- Các lệnh riêng tư khác (migrate, backup, ...) chỉ thêm cách kết thúc: `exit code N` hoặc `stopped at its time limit`.

Tên bước của probe nằm trong backend của release, nên chỉ có ở release build sau thay đổi này; phần `npm ci` và cách kết thúc nằm trong deploy tools, có hiệu lực sau khi bootstrap lại. Mới kiểm bằng test trên máy phát triển, chưa kiểm trên hosting.

Header bảo mật của trang tĩnh (HSTS, `nosniff`, `Referrer-Policy`, CSP ở chế độ Report-Only) nằm ở hai nơi giống hệt nhau, có test giữ đồng bộ: `public/.htaccess` đi theo mỗi release nên có hiệu lực ngay sau một lần deploy thường cho HTML và file trong `_bibi`; `ops/frontend.htaccess.template` phủ thêm `/assets` nhưng chỉ có hiệu lực sau khi bootstrap lại deploy tools. Smoke in cảnh báo, không làm deploy thất bại, nếu trang thiếu các header này. `/api` dùng header của Helmet.

File có hash trong `/assets` được cache một năm kèm `immutable`: `ops/deploy.cjs` ghi `assets/.htaccess` ngay trong thư mục assets dùng chung mỗi lần activation/rollback và xóa file này khi quay về baseline. Quy tắc không nằm trong release vì bước gộp assets coi mọi file trong `frontend/assets` là bất biến và sẽ từ chối bản sửa sau này. Vì thuộc deploy tools, thay đổi chỉ có hiệu lực sau khi bootstrap lại; trước đó hosting vẫn trả `max-age=604800` mặc định và smoke in cảnh báo, không làm deploy thất bại. Mới kiểm trên Apache `httpd:2.4`, chưa kiểm trên LiteSpeed thật.

API công khai `/api/public/*` trả `Cache-Control: public, max-age=60` cho phản hồi thành công; 404 và lỗi giữ `no-store`. Nội dung vừa sửa trong admin có thể hiện trễ tối đa một phút trên trình duyệt đã mở trang đó.

Migration nội dung: backend và `ops/content-metadata.cjs` chấp nhận schema mới hơn bản đóng gói đúng một bước. Backend coi nội dung là sẵn sàng khi mọi phiên bản nó biết đều `complete` và các phiên bản mới hơn cũng `complete`; nhờ vậy release này là đích rollback hợp lệ sau khi phiên bản 3 chạy. Tools trên host chỉ nhận file thứ ba tên `003_content_catalogue.sql` sau khi bootstrap lại từ commit có thay đổi này. Release đầu tiên mang migration thứ ba vì thế cần hai điều kiện: release có thay đổi này đã lên production, và deploy tools đã bootstrap lại. Thiếu điều kiện thứ hai, receiver từ chối upload với `Invalid content metadata`, production không đổi.

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
- Bộ13 mockup sổ bản đồ đã phát hành ngày01/11/2026 bằng [CI main41255894313](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41255894313) và [production41261096084](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41261096084), release `e1df4d2348eb9e06426afd7584c86a982c8f3278-41255894313`. Workflow và kiểm tra độc lập đạt:13 detail đúng tên/ảnh,13 WebP khớp bytes/SHA256, FE/BE khớp, www và node-test200, tab cũ tải2 assets không dùng cache. Receipt giữ bản trước0bc7453; không diễn tập rollback mới.

- Admin và các chỉnh sửa responsive đã phát hành ngày02/11/2026 qua [CI main41388721286](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41388721286) và [production41388994773](https://github.com/quangminhit1102/bibistudio-2026/actions/runs/41388994773), release `4c6e07014824cb8d1020875439cba3d153077d8e-41388721286`. CI Linux98 admin +55 tooling/API đạt, build/artifact chính thức đạt. Workflow và kiểm chứng độc lập đạt: FE/BE/www khớp, API JSON404, ảnh Đà Lạt khớp SHA256/source và browser decode, admin/pages/popup/mobile hoạt động, old-client asset khớp bytes/hash, `/node-test`200. Receipt giữ bản trước `4c791499859ea42bbb7214c7bd3e222b2a6a4a57-41274633689`; không diễn tập rollback mới. Admin vẫn là demo IndexedDB, Express chưa nhận nghiệp vụ quản trị. [Biên bản chi tiết](superpowers/reports/2026-11-02-admin-production-release.md).
  | Lỗi                  | Kiểm tra đầu tiên                                                                                               |
  | -------------------- | --------------------------------------------------------------------------------------------------------------- |
  | Local không chạy     | Node24, npm ci, cổng5173/3001/9230                                                                              |
  | API trả HTML         | Passenger mount/routing, content-type, `/api-test`                                                              |
  | Ảnh lỗi              | URL catalogue, file/signature và browser decode                                                                 |
  | Artifact bị từ chối  | CI main push/repository/SHA, artifact name/ID/expiry, sidecar SHA256                                            |
  | SSH lỗi              | Environment secret, key scope, host pin, preflight; không mở shell rộng hơn                                     |
  | FE/BE lệch           | `/api/version`, `/version.json`, HTML script và mtime thực tế, log rollback                                     |
  | Deploy lỗi           | Đọc lỗi đầu tiên và kết quả recovery; `ROLLBACK FAILED` cần xử lý ngay                                          |
  | CI đạt, không deploy | Run bị skipped: `AUTO_DEPLOY`, `[skip deploy]`; notice "Skipped": main có commit mới hơn; chờ Approve: reviewer |

Agent cần đọc tài liệu này trước khi đổi local/CI/deploy/rollback; xác định release/môi trường, kiểm tra trước/sau, báo rõ commit/build/run/live state và giới hạn chưa kiểm chứng. Lệnh package.json, workflow source, response HTTP và kết quả browser là bằng chứng vận hành.

Luồng `deploy/cpanel-prod`/`deploy:cpanel:prod:push` cũ chỉ lưu lịch sử ở [cpanel-artifact-deploy.md](cpanel-artifact-deploy.md). Không chạy song song để tránh ghi đè routing release mới; không force-push lịch sử Lovable.
