import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AccessLogStatus } from "./types";
const iso = (value: unknown): string | null =>
  value == null ? null : new Date(String(value).replace(" ", "T") + "Z").toISOString();
export async function readCurrentAccessLogStatus(
  pool: Pool,
  clock: Clock,
): Promise<AccessLogStatus> {
  const [sources] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM access_log_current_sources ORDER BY transport",
  );
  const [[summary]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) total,SUM(r.parse_status='error') errors,MIN(r.occurred_at) earliest,MAX(r.occurred_at) latest FROM access_log_current_records r JOIN access_log_current_sources s ON r.source_id=s.id AND r.snapshot_id=s.active_snapshot_id",
  );
  const min = (column: string) =>
    sources.length === 2 && sources.every((row) => row[column] != null)
      ? iso(sources.map((row) => row[column]).sort()[0])
      : null;
  const max = (column: string) =>
    iso(
      sources
        .map((row) => row[column])
        .filter(Boolean)
        .sort()
        .at(-1),
    );
  const lastSyncAt = min("last_checked_at");
  return {
    scope: "current",
    state: sources.some((row) => row.state === "error")
      ? "error"
      : sources.some((row) => row.state === "pending")
        ? "pending"
        : sources.length === 2
          ? "complete"
          : "never",
    total: Number(summary.total),
    parseErrors: Number(summary.errors ?? 0),
    earliest: iso(summary.earliest),
    latest: iso(summary.latest),
    lastSyncAt,
    lastSuccessAt: min("last_success_at"),
    sourceThrough: max("source_through"),
    sourceModifiedAt: max("source_modified_at"),
    stale: !lastSyncAt || +clock.now() - Date.parse(lastSyncAt) > 45 * 60000,
    ipTrusted: false,
    timezone: "UTC",
    lastRun: null,
    sources: sources.map((row) => ({
      basename: row.basename,
      transport: row.transport,
      state: row.state,
      errorCode: row.error_code,
      recordCount: Number(row.record_count),
      blankCount: Number(row.blank_count),
      sourceThrough: iso(row.source_through),
      lastSeenAt: iso(row.last_checked_at),
      sourceModifiedAt: iso(row.source_modified_at),
    })),
  };
}
