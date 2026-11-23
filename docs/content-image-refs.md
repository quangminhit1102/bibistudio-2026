# Sửa đường dẫn ảnh của dữ liệu đã nạp từ seed

Trạng thái: công cụ đã kiểm trên máy local và trên một MariaDB 10.11 thử nghiệm. **Chưa
chạy trên production.** Việc chạy SQL trên production cần chủ site đồng ý đúng thay đổi
trong `report.md`.

## Vấn đề

Lần nạp dữ liệu đầu tiên lưu mã ảnh giả: `catalogue-image-<slug>-N` cho sản phẩm và
`journal-cover-<slug>` cho ảnh bìa bài viết. API công khai trả các mã này thành
`/api/media/<mã>`, và URL đó trả HTTP 400. Trang vẫn hiện ảnh vì giao diện thay ảnh của API
bằng ảnh đóng gói sẵn. Muốn bỏ dữ liệu đóng gói thì DB phải trỏ tới file thật:
`/catalogue/<file>.webp` và `/journal/<file>.jpg`.

Nạp lại seed không sửa được: seed chỉ ghi vào DB trống.

## Công cụ

`scripts/content-image-refs.mjs` chỉ đọc API công khai, không kết nối DB.

```bash
# Lập kế hoạch: ghi report.md, 1-preview.sql, 2-apply.sql, 3-rollback.sql
node scripts/content-image-refs.mjs plan --api https://bibistudio.vn --out content-image-refs

# Kiểm tra: mọi mục của seed có trong API và mọi ảnh API trả về đều tải được
node scripts/content-image-refs.mjs verify --api https://bibistudio.vn
```

`plan` chỉ đưa vào SQL những dòng:

- còn giữ đúng giá trị seed đã ghi: mã giả, hoặc với ảnh bìa là đường dẫn
  `/assets/blog/<file>` của bản seed trước (dòng đã sửa trong admin được ghi ở mục "Left
  alone");
- có file đích đang được site phục vụ (dòng chưa có file ghi ở mục "Waiting", và lệnh thoát
  với mã lỗi).

Mục "Problems" liệt kê mục có trong seed nhưng API không có, số ảnh khác nhau, hoặc đường
dẫn ảnh bìa dài hơn 64 ký tự.

Ảnh bìa bài viết được ghi vào cột `image_id` (cột mà ô chọn ảnh bìa trong admin sửa) và cột
`cover_image_id` được để trống, vì API ưu tiên `cover_image_id`: nếu ghi vào đó, ảnh bìa
chọn lại trong admin sau này sẽ không hiện ra.

`verify` chỉ gọi địa chỉ của chính site và không đi theo chuyển hướng; ảnh ở site khác được
liệt kê là chưa kiểm. Sản phẩm hoặc bài viết của seed mà API không còn ảnh nào bị báo lỗi;
bài viết thêm từ admin không có ảnh bìa thì không.

## Thứ tự thực hiện

1. Deploy bản có `public/journal` (PR giai đoạn 3b). Trước bước này 10 ảnh bìa nằm ở
   "Waiting".
2. Chạy `plan`. Kết quả mong đợi trên BiBi Studio: 68 sản phẩm, 10 bài viết, "Waiting" 0,
   "Problems" 0. Sáu sản phẩm không có ảnh trong seed nên không có trong kế hoạch.
3. Chủ site đọc `report.md` và đồng ý.
4. Sao lưu DB (cPanel > Backup, hoặc phpMyAdmin > Export hai bảng `products`, `posts`).
5. Trong phpMyAdmin, chọn DB của site, chạy `1-preview.sql`. Lệnh chỉ đọc; so số dòng và
   giá trị với `report.md`. Cột `editor_cover` khác rỗng nghĩa là bài viết đó đã có ảnh bìa
   chọn trong admin mà API chưa hiện; `2-apply.sql` sẽ không đổi bài đó.
6. Chạy `2-apply.sql`. File chạy trong một transaction, lưu giá trị cũ vào bảng
   `content_image_refs_backup` rồi mới sửa. Mỗi lệnh sửa chỉ khớp dòng còn giữ mã giả, nên
   chạy lại lần hai không đổi gì.
7. Chạy `verify`. Phải in `READY`. Mở vài trang sản phẩm và bài viết, và form sửa sản phẩm
   trong admin.

## Hoàn tác

Chạy `3-rollback.sql` trong phpMyAdmin. File trả từng dòng về giá trị trong
`content_image_refs_backup` (với bài viết là cả `image_id` và `cover_image_id`), và chỉ với
dòng còn giữ đúng giá trị mà `2-apply.sql` đã ghi.
Dòng đã được sửa trong admin sau đó được giữ nguyên. Chạy lại lần hai không đổi gì.

Bảng `content_image_refs_backup` được giữ lại sau khi hoàn tác. Xóa bảng khi không còn cần:
`DROP TABLE content_image_refs_backup;`.

Trong lúc chưa bỏ dữ liệu đóng gói (giai đoạn 3b-2), cả trước và sau khi chạy SQL trang
công khai hiện cùng một ảnh, nên hoàn tác không làm mất ảnh trên site.

## Đã kiểm

- Test tự động: `node --test scripts/content-image-refs.test.mjs`.
- MariaDB 10.11 thử nghiệm với 74 sản phẩm và 10 bài viết như production cùng một sản phẩm
  thêm từ admin: preview không đổi gì; apply đổi 68 sản phẩm và 10 bài viết; apply lần hai
  không đổi gì; sản phẩm của admin và 6 sản phẩm không ảnh giữ nguyên; rollback trả đúng
  trạng thái đầu, trừ một sản phẩm và một bài viết cố ý sửa sau apply; rollback lần hai
  không đổi gì.

## Chưa kiểm

- SQL trên DB production và qua phpMyAdmin của hosting.
- `verify` trên production: chỉ đạt sau bước 6.
