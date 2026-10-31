# Map Notebook Mockups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task if Native execution is selected; use superpowers:subagent-driven-development if the user selects Subagent-driven execution. Steps use checkbox syntax for tracking.

**Goal:** Cập nhật ba sổ bản đồ đã có và thêm mười mẫu còn thiếu, dùng bộ 13 mockup và tên sản phẩm đã duyệt.

**Architecture:** Giữ catalogue tĩnh tại `src/data/catalogue.ts` và component hiện tại. Thêm 13 WebP có URL mới trong `public/catalogue`, thay gallery ba mẫu cũ, thêm mười bản ghi mới. Không đổi backend hoặc luồng production-only.

**Tech Stack:** React19, TypeScript, TanStack Router, Vite, Node24, công cụ chuyển đổi ảnh local, trình duyệt desktop/mobile.

**Spec:** `docs/superpowers/specs/2026-10-31-map-notebooks-design.md` — đã được người dùng duyệt.

## Global Constraints

- Tên Việt: **Sổ tay bản đồ + địa danh**; tên Anh: **[Place] Map Notebook**, riêng Việt Nam dùng **Vietnam Map Notebook**.
- Cả 13 mẫu: `productType: notebook`, `collection: explore-vietnam`; ba slug hiện hữu giữ nguyên.
- Chỉ mockup mới trong mỗi gallery, một ảnh/mẫu. Giữ file ảnh cũ; không sửa artwork, cắt giả góc chụp, hoặc dùng ảnh AI.
- WebP ASCII, URL mới, giữ nguyên bố cục/nền giấy; cạnh dài tối đa2000px, không phóng lớn. Mục tiêu ≤600KB/ảnh nếu vẫn rõ chữ, ghi lại ngoại lệ thực tế.
- Giữ featured của Sài Gòn; mẫu mới không featured. Không tự thêm thông số kỹ thuật, giá/giỏ hàng hoặc collection mới.
- Không thay ảnh collection/menu, sản phẩm khác, CI/CD hoặc staging. Không push/deploy production trong phạm vi lập plan.
- Đọc `AGENTS.md` và `docs/build-and-deploy.md`; không force-push. Dùng worktree hiện có, nhánh `codex/map-notebook-mockups`, bảo toàn thay đổi ngoài phạm vi.

## Review Focus

- Tên file viết tắt DN/HG/HN/PQ/SG/VN: đối chiếu chữ trên bìa với địa danh, không ghép nhầm sản phẩm (Task1).
- Nén ảnh nhiều chữ nhỏ: kiểm tra địa danh và đường nét ở kích thước hiển thị lẫn phóng to (Task1/3).
- Card có hover ảnh thứ hai: cả ba sản phẩm cũ phải hết tham chiếu gallery cũ, không xuất hiện bìa khác phiên bản (Task2/3).
- Source thay đổi từ lần kiểm kê: kiểm tra slug hiện tại và tính duy nhất, thêm đúng mười mẫu, giữ các sản phẩm khác (Task2).
- Khung4:5, mobile và fullscreen: không cắt mất cuốn sổ hoặc tên địa danh; kiểm tra Magnifier desktop và gallery mobile (Task3).

## File structure

| File | Trách nhiệm |
|---|---|
| `public/catalogue/notebook-map-<place>-mockup.webp` (13 file) | Ảnh web được chuyển đổi từ đúng mockup nguồn |
| `src/data/catalogue.ts` | Tên Việt/Anh, gallery, mười sản phẩm mới và thứ tự |
| `docs/superpowers/plans/2026-10-31-map-notebook-mockups-progress.md` | Ánh xạ ảnh, kích thước/dung lượng, lệnh kiểm tra và bằng chứng thực tế |

Không tạo module, component hoặc dependencies runtime mới. Không viết unit test chỉ để lặp lại mười ba bản ghi nội dung; dùng kiểm tra dữ liệu thực, build và browser để nghiệm thu thay đổi nội dung này.

### Task 1: Chuẩn bị 13 ảnh WebP

**Files:** Create13 file ảnh theo quy tắc trên; tạo progress ledger.

**Interfaces:** Nguồn PNG và slug nằm trong bảng spec. `<place>` là phần slug bỏ hậu tố `-map-notebook`: `da-nang`, `ha-giang`, `sai-gon`, `ca-mau`, `da-lat`, `ha-noi`, `hoi-an`, `hue`, `nha-trang`, `phu-yen`, `phu-quoc`, `quang-ninh`, `viet-nam`.

- [x] Kiểm tra `git status`, catalogue hiện tại và đủ13 file nguồn; ghi hash SHA256, kích thước pixel và ánh xạ vào ledger. Dừng xử lý mẫu nếu file nguồn thiếu hoặc không đọc được, không thay bằng placeholder.
- [x] Tìm công cụ chuyển đổi local sẵn có hỗ trợ WebP. Chuyển đổi bằng công cụ thông thường với giữ tỷ lệ, không crop/upscale, cạnh dài2000px tối đa. Không thay package/lockfile của ứng dụng chỉ để nén ảnh.
- [x] Đọc lại13 file kết quả bằng decoder: đúng WebP, kích thước hợp lệ, tên ASCII, đủ13 đường dẫn riêng biệt. Ghi dung lượng trước/sau; nếu vượt600KB thì điều chỉnh chất lượng sau khi xem ảnh, không đánh đổi chữ bị nhòe để ép đạt ngưỡng.
- [x] Xem trực tiếp toàn bộ13 ảnh kết quả, đối chiếu địa danh trên bìa với tên file; kiểm tra chữ nhỏ và toàn bộ cuốn sổ. Ghi kết quả thực tế vào ledger.

