# Visitor analytics — kiểm chứng local13/11/2026

## Trạng thái

**Cập nhật sau bàn giao local:** chủ website yêu cầu phát hành; CI, hosting và rollback/forward đã qua, production chạy ee12307-43382604855. Xem [biên bản production](2026-11-13-visitor-analytics-production-release.md). Những gate và trạng thái bên dưới là tại mốc nghiệm thu local; riêng IP thật vẫn pending.

Tasks1–7 đã triển khai và kiểm chứng local. Task8 còn các gate hosting/production, **chưa hoàn tất toàn bộ yêu cầu IP thật**. Chủ website trả lời “Chưa gửi yêu cầu Tino” ngày13/11. Chưa gửi ticket, thay trust config, bootstrap receiver hosting, push/merge hoặc deploy production trong đợt này.

Source vẫn trên worktree `codex/admin-dashboard`; không viết lại lịch sử Git. Các commit triển khai đầu: `a937d04`, `8667e9d`, `56f4b50`, `8c8fbe0`, `32c0dfc`, `80914fd`, `d5de3fa`.

## Bằng chứng đã chạy

| Phần                              | Kết quả thực tế                                                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript FE/BE, lint, catalogue | Đạt.10 lint warning có sẵn; không có lint error                                                                                                                                                        |
| Vitest admin                      | 281/281,106 file                                                                                                                                                                                       |
| Node/backend/tooling              | 272 đạt,6 skip dành cho POSIX trên Windows,0 fail                                                                                                                                                      |
| Watcher develop                   | Báo lỗi app, phục hồi và giải phóng port: đạt                                                                                                                                                          |
| Browser auth/RBAC                 | User chỉ dùng visitors, Admin quản lý account, refresh đồng thời, mobile: đạt                                                                                                                          |
| Browser analytics mới             | DB thật với DML runtime,2 khách/46 phiên trong phạm vi, Top sản phẩm2 khách, tải45 phiên20→40→45; lịch sử năm2020 hiển thị qua custom ngày; mobile không tràn ngang: đạt                               |
| Browser usability                 | Edit phiếu, TinyMCE/dirty guard, tooltip và badge: đạt                                                                                                                                                 |
| Browser profile                   | Metadata, ảnh riêng, quyền, race và responsive: đạt                                                                                                                                                    |
| Rollback thật tại local           | Chạy backend production cũ pin `3beb58fc9f2f2fc7125e91bdb6df85c179dbbccf` sau DDL mới; auth/profile/readiness200; toàn bộ visitor/session/page/product cũ hơn90 ngày còn nguyên; code mới đọc lại: đạt |
| Native backup/restore             | Dump/restore vào DB verifier riêng; đối chiếu ledger mới, IP phiên, log lưu cũ và avatar trong một paired backup: đạt                                                                                  |
| 10.000 phiên                      | EXPLAIN phạm vi ngày hẹp dùng `visitor_history_window`, access type `range`; không tải toàn bộ lịch sử về FE                                                                                           |
| Build local                       | Exit0, bundle được validate, manifest5/auth schema4, có archive và SHA256. Đây là build local trên source đang triển khai, không phải artifact main CI hoặc bằng chứng deploy                          |

Full check lần đầu gặp fixture preview không sao chép thư mục SQL feature mới nên readiness503. Đã sửa fixture, chạy riêng đạt readiness200 rồi chạy lại full check đạt. Browser analytics lần đầu timeout load khi Vite chưa warmup; thêm warmup như các E2E hiện có và chờ DOM thay vì toàn bộ tài nguyên; đã chạy lại đạt rồi chạy trong full check đạt.

Log riêng tại `.superpowers/sdd/2026-11-13-visitor-analytics/`: `full-check.log` là lần đầu thất bại, `full-check-final.log` là lần đạt trước review; `post-review-check.log` là lần đạt cuối sau sửa review; `visitor-e2e.log`, `build.log`, các log theo task giữ output thực tế. Không suy luận các warning intentional trong watcher test là lỗi full suite.

## UI đã quan sát trực tiếp

Đăng nhập qua giao diện thật tại FE5173/BE3001, sau đó kiểm chứng lại bundle đã build tại http://127.0.0.1:4173/admin/analytics/visitors với MariaDB develop riêng33385. Seed local riêng3 khách/51 phiên và các IP tài liệu `192.0.2.*`, `2001:db8::*`; **không phải IP khách thật và không chứng minh hosting**. Không chỉnh dữ liệu nghiệp vụ production.

