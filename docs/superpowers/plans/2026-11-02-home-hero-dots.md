# Chấm slider trang chủ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chấm chuyển ảnh tròn, đơn giản, dễ bấm và không bị cắt khi hero cuộn/animation.

**Architecture:** Giữ một active slide state trong hero, đưa điều khiển thành sibling của lớp ảnh có Parallax/clip-path. Chỉ ảnh tham gia hiệu ứng; dots đi cùng hero, không sticky sang section khác. Đây là deliverable độc lập với admin.

**Tech Stack:** React19, TypeScript, Tailwind, motion primitives hiện có; không dependency mới.

**Spec:** [Thiết kế mục11–12](../specs/2026-11-02-admin-ui-polish-design.md). [Plan admin liên quan](2026-11-02-admin-ui-polish.md).

## Global Constraints

- Dots vẫn tròn; active đặc, inactive vòng mảnh; bỏ pill blur nặng, không biến thành thanh.
- Vùng chạm44px, focus rõ và aria-current; reduced motion vẫn tắt autoplay như hiện có.
- Giữ5500ms autoplay và chọn ảnh thủ công; không ảnh hưởng nội dung/ảnh/font/kính lúp3x/bidiary.
- Kiểm tra360/390/768/1024/1440px. Dots không bị clip khi hero còn hiển thị; hero ra khỏi viewport thì dots đi cùng hero.
- Không dependency mới; public gzip delta tổng so `docs/admin-baseline.json`: JS≤10240bytes/CSS≤2048bytes, tính cả admin nếu cùng branch.
- Local trước; không push/deploy, không rewrite Git history. Đọc `docs/build-and-deploy.md` trước chạy/build.

## Review Focus

1. Scroll xuống/lên lúc ảnh đang chuyển: dots ở lớp ổn định, không bị transform/clip-path cắt — browser cuộn ở giữa transition.
2. Bàn phím và reduced motion: focus đủ thấy, chọn ảnh được, không tự chuyển khi giảm chuyển động — browser keyboard/emulation.
3. Timer/resize hoặc unmount/remount: chỉ một timer5500ms, active index và ảnh/current dot khớp — targeted test fake timer.
4. Ảnh tải chậm và màn390px: dots có vị trí/hit area ổn định trước và sau load — browser network/load + đo vùng chạm.
5. Hero cuộn hết khỏi màn hình: không có nút floating đè section sau — browser full scroll, resize và đi trang khác/quay về.

---

### Task 1: Điều khiển hero độc lập lớp chuyển động và kiểm chứng thật

**Files:** Modify `src/routes/index.tsx`; Create `src/components/brand/hero-slides.tsx`, `tests/admin/hero-slides.test.tsx`; update `docs/admin-acceptance.md` phần public hero. Giữ `src/components/brand/motion.tsx` API hiện tại, không sửa toàn bộ Parallax để chữa riêng hero.

**Interfaces:** Export `HeroSlide={src:string;alt:string;label?:string;slug?:string}`; `HeroSlides({slides}:{slides:HeroSlide[]})` sở hữu state/timer và layout ổn định, images nằm trong lớp motion riêng. Không đưa controls vào ancestor có transform/clip-path; `index.tsx` bỏ outer Parallax cũ quanh toàn component, component áp hiệu ứng riêng cho ảnh. Không đưa timer state lên page root gây render mọi section.

- [ ] Browser tái hiện trước sửa tại scroll0,25%,50%,75% chiều cao hero trong transition và sau animation; chụp evidence clipping nếu tái hiện được, ghi rõ viewport. Nếu chưa tái hiện không tuyên bố đã xác nhận nguyên nhân; vẫn kiểm tra DOM/clip chain để chọn vị trí controls.
- [ ] **RED:** `advances_after_5500ms_and_manual_selection_updates_current` assert lúc5499ms ảnh1/dot1,5500ms ảnh2/dot2; click dot3 tương ứng ảnh3. `does_not_autoplay_with_reduced_motion` sau11000ms vẫn ảnh1 nhưng click đổi được. `cleans_timer_on_unmount` không còn timer của component. Giữ image alt/aria-hidden cho active/inactive, count dots bằng count ảnh. Chạy `npm run test:admin -- tests/admin/hero-slides.test.tsx`, xác nhận FAIL chức năng/component mới thiếu.
- [ ] Implement container ổn định có controls sibling image layer, dot fixed circle/ring, hit44px, aria-label tiếng Việt và aria-current; focus ring tương phản cả ảnh sáng/tối. Bỏ pill blur nặng, không hover kéo dài dot. Giữ eager ảnh đầu/lazy ảnh sau, opacity/transform transitions và reduced motion.
- [ ] Chạy targeted PASS; browser360/390/768/1024/1440 tại các vị trí scroll trong/sau transition, resize, slow image load, keyboard Tab/Enter/Space, reduced motion, chọn ảnh/autoplay. Chụp trước/sau, đo hit44px và kiểm tra dots hoàn toàn biến khỏi viewport cùng hero. Kiểm tra không tràn ngang/không che CTA và không lỗi console sau unmount/remount.
- [ ] Chạy `npm run check`, `npm run build`, `node scripts/admin-bundle-report.mjs`: exit0 và budget tổng đạt. Mở artifact `.releases/local-SHA` thật bằng `node scripts/preview.mjs <artifact>` rồi kiểm tra homepage/đi product/quay lại. Nếu admin plan chạy cùng đợt, dùng acceptance build cuối cùng chung nhưng ghi đúng SHA/artifact và không bỏ browser hero.
- [ ] Cập nhật evidence/observed trong acceptance; `git diff --check`; commit `fix(site): keep circular hero controls outside moving image layers`. Không push/deploy.

## Tự review plan và bàn giao

Đã phủ yêu cầu dot tròn/đẹp/không clipping, accessibility, timer và reduced motion; kiểm chứng CSS bằng browser thay vì test lặp class. Không thay slider thành carousel thư viện hoặc mở rộng nội dung. Giữ phương thức Native cùng plan admin; chờ review plan trước triển khai.