Deliverable:13 ảnh web đã được kiểm tra; giữ chưa commit riêng để commit cùng catalogue ở Task2 thành một thay đổi có thể sử dụng.

### Task 2: Cập nhật catalogue

**Files:** Modify `src/data/catalogue.ts`; update progress ledger.

**Interfaces:** Dùng helper `p(...)` hiện có, `images: ["/catalogue/notebook-map-<place>-mockup.webp"]`. Ánh xạ tên/slug theo spec và ảnh Task1; không đổi cấu trúc `Product`.

- [x] Đối chiếu catalogue mới nhất với bảng13 mẫu; lưu danh sách slug và dữ liệu của sản phẩm ngoài phạm vi để kiểm tra sau khi sửa. Nếu đã xuất hiện mẫu mới thì cập nhật bản ghi đó, không thêm trùng.
- [x] Đổi tên Việt/Anh và gallery của `da-nang-map-notebook`, `ha-giang-map-notebook`, `sai-gon-map-notebook`; giữ slug, featured và các thuộc tính khác. Rà mô tả hiện có, chỉ chỉnh nếu mâu thuẫn với mockup mới.
- [x] Thêm mười mẫu còn thiếu ngay sau nhóm bản đồ hiện hữu, theo thứ tự bảng spec. Dùng tên Việt đã duyệt và tên Anh tương ứng; mô tả ngắn song ngữ về minh họa địa danh trên bìa, alt text theo helper; không bịa thông số, số trang hoặc chất liệu.
- [x] Kiểm tra dữ liệu thực:13 slug khớp bảng, duy nhất trên toàn catalogue, đúng type/collection, mỗi gallery đúng một ảnh Task1. Tổng sản phẩm tăng10 nếu preflight không có thay đổi mới; so sánh sản phẩm ngoài phạm vi không đổi nội dung (sortOrder có thể dịch do chèn nhóm mới).
- [x] Chạy Node24 `npm run check`: exit0, không lỗi types/lint/catalogue/tests. Validator ảnh hiện tại chủ yếu kiểm tra asset descriptor, vì vậy không dùng kết quả đó thay cho kiểm tra13 ảnh mới trực tiếp ở Task1.
- [x] Chạy `git diff --check`, xem diff dữ liệu và danh sách file, rồi commit13 ảnh cùng catalogue và ledger: `feat: refresh map notebook catalogue mockups`.

### Task 3: Nghiệm thu bản build và bàn giao

**Files:** Update progress ledger; không dự kiến sửa component.

**Interfaces:** Dùng `npm run build -- --preview` theo runbook; kiểm tra trên URL preview do lệnh thực tế báo. Sản phẩm ở `/products/<slug>`; tìm đường dẫn danh sách/collection từ UI hoặc route source, không đoán URL.

- [x] Build với Node24, yêu cầu exit0 và ghi release/artifact local thực tế. Khởi động preview từ bản build; xác nhận FE/BE READY và `/api-test` khớp version local.
- [x] Kiểm tra trên browser13 trang detail: tên và ảnh đúng mẫu, ảnh có kích thước tự nhiên dương và giải mã được; không lỗi tải ảnh/JS. Mở lại ba URL cũ và mười URL mới, xác nhận không404.
- [x] Kiểm tra danh sách Sổ tay, Khám phá Việt Nam, tìm kiếm với tên có dấu (ví dụ “Sổ tay bản đồ Đà Lạt”) và sản phẩm liên quan: ảnh/tên mới hiện đúng; hover ba mẫu cũ không hiện ảnh cũ.
- [x] Kiểm tra viewport desktop1440×900 và mobile390×844: card/detail chứa đủ cuốn sổ và tiêu đề; desktop magnifier, mobile/fullscreen mở/đóng được với gallery một ảnh. Xem toàn bộ13 mẫu; lưu screenshot đại diện danh sách, detail desktop và mobile tại thư mục visualization của session.
- [x] Nếu cần sửa component ảnh để đạt yêu cầu, ghi rõ lỗi và phạm vi trước; không thay bố cục rộng hơn thiết kế đã duyệt. Nếu có sửa logic, thêm regression phù hợp và chạy lại kiểm tra bị ảnh hưởng.
- [x] Ghi chính xác kết quả check/build/browser, dung lượng13 ảnh, screenshot và giới hạn chưa kiểm chứng vào ledger. Commit bằng chứng, bàn giao link tài liệu/ảnh; chưa ghi production đã cập nhật. Việc push và phát hành là bước riêng sau review theo luồng manual production, có rollback.

## Plan self-review

Đã đối chiếu spec: phương án1, quy tắc tên sau chỉnh sửa,13 mẫu/3slug cũ/10mẫu mới, ảnh local tối ưu, thứ tự/featured, giữ các ảnh và sản phẩm khác, desktop/mobile và production thủ công đều có bước phụ trách. Không thay module hoặc mở rộng phạm vi ứng dụng. Chưa thực hiện chuyển đổi, sửa catalogue hay chạy nghiệm thu cho nội dung mới.
