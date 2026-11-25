# Thiết kế: import khách hàng từ Excel, đơn giản hóa tồn kho (đợt 2)

- Ngày: 2026-11-24
- Trạng thái: chờ duyệt
- Nền: `main` tại `f0bf82f` (sau PR #16)
- Phạm vi: đợt 2 trong 5 yêu cầu ngày 24/11 của chủ repo, gồm yêu cầu 1 và 2. Có migration nội dung thứ tư và đổi `ops/`.
- Đợt 1 (yêu cầu 3, 4, 5) đã merge ở PR #15.

## 1. Yêu cầu (lời chủ repo)

1. "Import khách hàng từ Excel: thêm nhiều khách hàng theo dữ liệu mẫu trong ảnh, hỗ trợ thêm số điện thoại, email, người đại diện và dễ mở rộng trường sau này. Có file mẫu, xem trước dữ liệu, kiểm tra lỗi và xử lý trùng lặp trước khi xác nhận import."
2. "Đơn giản hóa tồn kho: bảng chỉ còn Sản phẩm, Số lượng tồn và nút Điều chỉnh thủ công; ẩn Đã giữ/Khả dụng, giữ lịch sử thay đổi và phân quyền, không xóa dữ liệu hoặc làm ảnh hưởng chức năng hiện có."

Ràng buộc chung: giữ kiến trúc hiện tại, giao diện đơn giản, dễ dùng; duyệt kế hoạch trước khi implement; kiểm thử và chạy local, tốt thì deploy production.

Dữ liệu mẫu trong ảnh: 29 dòng, cột `STT`, `Tên`, `Địa chỉ`, `VAT` (ghi `Có`/`Không`, có dòng `không`), `Thông tin` (đa số trống; một dòng là email, một dòng là "Người nhận: anh Diệm - 0966993407"). Hai tên xuất hiện hai lần: "CÔNG TY TNHH TM DV NGỌC ANH THƯ" (dòng 10 và 25, địa chỉ ghi hơi khác nhau) và "CÔNG TY TNHH MỘT THÀNH VIÊN THƯƠNG MẠI DỊCH VỤ BA SAO" (dòng 15 và 27, giống hệt). Một dòng không có địa chỉ.

## 2. Hiện trạng (đã kiểm bằng đọc code)

**Khách hàng.** Lưu trên server, bảng `customers` (`backend/content-migrations/001_content.sql`): `name`, `kind` (nhà sách, cá nhân, công ty), `address`, `phone`, `email`, `vat_rate` (phần trăm, mặc định 8), `notes`, `active`. API `/api/customers` (`backend/src/content/routes.ts`, `service.ts`) có xem, tạo, sửa, xóa từng khách, kiểm quyền `customer.view/create/update/delete`, có ghi nhật ký. Chưa có người đại diện, chưa có chỗ cho trường mới, chưa có import. Giao diện: `src/features/admin/customers/` (danh sách dùng `EntityManager`, form, trang chi tiết). Repo chưa có thư viện đọc Excel.

**Tồn kho.** Trang `/admin/products/inventory` (`src/features/admin/shared/inventory-page.tsx`) lấy danh sách sản phẩm từ server, hiện bốn cột: Sản phẩm, Tồn thực tế, Đã giữ, Khả dụng. Nút Điều chỉnh gọi `adjustStock` (`products/inventory-service.ts`), hàm này đọc và ghi sản phẩm, lịch sử (`stock`) và nhật ký trong kho của trình duyệt. Trên production sản phẩm không nằm trong kho đó, nên theo code thì Điều chỉnh báo "Không tìm thấy sản phẩm" và bảng Lịch sử luôn trống (chưa thử trên production). Server có cột `products.stock` và `products.reserved` nhưng không có API điều chỉnh, không có bảng lịch sử; form sản phẩm không có ô tồn kho. Module `inventory` đang khai `browserOnly: true`. Cột `reserved` còn được dùng bởi phần đơn hàng (lưu trong trình duyệt) và thẻ "Sản phẩm sắp hết hàng" ở trang tổng quan.

**Migration.** Mỗi thay đổi DB nội dung là một file trong `backend/content-migrations/`, phải khai trong `backend/src/content/schema.ts` và `ops/content-metadata.cjs`. Thư mục `ops/` không đi theo bản release: deploy tools trên hosting hiện nhận đúng 3 file, nên bản release có file thứ 4 bị từ chối cho tới khi cài lại deploy tools. Bản release cũ đọc được DB có migration mới hơn nếu migration đó chỉ thêm (đã có từ PR #7).

## 3. Cách làm đã cân nhắc

**Import khách hàng**

| Cách | Mô tả | Được | Mất |
|---|---|---|---|
| A (chọn) | Trình duyệt đọc file Excel thành các dòng; server kiểm và lưu qua một API nhận các dòng dạng JSON | Server không phải mở file lạ; một bộ quy tắc kiểm duy nhất ở server; xem trước và lưu dùng chung một đường | Thêm thư viện đọc và ghi `.xlsx` ở giao diện |
| B | Tải file lên, server đọc Excel | Giao diện mỏng hơn | Server phải phân tích file do người dùng gửi (bề mặt tấn công, giới hạn bộ nhớ trên hosting), thêm thư viện ở backend |
| C | Chỉ nhận CSV | Không cần thư viện | Không đúng yêu cầu "từ Excel"; dễ lỗi dấu tiếng Việt |

**Trường mở rộng**

| Cách | Mô tả | Được | Mất |
|---|---|---|---|
| A (chọn) | Cột `representative` cho người đại diện, thêm một cột JSON `extra` cho các trường khác; site khai danh sách trường trong `site/` | Thêm trường sau này là thêm một dòng cấu hình, không đổi DB; cùng cách với thuộc tính sản phẩm (PR #7) | Trường trong `extra` không lọc hay sắp xếp được trên server |
| B | Mỗi trường mới một cột | Lọc, sắp xếp được | Mỗi trường là một migration và một lần cài lại deploy tools |

**Tồn kho**

| Cách | Mô tả | Được | Mất |
|---|---|---|---|
| A | Chỉ ẩn hai cột | Nhanh, không đổi DB | Điều chỉnh vẫn không ghi vào sản phẩm thật, lịch sử vẫn trống trên production |
| B (chọn) | Ẩn hai cột; điều chỉnh và lịch sử chuyển lên server | Điều chỉnh có hiệu lực thật, lịch sử giữ được và dùng chung giữa các máy | Cần bảng mới (cùng migration với phần khách hàng) |

Chủ repo đã nhận các đề nghị này ngày 24/11 (chia hai đợt, tồn kho theo cách B) và không yêu cầu khác; các lựa chọn còn lại bên dưới là quyết định của người viết, ghi ở mục 7.

## 4. Thiết kế

### 4.1. DB: migration `004_customers_inventory.sql`

Chỉ thêm, không sửa hay xóa dữ liệu đang có:

- `ALTER TABLE customers ADD COLUMN representative VARCHAR(255) NULL, ADD COLUMN extra JSON NULL`.
- `CREATE TABLE stock_movements`: `id`, `product_id`, `product_name` (tên lúc điều chỉnh), `delta`, `stock_before`, `stock_after`, `reason` (tối đa 500 ký tự), `source` (`adjust` hoặc `edit`), `actor_id`, `actor_name`, `created_at`; chỉ mục theo `(product_id, created_at)` và `created_at`. Không đặt khóa ngoại tới `products`: xóa sản phẩm không bị chặn và lịch sử của nó vẫn còn.

Khai phiên bản 4 trong `backend/src/content/schema.ts` (danh sách bảng, số bước, kiểm tra câu lệnh) và trong `ops/content-metadata.cjs` (nhận 1 đến 4 file). Cột `products.reserved` giữ nguyên.

### 4.2. Khách hàng: trường mới

- `representative` (Người đại diện) và `extra` (bản đồ khóa thành chuỗi, tối đa 30 khóa, mỗi giá trị tối đa 500 ký tự) có trong API tạo, sửa, xem.
- Site khai trường mở rộng ở `site/customers.config.ts`: danh sách `{ key, label }`, đọc qua `src/platform/site.ts` như các cấu hình khác của site. Site BiBi khai danh sách trống lúc đầu; site mẫu trống (`tests/fixtures/site-blank`) có file tương ứng.
- Form khách, trang chi tiết, file mẫu và bước import đều lấy danh sách trường từ một chỗ: `src/features/admin/customers/fields.ts` (các trường cố định cộng các trường site khai). Thêm trường sau này: thêm một dòng trong `site/customers.config.ts`.
- Form khách và trang chi tiết thêm ô "Người đại diện".

### 4.3. Import khách hàng

**Luồng trên giao diện** (trang Khách mua hàng, nút "Import Excel" cạnh "Thêm mới", chỉ hiện với người có quyền tạo khách):

```
Bước 1  Chọn file            [Tải file mẫu]   [Chọn file .xlsx]
Bước 2  Xem trước
        29 dòng: 25 hợp lệ · 2 trùng · 2 lỗi         [chỉ hiện dòng có vấn đề]
        Dòng  Tên                 Địa chỉ      Điện thoại  Email   VAT  Tình trạng           Xử lý
        10    CÔNG TY ... ANH THƯ 233-235 ...               —      0%   Hợp lệ               Tạo mới
        25    CÔNG TY ... ANH THƯ 233-235 ...               —      0%   Trùng tên với dòng 10 [Bỏ qua ▾]  [Sửa]
        21    Chị Vân ...         —                         —      0%   Hợp lệ               Tạo mới
        ..    (trống)             ...                                    Lỗi: thiếu tên       [Sửa]
Bước 3  [Import 25 khách]   →  "Đã thêm 25, cập nhật 0, bỏ qua 4"
```

- **File mẫu:** tạo ngay trong trình duyệt từ danh sách trường, nên luôn khớp với các trường đang có. Cột: `Tên` (bắt buộc), `Loại khách`, `Địa chỉ`, `Điện thoại`, `Email`, `Người đại diện`, `VAT`, `Thông tin`, rồi các trường site khai. Có một dòng ví dụ.
- **Đọc file:** nhận `.xlsx`, sheet đầu tiên, dòng đầu là tiêu đề. Khớp cột theo tiêu đề (không phân biệt hoa thường, dấu cách thừa); file trong ảnh của chủ repo dùng được nguyên trạng (`STT` bị bỏ qua). Cột không nhận ra được nêu tên ở bước xem trước và bị bỏ qua. Giới hạn 1.000 dòng và 2 MB; dòng trống hoàn toàn bị bỏ qua.
- **Quy đổi:**
  - `VAT`: `Có` thành mức VAT mặc định của form khách (8%), `Không` thành 0%, số thì giữ số (0 đến 100); ô trống thành mức mặc định.
  - `Loại khách`: nhận "Nhà sách", "Cá nhân", "Công ty". Ô trống: tên bắt đầu bằng "Công ty", "Chi nhánh công ty" hoặc "Hộ kinh doanh" thành Công ty; tên có "Nhà sách" hoặc "NXB" thành Nhà sách; còn lại là Cá nhân. Giá trị đoán hiện ở bước xem trước.
  - `Thông tin`: giữ nguyên vào "Thông tin thêm". Nếu ô `Email` hoặc `Điện thoại` của dòng trống và `Thông tin` chứa một email hoặc một số điện thoại thì điền vào ô đó. Tên người trong `Thông tin` không tự tách; người dùng sửa ở bước xem trước nếu muốn.
- **Sửa một dòng:** nút "Sửa" mở hộp thoại với các ô của dòng đó; lưu xong dòng được kiểm lại.
- **Lỗi** (dòng lỗi không import được cho tới khi sửa hoặc bỏ): thiếu tên, tên quá 255 ký tự, email sai dạng, điện thoại quá 50 ký tự, VAT không đọc được, loại khách không nhận ra.
- **Trùng:** hai khách trùng khi cùng tên (bỏ dấu cách thừa, không phân biệt hoa thường), hoặc cùng số điện thoại (chỉ so chữ số), hoặc cùng email (không phân biệt hoa thường). So với khách đang có trên server và với các dòng đứng trước trong file. Mỗi dòng trùng có một lựa chọn:
  - Bỏ qua (mặc định).
  - Cập nhật khách cũ (chỉ khi trùng với khách đang có và người dùng có quyền sửa): ghi các ô có giá trị trong file lên khách đó, ô trống trong file không xóa giá trị cũ.
  - Tạo mới: thêm một khách riêng dù trùng.

**API:** `POST /api/customers/import`, thân `{ dryRun, rows }`. Mỗi dòng gồm số dòng trong file, các trường, và `action` (`create`, `update` kèm `targetId` và `revision` của khách cũ, hoặc `skip`).

- Yêu cầu đăng nhập, kiểm nguồn trình duyệt, quyền `customer.create`; dòng `update` cần thêm `customer.update`.
- `dryRun: true`: không ghi gì, trả về cho từng dòng danh sách lỗi và danh sách trùng (trùng với khách nào hoặc dòng nào, theo tên, điện thoại hay email). Bước xem trước gọi đường này, nên quy tắc kiểm chỉ nằm ở server.
- `dryRun: false`: kiểm lại toàn bộ rồi ghi tất cả trong một giao dịch. Có dòng lỗi, có dòng `create` trùng mà chưa được chọn "Tạo mới", hoặc khách cần cập nhật đã đổi `revision` thì trả 409 kèm danh sách dòng và không lưu dòng nào; giao diện hiện lại bước xem trước với tình trạng mới.
- Nhật ký: một bản ghi `customer.import` với số khách đã thêm, đã cập nhật, đã bỏ qua và mã các khách bị tác động.

### 4.4. Tồn kho

**Trang Tồn kho sản phẩm:**

```
Sản phẩm                     Số lượng tồn
Sổ tay Hà Nội                120            [Điều chỉnh thủ công]
Bưu thiếp Hồ Gươm             35            [Điều chỉnh thủ công]

Lịch sử thay đổi
Ngày        Sản phẩm         Thay đổi   Tồn sau   Lý do            Người sửa
24/11 10:02 Sổ tay Hà Nội    +20        120       Nhập hàng đợt 3  Minh
```

- Bảng còn ba cột: Sản phẩm, Số lượng tồn, nút "Điều chỉnh thủ công". Bỏ cột Đã giữ và Khả dụng khỏi bảng; mô tả trang bỏ câu về "lượng đang giữ".
- Hộp thoại giữ hai ô như hiện nay (số thay đổi, có dấu cộng hoặc trừ; lý do, bắt buộc) và thêm một dòng "Tồn sau điều chỉnh: N".
- Bảng "Lịch sử thay đổi" hiện tên sản phẩm (hiện nay là mã), thêm cột Người sửa, có phân trang, lọc được theo một sản phẩm.
- Nút chỉ bấm được với người có quyền sửa sản phẩm, như hiện nay; người chỉ có quyền xem vẫn xem được bảng và lịch sử.

**API:**

- `POST /api/products/:id/stock-adjustments`, thân `{ revision, delta, reason }`, quyền `product.update`. Trong một giao dịch: kiểm `revision`, tồn mới bằng tồn cũ cộng `delta` và không được nhỏ hơn 0 hay nhỏ hơn `reserved`, cập nhật `products.stock` và tăng `revision`, thêm một dòng `stock_movements`, ghi nhật ký `product.stock_adjust`. Trả về sản phẩm.
- `GET /api/stock-movements` (phân trang, mới nhất trước, lọc `productId`), quyền `product.view`.
- Mọi đường khác đổi `products.stock` trên server (API sửa sản phẩm) cũng thêm một dòng `stock_movements` với `source = edit`, để lịch sử không thiếu.

**Giao diện với hai kiểu dữ liệu.** Khi đăng nhập qua server (production), trang dùng hai API trên. Khi chạy bằng kho của trình duyệt (bộ test giao diện, bản demo), trang giữ đường `adjustStock` hiện có. Module `inventory` bỏ cờ `browserOnly`.

**Không đổi:** cột `reserved` và dữ liệu của nó; phần đơn hàng và phiếu mua hàng; quyền; thẻ "Sản phẩm sắp hết hàng" ở trang tổng quan chỉ đổi chữ "khả dụng" thành "tồn" và tính theo số lượng tồn.

## 5. Kiểm thử

- Backend (MariaDB thật như các test hiện có): migration 4 từ DB phiên bản 3 và từ DB trống; import chạy thử và chạy thật, lỗi từng loại, trùng theo tên, điện thoại, email, trùng trong file, ba lựa chọn, 409 khi dữ liệu đổi giữa xem trước và lưu, không lưu dòng nào khi có lỗi, quyền; điều chỉnh tồn (cộng, trừ, âm, sai `revision`, quyền, hai yêu cầu cùng lúc), lịch sử, dòng lịch sử khi sửa sản phẩm.
- Giao diện (vitest): đọc file mẫu trong ảnh (dựng lại thành file `.xlsx` trong test), quy đổi VAT và loại khách, tách email và điện thoại từ `Thông tin`, các bước import, sửa một dòng; trang tồn kho ba cột, hộp thoại, lịch sử.
- Site mẫu trống: `node scripts/check.mjs blank-site` đạt.
- Deploy tools: `scripts/content-release.test.mjs` nhận 4 file migration.
- `npm run check`, `npm run build`.
- Chạy thử local bằng trình duyệt thật với MariaDB local, có ghi hình: import file dựng theo ảnh của chủ repo (29 dòng, 2 tên trùng), điều chỉnh tồn kho và xem lịch sử, bằng tài khoản có đủ quyền và tài khoản chỉ có quyền xem.

## 6. Triển khai

1. Một PR vào `main`. Có migration 4 và đổi `ops/content-metadata.cjs`.
2. Trước khi Approve bản release này, chủ repo chạy một lần script cài deploy tools trên cPanel (script mới, gửi kèm PR). Chưa chạy thì hosting từ chối bản upload với `Invalid content metadata` và production không đổi.
3. Deploy tools tự sao lưu DB và kiểm bản sao lưu trước khi chạy migration. Bản quay lui là bản đang chạy lúc đó; nó đọc được DB sau migration 4 vì migration chỉ thêm.
4. Sau deploy: kiểm `/api/version`, `/api/ready`, rồi thử trên production một lần import chạy thử (không ghi) và xem trang tồn kho. Không import dữ liệu thật thay chủ repo.

## 7. Quyết định của người viết (chủ repo sửa được khi duyệt)

1. `Có` trong cột VAT là 8% (mức mặc định hiện có của form khách), `Không` là 0%.
2. Khi cột `Loại khách` trống, loại khách được đoán theo tên như ở 4.3 và hiện ở bước xem trước.
3. Trùng được xét theo tên, điện thoại, email; mặc định là Bỏ qua.
4. "Cập nhật khách cũ" không xóa giá trị cũ bằng ô trống trong file.
5. Tên người trong cột `Thông tin` không tự tách thành Người đại diện.
6. Chỉ nhận `.xlsx` (không nhận `.xls`, `.csv`), tối đa 1.000 dòng mỗi lần.
7. Xóa sản phẩm không xóa lịch sử tồn kho của nó.
8. Tồn kho không được điều chỉnh xuống dưới 0.
9. Thẻ "Sản phẩm sắp hết hàng" ở trang tổng quan đổi sang tính và ghi theo số lượng tồn.
10. Thư viện đọc và ghi `.xlsx` ở giao diện: `read-excel-file` và `write-excel-file` (nhỏ, chỉ tải khi mở hộp thoại import). Người lập kế hoạch kiểm phiên bản và giấy phép trước khi thêm.

## 8. Để người lập kế hoạch quyết

- Tên file, cách chia component của hộp thoại import, cách phân trang lịch sử.
- Chỉ mục phục vụ tìm trùng (bảng khách nhỏ; đọc toàn bộ trong giao dịch là đủ cho 1.000 dòng).
- Nội dung chính xác của script cài deploy tools (dựng theo script đã dùng cho migration 3).
