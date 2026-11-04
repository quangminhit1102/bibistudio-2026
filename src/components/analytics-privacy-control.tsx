import { useEffect, useState } from "react";
import {
  analyticsOptedOut,
  browserPrivacySignal,
  setAnalyticsOptOut,
  ANALYTICS_PREFERENCE_EVENT,
  ANALYTICS_OPT_OUT_KEY,
} from "../lib/analytics-privacy";
export function AnalyticsPrivacyControl() {
  const [disabled, setDisabled] = useState(false);
  const [privacySignal, setPrivacySignal] = useState(false);
  useEffect(() => {
    const update = (event?: Event) => {
      if (event instanceof StorageEvent && event.key !== ANALYTICS_OPT_OUT_KEY) return;
      setDisabled(
        event instanceof CustomEvent && typeof event.detail === "boolean"
          ? event.detail
          : analyticsOptedOut(),
      );
      setPrivacySignal(browserPrivacySignal());
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener(ANALYTICS_PREFERENCE_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(ANALYTICS_PREFERENCE_EVENT, update);
    };
  }, []);
  return (
    <details className="max-w-md text-xs leading-relaxed tracking-normal">
      <summary className="cursor-pointer py-2 hover:text-foreground">
        Quyền riêng tư khi truy cập
      </summary>
      <p className="my-2">
        BiBi ghi nhận các trang và sản phẩm được quan tâm bằng cookie riêng trong tối đa 90 ngày. IP
        được che; không thu thập vị trí chính xác hoặc nội dung biểu mẫu. Không liên kết với tài
        khoản quản trị.
      </p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={!disabled && !privacySignal}
          disabled={privacySignal}
          onChange={(event) => setAnalyticsOptOut(!event.target.checked)}
          className="size-4 accent-current"
        />
        Cho phép ghi nhận trang và sản phẩm quan tâm
      </label>
      {privacySignal && <p>Đã tắt theo lựa chọn DNT/GPC của trình duyệt.</p>}
      <p className="mt-2">
        Tắt sẽ dừng ghi nhận mới và xóa cookie analytics của trình duyệt này. Dữ liệu cũ tự hết hạn;
        cookie đăng nhập không bị ảnh hưởng.
      </p>
    </details>
  );
}
