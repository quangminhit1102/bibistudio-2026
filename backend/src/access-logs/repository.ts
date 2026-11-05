import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AccessLogCheckpoint, AccessLogRecord } from "./types";

const safe = (value: unknown): number => {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Unsafe access log checkpoint");
  return result;
};
function checkpoint(row: RowDataPacket): AccessLogCheckpoint {
  return {
    sourceId: row.id,
    basename: row.basename,
    transport: row.transport,
    committedBytes: safe(row.committed_bytes),
    committedLines: safe(row.committed_lines),
    recordCount: safe(row.record_count),
    blankCount: safe(row.blank_count),
    prefixSha256: row.prefix_sha256,
  };
}
export async function getOrCreateSource(
  pool: Pool | PoolConnection,
  basename: string,
  transport: "http" | "https",
): Promise<AccessLogCheckpoint> {
  if (!basename || basename.length > 255 || !["http", "https"].includes(transport))
    throw new Error("Invalid access log source");
  await pool.execute(
    "INSERT INTO access_log_sources(id,basename,transport,prefix_sha256) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id=id",
    [randomUUID(), basename, transport, createHash("sha256").digest("hex")],
  );
  const [[row]] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM access_log_sources WHERE basename=?",
    [basename],
  );
  if (row.transport !== transport) throw new Error("Access log source transport mismatch");
  return checkpoint(row);
}
/** Caller owns the transaction, including the row lock and checkpoint advance. */
export async function commitAccessLogBatch(
  connection: PoolConnection,
  expected: AccessLogCheckpoint,
  next: AccessLogCheckpoint,
  records: AccessLogRecord[],
): Promise<void> {
  for (const field of ["committedBytes", "committedLines", "recordCount", "blankCount"] as const)
    if (safe(next[field]) < safe(expected[field]))
      throw new Error("Invalid access log checkpoint regression");
  if (
    next.sourceId !== expected.sourceId ||
    next.basename !== expected.basename ||
    next.transport !== expected.transport ||
    next.committedLines <= expected.committedLines ||
    next.committedBytes <= expected.committedBytes ||
    next.recordCount + next.blankCount !== next.committedLines ||
    next.recordCount - expected.recordCount !== records.length ||
    !/^[a-f0-9]{64}$/.test(next.prefixSha256) ||
    records.length > 500
  )
    throw new Error("Invalid access log checkpoint advance");
  let lastOrdinal = expected.committedLines;
  for (const record of records) {
    if (
      record.sourceId !== expected.sourceId ||
      !Number.isSafeInteger(record.ordinal) ||
      record.ordinal <= lastOrdinal ||
      record.ordinal > next.committedLines
    )
      throw new Error("Invalid access log record position");
    lastOrdinal = record.ordinal;
  }
  const [[row]] = await connection.execute<RowDataPacket[]>(
    "SELECT * FROM access_log_sources WHERE id=? FOR UPDATE",
    [expected.sourceId],
  );
  if (!row) throw new Error("Stale access log checkpoint");
  const actual = checkpoint(row);
  if (
    (Object.keys(actual) as (keyof AccessLogCheckpoint)[]).some(
      (key) => actual[key] !== expected[key],
    )
  )
    throw new Error("Stale access log checkpoint");
  if (records.length) {
    await connection.execute(
      "INSERT INTO access_log_records(id,source_id,ordinal,occurred_at,method,pathname,status,bytes,ip_prefix,device_type,operating_system,browser,resource_kind,is_bot,referrer,parse_status,error_code) VALUES " +
        records.map(() => "(" + Array(17).fill("?").join(",") + ")").join(","),
      records.flatMap((r) => [
        r.id,
        r.sourceId,
        r.ordinal,
        r.occurredAt ? new Date(r.occurredAt) : null,
        r.method,
        r.pathname,
        r.status,
        r.bytes,
        r.ipPrefix,
        r.deviceType,
        r.operatingSystem,
        r.browser,
        r.resourceKind,
        r.isBot,
        r.referrer,
        r.parseStatus,
        r.errorCode,
      ]),
    );
  }
  const times = records.flatMap((r) => (r.occurredAt ? [r.occurredAt] : [])).sort();
  const through = times.length ? new Date(times.at(-1)!) : null;
  await connection.execute(
    "UPDATE access_log_sources SET committed_bytes=?,committed_lines=?,record_count=?,blank_count=?,prefix_sha256=?,source_through=CASE WHEN ? IS NULL THEN source_through WHEN source_through IS NULL OR source_through<? THEN ? ELSE source_through END,updated_at=UTC_TIMESTAMP(3) WHERE id=?",
    [
      next.committedBytes,
      next.committedLines,
      next.recordCount,
      next.blankCount,
      next.prefixSha256,
      through,
      through,
      through,
      expected.sourceId,
    ],
  );
}
