import ipaddr from "ipaddr.js";
import { ApiError } from "../http/errors";
function address(value: string): string | null {
  if (!value || /[%\s,/]/.test(value)) return null;
  if (!value.includes(":")) {
    const parts = value.split(".");
    if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255))
      return null;
    return parts.map(Number).join(".");
  }
  try {
    return ipaddr.process(value).toString();
  } catch {
    return null;
  }
}
export function normalizeExclusionRules(input: string[]): string[] {
  const invalid = (line: number): never => {
    throw new ApiError(400, "INVALID_INPUT", `Quy tắc IP không hợp lệ tại dòng ${line}`);
  };
  if (!Array.isArray(input) || input.length > 200) invalid(1);
  return [
    ...new Set(
      input.map((raw, i) => {
        if (typeof raw !== "string" || raw.length > 100) return invalid(i + 1);
        const value = raw.trim();
        if (value.includes("*")) {
          const parts = value.split(".");
          if (
            parts.length !== 4 ||
            parts.every((p) => p === "*") ||
            parts.some((p) => p !== "*" && (!/^\d{1,3}$/.test(p) || Number(p) > 255))
          )
            return invalid(i + 1);
          return parts.map((p) => (p === "*" ? p : String(Number(p)))).join(".");
        }
        return address(value) ?? invalid(i + 1);
      }),
    ),
  ];
}
export function isExcludedIp(ip: string | null, rules: string[]): boolean {
  const normalized = ip && address(ip);
  if (!normalized) return false;
  return rules.some(
    (rule) =>
      rule === normalized ||
      (rule.includes("*") &&
        normalized.includes(".") &&
        !normalized.includes(":") &&
        rule.split(".").every((p, i) => p === "*" || p === normalized.split(".")[i])),
  );
}
