# BiBi — nghiệm thu editor local, 03/11/2026

## Kết quả và phạm vi

Đã tích hợp TinyMCE **8.10.1 tự host GPL**, React wrapper **6.3.1**, bản dịch tiếng Việt build-only **26.11.2**. Người dùng xác nhận dùng GPL ngày 03/11. Không dùng API key/Tiny Cloud; key cũ đã bỏ khỏi `.env.local`, không được ghi vào Git. Giữ attribution/license/notices, không thay license hoặc độ công khai repository BiBi.

Code đã commit trên `codex/admin-dashboard`, giữ worktree hiện tại. **Không push, merge hoặc deploy production.** Lưu admin vẫn dùng IndexedDB, không xuất bản blog/catalogue public, không thêm API CMS/MySQL/auth production.

Code được build/kiểm chứng: `cab14b00eb896e58bead5d209c1aaf9a76e577e2`.

- Artifact: `.releases/local-cab14b00eb896e58bead5d209c1aaf9a76e577e2.tgz`.
- SHA256: `1fcde486c31e543886fadfb33682b7e53c4143f6f496cba9944a6bd508256623`.
- Preview artifact FE/BE: `http://127.0.0.1:4196` (cần process preview đang chạy).
- Màn đang mở để review: `/admin/content/posts/journal-5-thoi-quen-viet-tay-de-song-cham-hon/edit`.
- Login fixture nếu cần: `bibi.admin / BibiLocal!2026`.

## Kiểm tra bằng lệnh

Máy hiện có Node25; dùng Node **24.22.2** trong tooling local bị Git bỏ qua (`.superpowers/node24/node_modules/node/bin/node.exe`) để chạy các lệnh bên dưới. Khi Node24 đã được chọn đúng trên máy khác, dùng các lệnh npm thông thường trong `docs/build-and-deploy.md`.

| Kiểm tra                                     | Kết quả đã quan sát                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Baseline `npm run test:admin` trước thay đổi | 62 files, 154/154 đạt                                                                  |
| `node scripts/check.mjs` trên code cuối      | Exit 0; TypeScript FE/BE đạt; lint 0 lỗi/10 cảnh báo có sẵn; ảnh catalogue offline đạt |
| Bộ Vitest admin trong check cuối             | 72 files, **181/181 đạt**                                                              |
| Tooling/backend/API trong check cuối         | **55 đạt, 0 lỗi, 1 bỏ qua**; test POSIX permissions chỉ kiểm tra trên Linux CI         |
| `node scripts/build.mjs` trên code cuối      | Exit 0; bundle FE/BE, manifest và checksum được tạo                                    |
| `/api-test` của artifact trong browser       | Kết nối thành công, FE và BE cùng release/source SHA `cab14b0…`                        |

Check trong sandbox ban đầu không qua các test cần HTTP loopback/Git Bash. Đã chạy lại toàn bộ check ngoài sandbox và đạt; không bỏ test để lấy kết quả xanh. Build còn cảnh báo chunk public lớn hơn 500 kB và thông báo cấu hình Vite hiện có; không coi các cảnh báo này là lỗi build.

## Kiểm chứng giao diện thật

Không dùng mockup hoặc mocked vendor unit test làm bằng chứng editor chạy được. Đã thực hiện bằng trình duyệt:

- Tạo bài viết, nhập chữ, bôi đậm, chèn link, chọn ảnh bìa, chèn ảnh và caption, xem trước Desktop/Mobile rồi lưu nháp.
- Nhập file `study-desk.jpg` từ máy vào kho Blob local, chèn alt/caption, lưu và tải mới trang. Editor và preview đều giữ chữ, ảnh Blob và caption; ảnh đã tải thành công.
- Phát hiện lớp validation cũ làm rỗng envelope HTML khi lưu. Đã sửa tại service, thêm test real-service RED→GREEN và lặp lại lưu/tải mới trên UI thành công.
- Sửa mô tả Đà Lạt, xem trước nội dung chưa lưu, lưu/tải mới còn nội dung. Giá 105000, stock43, reserved0 được giữ; preview không có giá/giỏ hàng.
- Gallery: thêm ảnh kiểm thử tạm, đưa ảnh2 lên thành ảnh chính, bỏ ảnh kiểm thử và giữ lại đúng ảnh Đà Lạt trước khi lưu. Không lưu ảnh Hà Giang như ảnh bổ sung của Đà Lạt.
- Nhập tuần tự `Việt Nam, Bản đồ, Đà Lạt`; lưu/tải mới còn ba thẻ. Gạch chân trong TinyMCE được giữ trên preview và sau tải mới.
- Chuyển sáng/tối không mất nội dung. Toolbar, link dialog, image picker, caption và modal preview hoạt động; Escape đóng preview/trả focus.
- Đo form bài viết ở 1440/768/390px và form sản phẩm ở desktop/390px: không tràn ngang; mobile xếp một cột, toolbar thu vào menu bổ sung. Preview Mobile có khung390px.
- Cố ý tạm làm thiếu **core JS**, rồi **plugin lists** trong thư mục asset sinh local: cả hai trường hợp báo lỗi/khóa lưu; khôi phục file rồi bấm **Thử lại** tải được editor đầy đủ. Không reload để thay thế thao tác retry. Mọi file đã được khôi phục trước build cuối.
- Artifact cuối: tạo sản phẩm nháp qua UI thành công; mở bài seed có hai ảnh inline/caption từ asset hash trong bundle, ảnh tải được và editor tiếng Việt hoạt động.
- Tải mới homepage và danh sách sản phẩm: DOM không có script TinyMCE. Trang edit tải `/vendor/tinymce-8.10.1/tinymce.min.js` và CSS cùng origin, không dùng CDN Tiny Cloud.

