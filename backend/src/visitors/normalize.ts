import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ANALYTICS_TTL_MS = 90 * 86400000;
const signature = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("base64url");
export function createVisitorCookie(secret: string, now: Date): string {
  const payload = `${randomBytes(32).toString("base64url")}.${Math.floor((+now + ANALYTICS_TTL_MS) / 1000).toString(36)}`;
  return `${payload}.${signature(payload, secret)}`;
}
export function visitorIdentity(
  cookie: string | undefined,
  secret: string,
  now: Date,
): string | undefined {
  if (!cookie || !/^[A-Za-z0-9_-]{43}\.[a-z0-9]{1,12}\.[A-Za-z0-9_-]{43}$/.test(cookie)) return;
  const [id, expiry, signed] = cookie.split(".");
  const expires = parseInt(expiry, 36) * 1000;
  if (expires <= +now || expires > +now + ANALYTICS_TTL_MS) return;
  const expected = signature(`${id}.${expiry}`, secret);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signed))) return;
  return createHmac("sha256", secret).update(`identity:${id}`).digest("hex");
}
/** Store controlled labels only, never the original user agent. */
export function deviceLabels(value: string) {
  const ua = value.slice(0, 512);
  return {
    device: /iPad|Tablet/i.test(ua)
      ? "tablet"
      : /Mobile|Android|iPhone/i.test(ua)
        ? "mobile"
        : "desktop",
    os: /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad/i.test(ua)
        ? "iOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS/i.test(ua)
            ? "macOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Unknown",
    browser: /Edg\//i.test(ua)
      ? "Edge"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Chrome\//i.test(ua)
          ? "Chrome"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Unknown",
  };
}
