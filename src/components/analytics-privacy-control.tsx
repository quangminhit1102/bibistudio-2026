import { useEffect, useState } from "react";
import {
  analyticsOptedOut,
  browserPrivacySignal,
  setAnalyticsOptOut,
  ANALYTICS_PREFERENCE_EVENT,
  ANALYTICS_OPT_OUT_KEY,
} from "../lib/analytics-privacy";
import { t } from "@/lib/messages";
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
      <summary className="cursor-pointer py-2 hover:text-foreground">{t("privacy.title")}</summary>
      <p className="my-2">{t("privacy.text")}</p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={!disabled && !privacySignal}
          disabled={privacySignal}
          onChange={(event) => setAnalyticsOptOut(!event.target.checked)}
          className="size-4 accent-current"
        />
        {t("privacy.allow")}
      </label>
      {privacySignal && <p>{t("privacy.signal")}</p>}
      <p className="mt-2">{t("privacy.note")}</p>
    </details>
  );
}
