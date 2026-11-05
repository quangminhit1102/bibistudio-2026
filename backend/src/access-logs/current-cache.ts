import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { Clock } from "../config";
import type { AccessLogConfig, AccessLogRecord, CurrentSnapshot } from "./types";
import { AccessLogFailure } from "./sources";
import {
  captureCurrentLog,
  currentBasename,
  queuedCurrentSnapshots,
  removeCurrentSnapshot,
  assertCombinedWorkBudget,
} from "./current-snapshot";
import { parseAccessLogLine } from "./parse";

async function source(
  connection: PoolConnection,
  config: AccessLogConfig,
  transport: "http" | "https",
): Promise<RowDataPacket> {
  await connection.execute(
    "INSERT INTO access_log_current_sources(id,transport,basename) VALUES(?,?,?) ON DUPLICATE KEY UPDATE id=id",
    [randomUUID(), transport, currentBasename(config, transport)],
  );
  const [[row]] = await connection.execute<RowDataPacket[]>(
    "SELECT * FROM access_log_current_sources WHERE transport=?",
    [transport],
  );
  return row;
}
async function writeBatch(
  connection: PoolConnection,
  snapshot: CurrentSnapshot,
  sourceId: string,
  rows: AccessLogRecord[],
): Promise<void> {
  if (!rows.length) return;
  await connection.query(
    "INSERT INTO access_log_current_records(id,source_id,snapshot_id,ordinal,occurred_at,method,pathname,status,bytes,ip_prefix,device_type,operating_system,browser,resource_kind,is_bot,referrer,parse_status,error_code) VALUES " +
      rows.map(() => "(" + Array(18).fill("?").join(",") + ")").join(",") +
      " ON DUPLICATE KEY UPDATE id=id",
    rows.flatMap((r) => [
      r.id,
      sourceId,
      snapshot.id,
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
async function consumeSnapshot(
  connection: PoolConnection,
  snapshot: CurrentSnapshot,
  config: AccessLogConfig,
  signal: AbortSignal,
  onBatch?: () => unknown,
): Promise<{ records: number; errors: number; blanks: number; through: string | null }> {
  const state = await source(connection, config, snapshot.transport),
    unchanged = state.content_sha256 === snapshot.sha256 && state.active_snapshot_id;
  const info = await lstat(snapshot.path);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== snapshot.bytes)
    throw new AccessLogFailure("CURRENT_SNAPSHOT_INVALID");
  const hash = createHash("sha256");
  let bytes = 0,
    ordinal = 0,
    length = 0,
    oversized = false,
    records = 0,
    errors = 0,
    blanks = 0,
    through: string | null = null;
  let pieces: Buffer[] = [],
    batch: AccessLogRecord[] = [];
  const flush = async () => {
    if (!unchanged && batch.length) {
      await writeBatch(connection, snapshot, state.id, batch);
      await onBatch?.();
      signal.throwIfAborted();
    }
    batch = [];
  };
  const line = async () => {
    const row = parseAccessLogLine(
      oversized ? Buffer.alloc(65537) : Buffer.concat(pieces, length),
      snapshot.id,
      ++ordinal,
    );
    if (row) {
      records++;
      if (row.parseStatus === "error") errors++;
      if (row.occurredAt && (!through || row.occurredAt > through)) through = row.occurredAt;
      batch.push(row);
    } else blanks++;
    pieces = [];
    length = 0;
    oversized = false;
    if (batch.length >= config.limits.batchRows) await flush();
  };
  for await (const chunk of createReadStream(snapshot.path, { signal })) {
    signal.throwIfAborted();
    bytes += chunk.length;
    if (bytes > snapshot.bytes) throw new AccessLogFailure("CURRENT_SNAPSHOT_INVALID");
    hash.update(chunk);
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start),
        end = newline < 0 ? chunk.length : newline,
        segment = chunk.subarray(start, end);
      length += segment.length;
      if (length > config.limits.lineBytes) {
        oversized = true;
        pieces = [];
      } else if (!oversized) pieces.push(segment);
      start = newline < 0 ? chunk.length : newline + 1;
      if (newline >= 0) await line();
    }
  }
  if (length || oversized) await line();
  await flush();
  signal.throwIfAborted();
  if (bytes !== snapshot.bytes || hash.digest("hex") !== snapshot.sha256)
    throw new AccessLogFailure("CURRENT_SNAPSHOT_INVALID");
  if (!unchanged) {
    const [[count]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) n FROM access_log_current_records WHERE source_id=? AND snapshot_id=?",
      [state.id, snapshot.id],
    );
    if (Number(count.n) !== records) throw new AccessLogFailure("CURRENT_COUNT_MISMATCH");
    await connection.beginTransaction();
    try {
      const [[locked]] = await connection.query<RowDataPacket[]>(
        "SELECT active_captured_at FROM access_log_current_sources WHERE id=? FOR UPDATE",
        [state.id],
      );
      if (
        locked.active_captured_at &&
        new Date(String(locked.active_captured_at).replace(" ", "T") + "Z") >
          new Date(snapshot.capturedAt)
      )
        throw new AccessLogFailure("CURRENT_SNAPSHOT_ORDER");
      await connection.execute(
        "UPDATE access_log_current_sources SET active_snapshot_id=?,active_captured_at=?,content_sha256=?,record_count=?,parse_errors=?,blank_count=?,source_bytes=?,source_modified_at=?,source_through=?,state='complete',error_code=NULL WHERE id=?",
        [
          snapshot.id,
          new Date(snapshot.capturedAt),
          snapshot.sha256,
          records,
          errors,
          blanks,
          bytes,
          new Date(snapshot.sourceModifiedAt),
          through ? new Date(through) : null,
          state.id,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } else
    await connection.execute(
      "UPDATE access_log_current_sources SET source_modified_at=?,state='complete',error_code=NULL WHERE id=?",
      [new Date(snapshot.sourceModifiedAt), state.id],
    );
  // Derived cache only: the archive history tables are never deleted here.
  while (true) {
    signal.throwIfAborted();
    const [deleted] = await connection.execute<ResultSetHeader>(
      "DELETE FROM access_log_current_records WHERE source_id=? AND snapshot_id<>(SELECT active_snapshot_id FROM access_log_current_sources WHERE id=?) LIMIT 500",
      [state.id, state.id],
    );
    if (deleted.affectedRows === 0) break;
  }
  return { records, errors, blanks, through };
}
export async function syncCurrentLogs(options: {
  pool: Pool;
  config: AccessLogConfig;
  clock: Clock;
  signal: AbortSignal;
  onBatch?: () => unknown;
  connection?: PoolConnection;
}) {
  const { pool, config, clock } = options,
    signal = AbortSignal.any([options.signal, AbortSignal.timeout(config.limits.runMs)]);
  const receipt = {
    state: "complete" as "complete" | "pending" | "error",
    records: 0,
    parseErrors: 0,
    failedSources: 0,
    finishedAt: clock.now().toISOString(),
  };
  const connection = options.connection ?? (await pool.getConnection());
  let locked = false;
  const failures = new Map<"http" | "https", string>();
  try {
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-current-sync:',LEFT(SHA2(DATABASE(),256),32)),0) acquired",
    );
    if (lock.acquired !== 1) return { ...receipt, state: "pending" as const };
    locked = true;
    for (const transport of ["http", "https"] as const) {
      await source(connection, config, transport);
      try {
        await captureCurrentLog(config, transport, signal);
      } catch (error) {
        failures.set(
          transport,
          signal.aborted
            ? "INTERRUPTED"
            : error instanceof AccessLogFailure
              ? error.code
              : "CURRENT_SOURCE_UNAVAILABLE",
        );
      }
    }
    for (const snapshot of await queuedCurrentSnapshots(config)) {
      if (signal.aborted) {
        failures.set(snapshot.transport, "INTERRUPTED");
        continue;
      }
      try {
        await consumeSnapshot(connection, snapshot, config, signal, options.onBatch);
        await connection.execute(
          "UPDATE access_log_current_sources SET last_success_at=? WHERE transport=?",
          [clock.now(), snapshot.transport],
        );
        await removeCurrentSnapshot(snapshot, config);
      } catch (error) {
        failures.set(
          snapshot.transport,
          signal.aborted
            ? "INTERRUPTED"
            : error instanceof AccessLogFailure
              ? error.code
              : "CURRENT_IMPORT_FAILED",
        );
      }
    }
    await assertCombinedWorkBudget(config);
    for (const transport of ["http", "https"] as const) {
      const code = failures.get(transport);
      await connection.execute(
        "UPDATE access_log_current_sources SET last_checked_at=?,state=?,error_code=? WHERE transport=?",
        [
          clock.now(),
          code
            ? code === "INTERRUPTED" || code === "SOURCE_CHANGED"
              ? "pending"
              : "error"
            : "complete",
          code ?? null,
          transport,
        ],
      );
    }
    const [[total]] = await connection.query<RowDataPacket[]>(
      "SELECT SUM(record_count) records,SUM(parse_errors) errors FROM access_log_current_sources",
    );
    receipt.records = Number(total.records ?? 0);
    receipt.parseErrors = Number(total.errors ?? 0);
    receipt.failedSources = failures.size;
    receipt.state = failures.size
      ? signal.aborted || [...failures.values()].every((code) => code === "SOURCE_CHANGED")
        ? "pending"
        : "error"
      : "complete";
    return receipt;
  } catch (error) {
    const code = signal.aborted
      ? "INTERRUPTED"
      : error instanceof AccessLogFailure
        ? error.code
        : "CURRENT_IMPORT_FAILED";
    receipt.state = signal.aborted ? "pending" : "error";
    receipt.failedSources = 2;
    await connection.execute(
      "UPDATE access_log_current_sources SET last_checked_at=?,state=?,error_code=?",
      [clock.now(), receipt.state, code],
    );
    const [[total]] = await connection.query<RowDataPacket[]>(
      "SELECT SUM(record_count) records,SUM(parse_errors) errors FROM access_log_current_sources",
    );
    receipt.records = Number(total.records ?? 0);
    receipt.parseErrors = Number(total.errors ?? 0);
    return receipt;
  } finally {
    try {
      if (locked)
        await connection.query(
          "SELECT RELEASE_LOCK(CONCAT('bibi-current-sync:',LEFT(SHA2(DATABASE(),256),32)))",
        );
    } finally {
      if (!options.connection) connection.release();
    }
  }
}
