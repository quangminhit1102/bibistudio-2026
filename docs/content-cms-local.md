# CMS local và kiểm thử release

Yêu cầu Node 24 và Docker Desktop Linux engine đang chạy. Dùng database local riêng; các bài kiểm thử chỉ tạo/xóa schema ngẫu nhiên có tiền tố bibi_test_.

Sau khi cập nhật source lần đầu:

```sh
npm run db:setup:local
npm run dev
```

Setup chuẩn bị schema, ảnh native, các candidate Blog gốc và generation local trống. Chạy lại setup không ghi đè bản nháp đã sửa, khóa local hoặc dữ liệu hiện có. Lệnh dev hằng ngày giữ dữ liệu, chạy FE/API/PHP cùng nhau; Ctrl+C dừng các process thuộc phiên đó.

Trong admin, lưu nháp và đăng bài là hai thao tác riêng. Bài nháp/ảnh chưa công khai không có URL public. Danh mục tối đa 3 cấp; thay đổi danh mục cần áp dụng lên website. Danh mục trong URL luôn phẳng, không ghép 3 cấp vào đường dẫn.

```sh
npm run check
npm run build
node scripts/content-bundle-check.mjs <thu-muc-release-vua-build>
```

Check chạy source browser và các kiểm thử DB/PHP/media/backup. Gate sau build dùng đúng CJS/PHP/assets trong artifact, kiểm tra cả chế độ thực và một artifact local riêng của chế độ còn lại, rồi thử CMS→bridge→CMS. Bằng chứng đã lọc thông tin riêng tư nằm trong .superpowers/e2e/content-source và .superpowers/e2e/content-compiled.

Chế độ trusted release lấy từ scripts/content-release-mode.mjs, hiện mặc định bridge. Bridge đọc nội dung đã đăng và khóa ghi CMS. Artifact thay chế độ chỉ dùng local có releaseId local-*, không thể upload/promote. Muốn phát hành CMS phải có commit bình thường đổi mode, CI mới và artifact mới.

Lần chuyển production đầu tiên là tác vụ deploy có backup/restore verifier, generation gốc, routing đã kiểm checksum và PHP canary. Không chạy các lệnh initial thủ công với database ứng dụng local/production tùy ý. Những lệnh đó không phải cơ chế đưa mọi bản nháp lên website.
