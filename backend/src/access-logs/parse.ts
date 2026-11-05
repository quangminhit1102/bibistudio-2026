import { createHash } from "node:crypto";
import { networkPrefix } from "../http/network";
import { deviceLabels } from "../visitors/normalize";
import type { AccessLogRecord } from "./types";

class InvalidLine extends Error {}
const invalid = (code: string): never => {
  throw new InvalidLine(code);
};
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function timestamp(value: string): string {
  const m = /^(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(
    value,
  );
  if (!m) return invalid("INVALID_TIME");
  const [day, month, year, hour, minute, second] = [
    +m[1],
    months.indexOf(m[2]),
    +m[3],
    +m[4],
    +m[5],
    +m[6],
  ];
  if (
    month < 0 ||
    year < 1000 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    +m[8] > 23 ||
    +m[9] > 59
  )
    return invalid("INVALID_TIME");
  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day)
    return invalid("INVALID_TIME");
  const offset = (+m[8] * 60 + +m[9]) * (m[7] === "+" ? 1 : -1);
  return new Date(+date - offset * 60000).toISOString();
}
function numberOrNull(value: string): number | null {
  if (value === "-") return null;
  const result = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(result)) return invalid("INVALID_BYTES");
  return result;
}
function quoted(input: string, start: number): [string, number] {
  if (input[start] !== '"') return invalid("INVALID_SYNTAX");
  let result = "";
  for (let i = start + 1; i < input.length; i++) {
    const char = input[i];
    if (char === '"') return [result, i + 1];
    if (char !== "\\") {
      result += char;
      continue;
    }
    const escape = input[++i];
    if (escape === '"' || escape === "\\") result += escape;
    else if (escape === "x" && /^[a-f0-9]{2}$/i.test(input.slice(i + 1, i + 3))) {
      result += String.fromCharCode(parseInt(input.slice(i + 1, i + 3), 16));
      i += 2;
    } else if (["n", "r", "t"].includes(escape))
      result += ({ n: "\n", r: "\r", t: "\t" } as Record<string, string>)[escape];
    else return invalid("INVALID_ESCAPE");
  }
  return invalid("INVALID_SYNTAX");
}
function cleanPath(target: string): string {
  let pathname = target.split(/[?#]/, 1)[0];
  if (/^https?:\/\//i.test(target)) {
    try {
      pathname = new URL(target).pathname;
    } catch {
      return invalid("INVALID_PATH");
    }
  }
  if (
    (!pathname.startsWith("/") && pathname !== "*") ||
    pathname.length > 2048 ||
    [...pathname].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    return invalid("INVALID_PATH");
  return pathname;
}
function referrer(value: string): string | null {
  if (value === "-") return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const safe = url.origin + url.pathname;
    return safe.length <= 2048 ? safe : null;
  } catch {
    return null;
  }
}

/** Each nonblank physical position survives, even when its fields cannot be parsed safely. */
export function parseAccessLogLine(
  bytes: Buffer,
  sourceId: string,
  ordinal: number,
): AccessLogRecord | null {
  if (!sourceId || sourceId.length > 128 || !Number.isSafeInteger(ordinal) || ordinal < 1)
    throw new RangeError("Invalid access log position");
  const row: AccessLogRecord = {
    id: createHash("sha256")
      .update(JSON.stringify([sourceId, ordinal]))
      .digest("hex"),
    sourceId,
    ordinal,
    occurredAt: null,
    method: null,
    pathname: null,
    status: null,
    bytes: null,
    ipPrefix: null,
    deviceType: null,
    operatingSystem: null,
    browser: null,
    resourceKind: "other",
    isBot: false,
    referrer: null,
    parseStatus: "error",
    errorCode: null,
  };
  try {
    if (bytes.length > 65536) return { ...row, errorCode: "OVERSIZED_LINE" };
    let input: string;
    try {
      input = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return { ...row, errorCode: "INVALID_UTF8" };
    }
    if (!input.trim()) return null;
    const prefix = /^(\S+) \S+ \S+ \[([^\]]+)\] /.exec(input);
    if (!prefix) return invalid("INVALID_SYNTAX");
    const ipPrefix = networkPrefix(prefix[1]);
    if (ipPrefix === "unknown") return invalid("INVALID_IP");
    const occurredAt = timestamp(prefix[2]);
    const [request, endRequest] = quoted(input, prefix[0].length);
    const numeric = /^ (\d{3}) (\d+|-) /.exec(input.slice(endRequest));
    if (!numeric || +numeric[1] < 100 || +numeric[1] > 599) return invalid("INVALID_STATUS");
    const [refer, endRefer] = quoted(input, endRequest + numeric[0].length);
    if (input[endRefer] !== " ") return invalid("INVALID_SYNTAX");
    const [agent, endAgent] = quoted(input, endRefer + 1);
    if (input.slice(endAgent).trim()) return invalid("INVALID_SYNTAX");
    const requestParts =
      /^([A-Z][A-Z0-9_-]{0,19}) (.+) HTTP\/(?:1\.[01]|2(?:\.0)?|3(?:\.0)?)$/.exec(request);
    if (!requestParts) return invalid("INVALID_REQUEST");
    const pathname = cleanPath(requestParts[2]);
    const labels = deviceLabels(Buffer.from(agent).subarray(0, 512).toString("utf8"));
    const resourceKind = /^\/api(?:\/|$)/.test(pathname)
      ? "api"
      : /\.(?:avif|webp|jpe?g|png|gif|svg|ico|css|js|mjs|map|woff2?|ttf|mp4|pdf)$/i.test(pathname)
        ? "asset"
        : pathname.startsWith("/")
          ? "page"
          : "other";
    return {
      ...row,
      occurredAt,
      method: requestParts[1],
      pathname,
      status: +numeric[1],
      bytes: numberOrNull(numeric[2]),
      ipPrefix,
      deviceType: labels.device,
      operatingSystem: labels.os,
      browser: labels.browser,
      resourceKind,
      isBot: /bot\b|crawler|spider|slurp|headless/i.test(agent.slice(0, 512)),
      referrer: referrer(refer),
      parseStatus: "parsed",
      errorCode: null,
    };
  } catch (error) {
    if (!(error instanceof InvalidLine)) throw error;
    return { ...row, errorCode: error.message };
  }
}
