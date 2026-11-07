# Hồ sơ admin — phát hành07/11/2026

Trạng thái: đợt phát hành đầu gặp lỗi upload hosting và đã rollback. Chưa nghiệm thu hoàn tất bản sửa.

- Runtime source ban đầu a25593a532efae5fabcb43c39a8fd75f57de6819, main CI42330165793 thành công. Run42328774355 trước đó thất bại vì test đọc isDisabled ngay trước effect React; sửa chờ trạng thái thực, giữ assertion. Local check sau sửa269UI/248Node+6POSIXskip/watcher/4browser đạt.
- Receiver được nâng từ gói source5c5399cd3a233cecbc0e2052fe475541b0e6ae56;13file khớp receipt SHA; ops không khác a25593a. Archive kèm probe SHA256fbec200029e8a1690bfb9fceac55d007abc3c61c61cb4d83feb3be3dfec33ad7. Giữ bộ cũ tại /home/vhplasti/bibi-deploy/tools-before-profile-20261107. Receiver check Node24.22.2 ok.
- private/profile-assets0700 và runtime.env/maintenance.env0600 cùng PROFILE_ASSET_DIR tuyệt đối ngoài webroot. Hai file env cũ giữ suffix.before-profile-20261107; kiểm lại qua parseEnv đúng. Không đổi key/quyền DB.
- Worker16MP đo thật trên Node24hosting:512×512/1277ms/peak332020KiB (~324MiB). cPanel lúc đo330–333MB/2GiB. Wrapper npm nodevenv báo EUSAGE; dùng đúng npmBin cấu hình /opt/alt/alt-nodejs24/root/usr/bin/npm và lockfile cài đạt.
- Deploy42332285458 thành công, source/version/readiness200. API create account và sửa phone đạt nhưng PUT PNG trả406HTML từ LiteSpeed, không có X-Request-Id; Express chưa nhận. PNG/JPEG multipart và raw đều bị chặn; JSON cùng endpoint vào được API401. Không tắt/bỏ rule WAF.
- Rollback42333259608 thành công về d7a47285ddd54848b34c58ed6948b871d2b0ba99-42063626652; đối chiếu APIversion vàready200. Không down-migrate/restore DB.
- Fixture riêng cho kiểm chứng: profile_probe_636f2c6f, ID7ac9cb38-7cbd-4bd3-9368-02d3355a52e3, không role; chỉ metadata kiểm thử. Secret nằm ignored local, không trong Git. Giữ để kiểm chứng forward rồi soft-delete sau nghiệm thu; chưa xóa.

## Bản sửa đang kiểm chứng

JSON/base64 envelope chỉ trên avatar PUT, parse sau auth/origin/preflight/rate; wire2797228B, decoded2MiB; base64canonical và kiểm tra nội dung ảnh giữ nguyên; JSON API khác16KiB. Client giữ epoch qua encode và retry. Không thêm dependency; chi phí wire tăng~1/3. Raw API vẫn tương thích nếu upstream cho phép.

RED: envelope>16KiB nhận413 thay200; client raw body sai JSON và encode-race assertion thất bại. GREEN bước đầu19backend+5client; full check/CI/build/hosting upload và backup có ảnh/forward đang chờ.

Full check bản sửa:100UI files/270tests đạt;255Node tests249pass/6POSIXskip;watcher1pass;4Chromium suites đều đạt (profile60851ms). Log .superpowers/e2e/profile/json-transport-full-check.log. Review độc lập read-only: không có findings. CI/build/hosting bản sửa chưa nghiệm thu.