- Desktop1440×1000: bộ lọc, KPI, chart đường, bảng STT/Chi tiết, chart sản phẩm phía dưới; Xem tất cả trả bảng sản phẩm từ API.
- Mobile390×844: hai ô type=date, không có giờ; phát hiện tooltip cũ gây tràn sau resize, đã clip vùng chart. Đo document client375/scroll375, popup client342/scroll342.
- Popup: phiên mới nhất mở, ngày giờ/sản phẩm/URL đầy đủ đã ghi nhận; tải thêm20→40→45, giữ một phiên mở, không còn nút tải thêm khi hết; không có Phiên trước/Phiên sau.
- UI test thêm: filter đổi hủy request cũ; dữ liệu cũ trả muộn không xuất hiện; lỗi tải tiếp giữ các phiên đã tải, retry dùng đúng cursor, không lặp ID.

Ảnh local: `.superpowers/visitor-analytics-review/implemented-desktop.png`, `implemented-mobile-dates.png`, `implemented-mobile-detail.png`. Browser regression tự lưu ảnh riêng tại `.superpowers/e2e/visitor-analytics/`. Prototype trước đây chỉ là bản phác thảo; ứng dụng thật đã có implementation riêng được kiểm chứng như trên.

## Quyết định triển khai và giới hạn

1. Các field DTO mới được bổ sung theo hướng tương thích trong lúc chia commit; API mới trả dữ liệu report/session đầy đủ và có integration tests. Client có bộ lọc kiểm tra runtime các field, count và khoảng ngày; response backend cũ bị từ chối bằng thông báo tải lại, không hiển thị KPI sai phạm vi.
2. `asOf` là thời điểm quan sát server, không quảng cáo snapshot transaction chung cho nhiều HTTP request. Trong một report, KPI/chuỗi thời gian/sản phẩm dùng chung một transaction READ ONLY REPEATABLE READ; test MariaDB có ghi đồng thời đã xác minh tính nhất quán. Mọi request UI dùng chính xác from/to cố định. Khi dữ liệu mới đến giữa các request, số liệu có thể thay đổi.
3. Backup native hiện đã tự phát hiện/đối chiếu tất cả bảng nên không tạo thêm định dạng backup. Test mới xác minh cụ thể ledger/IP phiên, log cũ và avatar cùng restore.
4. Test HTTP log cũ được chuyển sang backend production được pin để giữ bằng chứng rollback. Bỏ test/UI/E2E của tính năng log đang hoạt động; thay bằng analytics acceptance mới. Dữ liệu và schema log không bị xóa.
5. Gỡ cron theo marker riêng của app, giữ nguyên byte các job khác; nếu gặp `analytics:cleanup` chưa nhận diện thì chặn phát hành để xem lệnh hosting thực tế. Đổi lại cần thao tác kiểm tra host trước khi qua gate.
6. Khi đã kích hoạt history, thao tác rollbackv5→v4 vẫn dùng toolv5 để kiểm tra và giữ cron tắt. Thao tác old→old không còn tool visitor-aware bị chặn. Cần giữ một release/toolv5 tương thích để phát hành tiếp; không chấp nhận mất bảo vệ retention để bỏ qua lỗi.

## Review cuối và artifact đã kiểm chứng

Review độc lập phát hiện 0 Critical, 3 Important, 0 Minor. Đã sửa cả ba sau khi quan sát regression test thất bại: CLI status chấp nhận schema empty trước migration đầu tiên; report đọc nhất quán khi collector ghi đồng thời; frontend từ chối report backend cũ không khớp khoảng ngày. Sau sửa, full check exit0: 281 Vitest, 272 Node đạt/6 POSIX skip, watcher và cả 4 browser suite đạt. Browser compatibility gọi backend production v4 được pin thực tế, không chỉ mock DTO. Không có minor hoãn lại.

Build cuối dùng đúng source commit `8de6b35438fe92bd3cb1432ff18aa19b5c7de686`; frontend/backend đang chạy preview cùng sourceSha/releaseId, `/api/ready` trả `ok:true`. Desktop/mobile đã quan sát lại trên bundle này. Commit tài liệu bàn giao có thể đi sau source build; đây vẫn là artifact local, chưa phải main CI hoặc production.

- Archive: `.releases/local-8de6b35438fe92bd3cb1432ff18aa19b5c7de686.tgz`, 194777417 byte.
- SHA256 thực tế: `119ff98f829d952cf49e7459ee94775697258971d41d6bd2fdda9193e00a9fde`, khớp sidecar.
- Log: `post-review-check.log`, `build-reviewed.log`, `preview-reviewed.log` trong workspace kiểm chứng.
- Giới hạn: không khôi phục lịch sử/IP trước đây chưa ghi hoặc đã xóa; chưa bổ sung GeoIP. Lưu toàn bộ lịch sử đã thu thập cần kiểm tra dung lượng hosting; không cam kết lưu trữ vô hạn.

## Gate chưa đạt