Ảnh kiểm chứng được lưu trong thư mục visualization của phiên:

- `C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/bibi-tinymce-final-desktop.jpg`
- `C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/bibi-tinymce-final-mobile.jpg`
- `C:/Users/Admin/.codex/visualizations/2026/10/20/01a15a26-a0cd-7650-bf39-5920671482d5/bibi-tinymce-final-preview.jpg`

## Review độc lập và sửa lỗi

Reviewer độc lập đọc range `66dc89a..bc997ac`, không review lại các đợt sidebar/business cũ. Không có Critical; năm Important được sửa trong một lượt, commit `cab14b0`. Không có mục Declined to judge.

| Phát hiện                                                | Bằng chứng sửa                                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Mất draft khi query nền lỗi hoặc đổi quyền               | Test draft-retention chạy RED trên code cũ, GREEN trên bản sửa. Form đã mở được giữ/read-only, save bị chặn, guard còn hoạt động.            |
| Retry lặp lỗi core đã cache trong React wrapper          | Test dùng wrapper thật, RED→GREEN, xác minh request URL mới; browser lỗi-core→khôi phục→retry đạt.                                           |
| Plugin/language/skin có thể lỗi nhưng init vẫn cho ready | Test bốn loại lỗi/init RED→GREEN; chặn ready sau lỗi. Reset cache addon chưa tải và script tương ứng; browser lỗi-lists→khôi phục→retry đạt. |
| Gạch chân bị sanitizer xóa                               | Chuẩn hóa markup gạch chân thành `<u>`; regression RED→GREEN, UI save/reload giữ định dạng.                                                  |
| Dấu phẩy biến mất khi nhập thẻ                           | Giữ raw input khi focus, chuẩn hóa khi blur; regression RED→GREEN, UI nhập ba thẻ/save/reload đạt.                                           |

## Dung lượng và giới hạn

- Vendor sinh tự động: **18 file, 1.708.985 byte**, chỉ core/theme/model/icons, 3 plugin, CSS min sáng/tối, vi và license/notices. Không chép toàn bộ package hoặc mọi skin. Profile đầu 5.385.338 byte đã rút xuống mức trên.
- Chunk rich-editor trong artifact mới: **20.973 byte**, gzip theo build **7,63 kB**. Chunk cũ trong artifact `72b239b…`: 413.638 byte. Đây là so sánh chunk wrapper/app, **không phải** kết luận tổng tải editor giảm tương ứng vì runtime tự host nằm riêng trong vendor.
- Đã gỡ 47 package Tiptap không còn dùng. Package lock khóa dependencies mới; vendor không nằm trong Git, được chuẩn bị qua install/dev/prebuild, không cần thêm lệnh thường ngày.
- Minor còn lại: TinyMCE hiện có tay kéo đổi kích thước ảnh, nhưng kích thước tùy chỉnh **chưa lưu**; preview dùng kích thước ảnh responsive. Có thể tắt resize hoặc bổ sung lưu kích thước giới hạn trong một đợt riêng.
- Kho dữ liệu theo origin. Dữ liệu kiểm thử ở4195 và4196 là hai kho riêng; không reset kho cũ.

## Những quyết định thực hiện

1. Khi người dùng đổi sang miễn phí self-host, phần nội dung/ảnh được làm trước vì độc lập cách tải editor; việc cài GPL chờ xác nhận đã nhận ngày03/11. Đổi hướng có thể làm chậm phần runtime, không thay license BiBi.
2. Script bookkeeping Git Bash bị đứng trong sandbox; dùng ledger/brief tương đương bằng PowerShell. Đánh đổi: phải ghi lệnh/kết quả thủ công chính xác; commits/tests và báo cáo này giữ bằng chứng dài hạn.
3. Thay toàn bộ yêu cầu Cloud/API key bằng asset có version/cùng origin và GPL theo chỉ dẫn người dùng. Đánh đổi: cần tuân thủ giấy phép khi có yêu cầu phát hành; không tự thay đổi repository visibility hoặc triển khai production.
4. Hai form chia sẻ ComposeForm và lifecycle/fields, có wrapper riêng theo module; không đại tu RecordForm của các module khác. Đánh đổi: range review chung lớn hơn, được kiểm tra bằng form/session tests và review cuối.
5. Host Node25 được thay bằng Node24.22.2 cục bộ cho check/build. Đánh đổi: các lệnh bằng đường dẫn tooling chỉ áp dụng phiên này; tài liệu thường ngày vẫn yêu cầu Node24 được chọn trên PATH.

Các quyết định trên được ghi trong ledger theo thứ tự thực hiện; mục GPL chờ đã được giải quyết. Branch/worktree giữ nguyên cho người dùng review local, không thực hiện bước tích hợp ngoài phạm vi đã duyệt.
