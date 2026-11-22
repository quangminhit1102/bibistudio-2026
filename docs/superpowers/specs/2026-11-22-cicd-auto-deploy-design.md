# Thiết kế: CI song song và tự deploy production khi CI main đạt

- Ngày: 2026-11-22
- Trạng thái: chờ duyệt spec
- Phạm vi: `.github/workflows/*`, `scripts/check.mjs`, `scripts/github-release.mjs`, test khóa workflow, tài liệu deploy. Không đổi receiver/`ops`, không đổi code ứng dụng.

## 1. Mục đích

Chủ repo muốn quy trình CI/CD nhanh nhất và tự động: push `main`, CI đạt là website production được cập nhật, không phải mở workflow, dán mã release và bấm duyệt. Con người vẫn phải deploy tay và rollback được dễ dàng.

## 2. Hiện trạng đã đo (run CI 45034433207, deploy 45035974817)

- CI là một job `verify` chạy nối tiếp, khoảng 7,5 phút. `npm run check` chiếm 372 giây: typecheck/lint/ảnh 21 giây, vitest admin 69 giây, `node --test` scripts+backend 113 giây, hai test dev watcher 7 giây, năm bộ test trình duyệt 162 giây (auth 52, visitor-analytics 24, admin-usability 33, profile 32, visitor-relay 20). Build 19 giây, bundle check 6 giây.
- Deploy khoảng 4 phút: `npm ci --ignore-scripts` 49 giây (không cache), cài Chromium 17 giây, `deploy-client.mjs` 130 giây.
- Deploy chỉ chạy bằng `workflow_dispatch`, phải nhập `release_id` dạng `<sha>-<run id>`. Environment `production` có required reviewer `quangminhit1102`.
- `ci.yml` đặt concurrency theo ref với `cancel-in-progress: true`, nên trên `main` mỗi lúc chỉ có một CI; push mới hủy CI cũ.
- Repo public, phút chạy Actions không tính phí.

## 3. Mục tiêu, ngoài phạm vi, điều không được xảy ra

Mục tiêu:

1. Push `main` → CI đạt → production tự deploy đúng artifact của CI đó, không thao tác tay.
2. CI chạy song song; thời gian chờ CI còn khoảng 4 phút (hiện 7,5 phút). Đây là ước tính, phải đo lại sau khi làm.
3. Deploy tay vẫn còn và dễ hơn: để trống `release_id` thì lấy bản CI main đạt mới nhất; nhập mã thì deploy đúng bản đó. Rollback giữ nguyên.
4. Có cách tạm dừng tự deploy mà không sửa code.
5. `npm run check` ở local chạy đủ như hiện nay.

Ngoài phạm vi:

- Bật lại staging.
- Sửa nguyên nhân test trình duyệt chập chờn (thuộc đợt rà soát source).
- Thông báo Slack/email riêng khi deploy lỗi.
- Thay đổi receiver, lifecycle deploy, smoke test.

Không được xảy ra:

- Deploy khi bất kỳ job CI nào chưa đạt.
- CI giữ secret deploy, hoặc dùng `pull_request_target`.
- Build lại trên đường phát hành.
- Tự chạy lại test lỗi để che lỗi.
- Rewrite lịch sử Git đã push.

## 4. Các cách đã cân nhắc

1. **Thêm trigger `workflow_run` vào `production.yml` (đã chọn).** CI vẫn không có secret; kiểm tra nguồn gốc artifact (`assertTrustedRun`) giữ nguyên vì CI run đã kết thúc thành công khi deploy bắt đầu. Mẫu này đã từng dùng ở `workflows-disabled/staging.yml`.
2. **Gộp deploy thành một job trong `ci.yml`.** Nhanh hơn khoảng 20 giây và xem ở một chỗ. Loại vì CI phải giữ `DEPLOY_SSH_KEY`, và `assertTrustedRun` yêu cầu CI run có `conclusion=success`, điều không thể đúng khi run còn đang chạy.
3. **Như cách 1 nhưng bản có migration DB mới thì chờ duyệt.** An toàn hơn vì rollback không hoàn tác migration. Chủ repo không chọn: muốn tự động hoàn toàn.

Chủ repo chọn cách 1, tự deploy hoàn toàn, không cổng duyệt.

## 5. Thiết kế

### 5.1 `production.yml`

- `on`: `workflow_dispatch` (input `release_id`, không bắt buộc) và `workflow_run` (`workflows: [CI]`, `types: [completed]`, `branches: [main]`).
- Điều kiện job `promote`: `github.ref == 'refs/heads/main'`, và một trong hai:
  - chạy tay; hoặc
  - `workflow_run` với `conclusion == 'success'`, `event == 'push'`, `head_repository.full_name == github.repository`, biến repo `AUTO_DEPLOY` khác `'false'`, và commit message không chứa `[skip deploy]`.
- `RELEASE_ID`: đường tự động là `<workflow_run.head_sha>-<workflow_run.id>`; đường tay là input.
- `scripts/github-release.mjs`: khi `RELEASE_ID` rỗng (chỉ xảy ra ở đường tay), lấy CI run `push`/`main`/`success` mới nhất của `ci.yml` qua GitHub API rồi dựng mã release. Sau đó mọi đường đều qua `validateRelease` như hiện nay.
- Giữ nguyên: environment `production`, concurrency `deploy-production` không cancel, quyền `contents: read`, action pin SHA, không `npm run build`.
- Thêm cache npm cho `setup-node` (cả `rollback.yml`).
- Ghi mã release và kết quả vào job summary.