- Tino xác nhận/cấu hình nguồn IP, topology/CIDR và cơ chế chống header giả. Chưa có phản hồi hoặc phép đo mới.
- Đối chiếu IP từ hai mạng ngoài hosting, giả mạo XFF/X-Real-IP/Forwarded/multi-hop/underscore, IPv4/IPv6 và hostname chính/www.
- Đo dung lượng DB/quota/headroom và backup128MiB tại hosting, native paired restore trên verifier thật.
- Kiểm tra crontab thực tế, gỡ đúng job cũ và lưu receipt ổn định ngoài `current`; bootstrap receiver/ops manifest5.
- Main CI artifact và production manual gate/live rollback. Các bước chỉ được ghi đạt khi có kết quả thật; local không thay thế hosting acceptance.

Chưa cấu hình `CLIENT_IP_SOURCE_VERIFIED=true`. `TRUSTED_PROXY_CIDRS` chỉ được đặt theo topology đã đo. Các tên env/luồng vận hành tại [visitor-analytics-operations](../../visitor-analytics-operations.md); bản chủ website gửi hỗ trợ tại [yêu cầu Tino](../../visitor-ip-hosting-request.md).

## Danh sách file thay đổi

So với base đã duyệt `a2e265d`; bao gồm source, tests, migration, ops và tài liệu. Không gồm file secret hoặc output local bị gitignore.

```text
M	.env.example
M	.gitattributes
M	backend/src/app.ts
M	backend/src/config.ts
A	backend/src/http/client-address.ts
M	backend/src/http/contracts.ts
M	backend/src/release.ts
M	backend/src/runtime.ts
M	backend/src/visitors/cleanup.ts
A	backend/src/visitors/cli.ts
M	backend/src/visitors/collector.ts
A	backend/src/visitors/date-window.ts
M	backend/src/visitors/normalize.ts
M	backend/src/visitors/private-routes.ts
A	backend/src/visitors/report-query.ts
M	backend/src/visitors/routes.ts
A	backend/src/visitors/schema.ts
M	backend/src/visitors/service.ts
A	backend/src/visitors/session-history.ts
M	backend/test/access-log-cli.test.mjs
M	backend/test/access-log-current-http.test.mjs
M	backend/test/access-log-http.test.mjs
M	backend/test/helpers/auth.mjs
A	backend/test/helpers/legacy-visitor-backend.mjs
M	backend/test/helpers/profiles.mjs
M	backend/test/helpers/visitors.mjs
A	backend/test/visitor-backup.test.mjs
A	backend/test/visitor-cli.test.mjs
A	backend/test/visitor-client-address.test.mjs
A	backend/test/visitor-date-window.test.mjs
A	backend/test/visitor-history-retention.test.mjs
A	backend/test/visitor-history-schema.test.mjs
M	backend/test/visitor-read.test.mjs
A	backend/test/visitor-release-readiness.test.mjs
A	backend/test/visitor-report-window.test.mjs
M	backend/test/visitor-retention.test.mjs
A	backend/test/visitor-session-history.test.mjs
A	backend/visitor-migrations/001_history.sql
M	docs/admin-auth-operations.md
M	docs/build-and-deploy.md
A	docs/superpowers/reports/2026-11-13-visitor-analytics-acceptance.md
A	docs/visitor-analytics-operations.md
A	docs/visitor-ip-hosting-request.md
M	ops/access-log-cron.cjs
M	ops/database-lifecycle.cjs
M	ops/deploy.cjs
M	ops/receiver.cjs
M	ops/release.cjs
A	ops/visitor-cron-policy.cjs
A	ops/visitor-lifecycle.cjs
A	ops/visitor-metadata.cjs
M	scripts/auth-preview.test.mjs
M	scripts/auth-ui-check.mjs
M	scripts/build.mjs
M	scripts/local-database.mjs
A	scripts/visitor-cron-policy.test.mjs
A	scripts/visitor-release.test.mjs
A	scripts/visitor-rollback.test.mjs
M	src/features/admin/admin.css
A	src/features/admin/analytics/components/visitor-filters.tsx
A	src/features/admin/analytics/components/visitor-session-list.tsx
M	src/features/admin/analytics/http-api.ts
M	src/features/admin/analytics/pages/visitors.tsx
D	src/features/admin/analytics/server-access-logs.tsx
M	src/features/admin/analytics/server-visitors.tsx
A	src/features/admin/analytics/visitor-charts.tsx
A	src/features/admin/analytics/visitor-date-filter.ts
M	src/features/admin/shared/charts/chart.tsx
D	tests/admin/access-log-page.test.tsx
A	tests/admin/visitor-date-filter.test.ts
M	tests/admin/visitor-http.test.tsx
A	tests/admin/visitor-overview.test.tsx
A	tests/admin/visitor-report-contract.test.ts
A	tests/admin/visitor-session-list.test.tsx
D	tests/e2e/access-logs.spec.mjs
M	tests/e2e/auth.spec.mjs
A	tests/e2e/visitor-analytics.spec.mjs
```
