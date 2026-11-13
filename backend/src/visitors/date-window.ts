import type { VisitorBucketUnit, VisitorWindowDto } from "../http/contracts";
import { ApiError } from "../http/errors";

const DAY = 86_400_000;
const VIETNAM_OFFSET = 7 * 3_600_000;
const invalid = () => new ApiError(400, "INVALID_VISITOR_WINDOW", "Khoảng ngày không hợp lệ");

function calendarDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid();
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(time) ||
    Number(value.slice(0, 4)) < 1970 ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw invalid();
  return time;
}

const dateString = (time: number) => new Date(time).toISOString().slice(0, 10);
const iso = (time: number) => new Date(time).toISOString();

export function resolveVisitorWindow(
  input: { preset?: "1m" | "6m" | "1y"; from?: string; to?: string },
  now: Date,
): VisitorWindowDto {
  if (!Number.isFinite(now.getTime())) throw invalid();
  let start: number;
  let end: number;
  if (input.from !== undefined || input.to !== undefined) {
    if (
      input.preset !== undefined ||
      typeof input.from !== "string" ||
      typeof input.to !== "string"
    )
      throw invalid();
    start = calendarDate(input.from);
    const last = calendarDate(input.to);
    if (start > last) throw invalid();
    end = last + DAY;
  } else {
    const preset = input.preset ?? "1m";
    if (!["1m", "6m", "1y"].includes(preset)) throw invalid();
    const months = { "1m": 1, "6m": 6, "1y": 12 }[preset];
    if (!months) throw invalid();
    end = calendarDate(dateString(now.getTime() + VIETNAM_OFFSET)) + DAY;
    const boundary = new Date(end);
    const monthStart = new Date(end);
    monthStart.setUTCDate(1);
    monthStart.setUTCMonth(monthStart.getUTCMonth() - months);
    const lastDay = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    ).getUTCDate();
    monthStart.setUTCDate(Math.min(boundary.getUTCDate(), lastDay));
    start = monthStart.getTime();
    calendarDate(dateString(start));
  }
  return {
    fromDate: dateString(start),
    toDate: dateString(end - DAY),
    startUtc: iso(start - VIETNAM_OFFSET),
    endUtcExclusive: iso(end - VIETNAM_OFFSET),
    asOf: now.toISOString(),
  };
}

export function selectVisitorBucket(window: VisitorWindowDto): VisitorBucketUnit {
  const days = (Date.parse(window.endUtcExclusive) - Date.parse(window.startUtc)) / DAY;
  return days <= 2
    ? "hour"
    : days <= 90
      ? "day"
      : days <= 730
        ? "week"
        : days <= 7305
          ? "month"
          : "year";
}

/** Calendar buckets include empty periods and clip both edges to the selected cohort. */
export function visitorBuckets(window: VisitorWindowDto) {
  const unit = selectVisitorBucket(window);
  const end = Date.parse(window.endUtcExclusive);
  const buckets: { startUtc: string; endUtcExclusive: string; label: string; sessions: number }[] =
    [];
  let cursor = Date.parse(window.startUtc);
  while (cursor < end) {
    const local = new Date(cursor + VIETNAM_OFFSET);
    if (unit === "hour") local.setUTCHours(local.getUTCHours() + 1, 0, 0, 0);
    else if (unit === "day") local.setUTCDate(local.getUTCDate() + 1);
    else if (unit === "week")
      local.setUTCDate(local.getUTCDate() + (7 - ((local.getUTCDay() + 6) % 7)));
    else if (unit === "month") {
      local.setUTCDate(1);
      local.setUTCMonth(local.getUTCMonth() + 1);
    } else {
      local.setUTCMonth(0, 1);
      local.setUTCFullYear(local.getUTCFullYear() + 1);
    }
    const next = Math.min(end, local.getTime() - VIETNAM_OFFSET);
    const labelDate = new Date(cursor + VIETNAM_OFFSET).toISOString();
    const label =
      unit === "hour"
        ? `${labelDate.slice(8, 10)}/${labelDate.slice(5, 7)} ${labelDate.slice(11, 13)}:00`
        : unit === "year"
          ? labelDate.slice(0, 4)
          : unit === "month"
            ? `${labelDate.slice(5, 7)}/${labelDate.slice(0, 4)}`
            : `${labelDate.slice(8, 10)}/${labelDate.slice(5, 7)}/${labelDate.slice(0, 4)}`;
    buckets.push({ startUtc: iso(cursor), endUtcExclusive: iso(next), label, sessions: 0 });
    cursor = next;
  }
  return buckets;
}