Hàng đợi: concurrency group không cancel nên một deploy đang chạy luôn chạy hết; GitHub chỉ giữ một run chờ mới nhất trong group. Không thêm kiểm tra "bản cũ hơn" (quyết định của người viết: CI trên `main` đã tuần tự nên thứ tự release được bảo toàn).

### 5.2 `ci.yml`

Tách `verify` thành các job song song, mỗi job tự `checkout` + `setup-node` (cache npm) + `npm ci`:

| Job | Nội dung | Cần thêm |
|---|---|---|
| `static` | typecheck FE, compile BE, ESLint, kiểm tra ảnh catalogue | không |
| `admin` | vitest admin | không |
| `backend` | `node --test` scripts + backend + `api-demo`, hai test dev watcher | MariaDB service, image PHP |
| `e2e` | năm bộ test trình duyệt, chạy theo matrix từng bộ; upload `browser-evidence` | MariaDB service, Chromium, image PHP |
| `build` | `npm run build`, `visitor-context-bundle-check`, upload artifact release khi push `main` | Chromium |

- CI run chỉ `success` khi mọi job đạt; `workflow_run` dựa vào kết luận của cả run, nên không cần job gác cổng riêng.
- Tên artifact release, nội dung, retention 30 ngày và `include-hidden-files` giữ nguyên.
- Trigger, quyền, concurrency của CI giữ nguyên; CI vẫn không tham chiếu `secrets.`.

### 5.3 `scripts/check.mjs`

- Nhận tên giai đoạn làm tham số: `static`, `admin`, `backend`, `e2e`. Không tham số thì chạy tất cả theo thứ tự hiện nay, nên `npm run check` không đổi hành vi.
- Giai đoạn `e2e` nhận thêm tên bộ test để chạy riêng một bộ cho matrix.
- Mỗi giai đoạn tự chuẩn bị thứ nó cần (dataset quốc gia, compile BE, test database).

### 5.4 Test khóa workflow (`scripts/workflow-policy.test.mjs`)

- `production.on` phải đúng hai khóa `workflow_dispatch` và `workflow_run`; `workflow_run` chỉ nghe workflow `CI`, nhánh `main`, `completed`.
- Điều kiện job phải chứa đủ: `conclusion == 'success'`, `event == 'push'`, cùng repository, `AUTO_DEPLOY`.
- Step upload release được tìm trong job `build` thay cho `verify`.
- Thêm test cho việc chọn bản CI mới nhất khi `RELEASE_ID` rỗng, và từ chối khi không có bản nào.
- Các khẳng định khác (pin SHA, `contents: read`, không `pull_request_target`, không secret trong CI, không build trong production, danh sách file workflow) giữ nguyên.

### 5.5 Tài liệu

Cập nhật `docs/build-and-deploy.md` mục chế độ hiện tại, CI, deploy, rollback: luồng mới, cách deploy tay, cách tạm dừng, cách xử lý khi tự deploy lỗi.

## 6. Việc chỉ chủ repo làm được

1. Gỡ required reviewer của environment `production` tại `Settings → Environments → production`. Nếu không gỡ, mỗi lần tự deploy vẫn dừng chờ Approve. Sau khi gỡ, deploy tay và rollback cũng không còn bước duyệt. Giới hạn nhánh `main` của environment giữ nguyên.
2. Khi cần tạm dừng: tạo biến repo `AUTO_DEPLOY=false` tại `Settings → Secrets and variables → Actions → Variables`.

## 7. Rủi ro đã chấp nhận

- Staging đang tắt, nên production là nơi đầu tiên release chạy trên hosting thật. Lưới an toàn là CI, kiểm tra của receiver, smoke test và rollback tự động về bản trước.
- Migration DB chạy tự động khi deploy; rollback không hoàn tác migration (chỉ đổi app tương thích schema, có backup trước khi migrate).
- Thay đổi `ops/` không tự cập nhật receiver trên host; vẫn phải bootstrap qua cPanel như hiện nay.
- Test trình duyệt chập chờn sẽ chặn deploy cho tới khi chạy lại CI; không gây deploy sai.

## 8. Nghiệm thu

1. PR: mọi job CI đạt; đo thời gian CI và ghi vào PR.
2. Sau khi merge: push `main` → CI đạt → `Deploy production` tự chạy, `/api/version` khớp mã release, không thao tác tay.
3. Chạy tay để trống `release_id` deploy bản mới nhất; nhập mã cũ deploy đúng bản đó.
4. `AUTO_DEPLOY=false` hoặc `[skip deploy]`: CI đạt nhưng không deploy.
5. Rollback tay vẫn hoạt động.

Mục 2–5 cần chạy thật trên production và chỉ làm sau khi chủ repo đã gỡ reviewer.

## 9. Để người thực hiện quyết định

- Cách chia nhỏ thêm job `backend` nếu nó là job dài nhất.
- Có cache trình duyệt Playwright hay không, tùy số đo.
- Tên file/hàm cụ thể cho phần chọn bản CI mới nhất.
