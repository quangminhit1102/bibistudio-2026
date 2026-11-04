export const ANALYTICS_OPT_OUT_KEY = "bibi.analytics.disabled";
export const ANALYTICS_PREFERENCE_EVENT = "bibi:analytics-preference";
export function browserPrivacySignal(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true)
  );
}
export function analyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === "true";
  } catch {
    return false;
  }
}
export function setAnalyticsOptOut(disabled: boolean) {
  try {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, String(disabled));
  } catch {
    /* In-memory event still applies. */
  }
  window.dispatchEvent(new CustomEvent(ANALYTICS_PREFERENCE_EVENT, { detail: disabled }));
}
