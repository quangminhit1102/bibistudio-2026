import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import { ApiError } from "../http/errors";
import { readAccessLogSchema } from "./schema";
import type { AccessLogRecord, AccessLogStatus } from "./types";
import { readCurrentAccessLogStatus } from "./current-read-service";

export interface AccessLogFilters {
  page: number;
  pageSize: number;
  search: string;
  from?: string;
  to?: string;
  ipPrefix?: string;
  pathname?: string;
  status?: number;
  resourceKind?: string;
  isBot?: "true" | "false";
  parseStatus?: string;
}
const iso = (value: unknown): string | null =>
  value == null ? null : new Date(String(value).replace(" ", "T") + "Z").toISOString();
function record(row: RowDataPacket): AccessLogRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    ordinal: Number(row.ordinal),
    occurredAt: iso(row.occurred_at),
    method: row.method,
    pathname: row.pathname,
    status: row.status,
    bytes: row.bytes == null ? null : Number(row.bytes),
    ipPrefix: row.ip_prefix,
    deviceType: row.device_type,
    operatingSystem: row.operating_system,
    browser: row.browser,
    resourceKind: row.resource_kind,
    isBot: Boolean(row.is_bot),
    referrer: row.referrer,
    parseStatus: row.parse_status,
    errorCode: row.error_code,
  };
}
const literalLike = (value: string) => "%" + value.replace(/[!%_]/g, (char) => "!" + char) + "%";
function where(filters: AccessLogFilters): { sql: string; values: (string | number)[] } {
  const parts: string[] = [],
    values: (string | number)[] = [];
  const add = (sql: string, value: string | number) => {
    parts.push(sql);
    values.push(value);
  };
  if (filters.search) {
    const needle = literalLike(filters.search);
    parts.push("(pathname LIKE ? ESCAPE '!' OR ip_prefix LIKE ? ESCAPE '!')");
    values.push(needle, needle);
  }
  if (filters.from) add("occurred_at >= ?", filters.from + " 00:00:00.000");
  if (filters.to) add("occurred_at < DATE_ADD(?, INTERVAL 1 DAY)", filters.to + " 00:00:00.000");
  for (const [key, column] of [
    ["ipPrefix", "ip_prefix"],
    ["pathname", "pathname"],
    ["status", "status"],
    ["resourceKind", "resource_kind"],
    ["parseStatus", "parse_status"],
  ] as const) {
    const value = filters[key];
    if (value !== undefined) add(column + " = ?", value);
  }
  if (filters.isBot !== undefined) add("is_bot = ?", filters.isBot === "true" ? 1 : 0);
  return { sql: parts.length ? " WHERE " + parts.join(" AND ") : "", values };
}
export function createAccessLogReadService(
  pool: Pool,
  clock: Clock,
  scope: "current" | "archive" = "archive",
) {
  const from =
    scope === "current"
      ? "access_log_current_records r JOIN access_log_current_sources s ON r.source_id=s.id AND r.snapshot_id=s.active_snapshot_id"
      : "access_log_records r";
  return {
    async list(filters: AccessLogFilters) {
      const query = where(filters);
      // A shared snapshot keeps total and rows consistent with a concurrent import.
      const connection = await pool.getConnection();
      try {
        await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
        await connection.beginTransaction();
        const [[count]] = await connection.query<RowDataPacket[]>(
          "SELECT COUNT(*) n FROM " + from + query.sql,
          query.values,
        );
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT r.* FROM " +
            from +
            query.sql +
            " ORDER BY r.occurred_at DESC,r.id DESC LIMIT ? OFFSET ?",
          [...query.values, filters.pageSize, (filters.page - 1) * filters.pageSize],
        );
        await connection.commit();
        return {
          items: rows.map(record),
          total: Number(count.n),
          page: filters.page,
          pageSize: filters.pageSize,
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async get(id: string) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT r.* FROM " + from + " WHERE r.id=?",
        [id],
      );
      if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy bản ghi");
      return record(rows[0]);
    },
    async status(): Promise<AccessLogStatus> {
      if (scope === "current") return readCurrentAccessLogStatus(pool, clock);
      const [[summary]] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total,SUM(parse_status='error') parse_errors,MIN(occurred_at) earliest,MAX(occurred_at) latest FROM access_log_records",
      );
      const [runs] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM access_log_import_runs ORDER BY finished_at DESC,id DESC LIMIT 1",
      );
      const [successes] = await pool.query<RowDataPacket[]>(
        "SELECT finished_at FROM access_log_import_runs WHERE state='complete' ORDER BY finished_at DESC,id DESC LIMIT 1",
      );
      const [sources] = await pool.query<RowDataPacket[]>(
        "SELECT basename,transport,state,error_code,record_count,blank_count,source_through,last_seen_at FROM access_log_sources ORDER BY basename",
      );
      const last = runs[0];
      const finished = iso(last?.finished_at);
      const state =
        sources.some((row) => ["error", "diverged"].includes(row.state)) || last?.state === "error"
          ? "error"
          : sources.some((row) => row.state === "pending") || last?.state === "pending"
            ? "pending"
            : last
              ? "complete"
              : "never";
      return {
        scope: "archive",
        state,
        total: Number(summary.total),
        parseErrors: Number(summary.parse_errors ?? 0),
        earliest: iso(summary.earliest),
        latest: iso(summary.latest),
        lastSyncAt: finished,
        lastSuccessAt: iso(successes[0]?.finished_at),
        sourceThrough: iso(last?.source_through),
        stale: !finished || +clock.now() - Date.parse(finished) > 45 * 60000,
        lastRun: last
          ? {
              state: last.state,
              inserted: Number(last.inserted),
              parseErrors: Number(last.parse_errors),
              pendingSources: Number(last.pending_sources),
              divergedSources: Number(last.diverged_sources),
              missingSources: Number(last.missing_sources),
            }
          : null,
        ipTrusted: false,
        timezone: "UTC",
        sources: sources.map((row) => ({
          basename: row.basename,
          transport: row.transport,
          state: row.state,
          errorCode: row.error_code,
          recordCount: Number(row.record_count),
          blankCount: Number(row.blank_count),
          sourceThrough: iso(row.source_through),
          lastSeenAt: iso(row.last_seen_at),
        })),
      };
    },
  };
}
export async function requireAccessLogSchema(pool: Pool, directory: string): Promise<void> {
  const schema = await readAccessLogSchema(pool, directory);
  if (schema.state !== "complete")
    throw new ApiError(503, "ACCESS_LOGS_NOT_READY", "Nhật ký cPanel chưa sẵn sàng");
}
