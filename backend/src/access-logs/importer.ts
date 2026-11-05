import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import { sqlDate } from "../auth/repository";
import { AccessLogFailure, assertAccessLogConfig, discoverAccessLogArchives } from "./sources";
import {
  snapshotArchive,
  queuedSnapshots,
  inspectArchive,
  streamArchive,
  removeSnapshot,
  type QueuedSnapshot,
} from "./snapshot";
import { getOrCreateSource, commitAccessLogBatch } from "./repository";
import { parseAccessLogLine } from "./parse";
import type {
  AccessLogConfig,
  AccessLogSyncReceipt,
  AccessLogRecord,
  AccessLogCheckpoint,
} from "./types";

async function importSnapshot(
  connection: PoolConnection,
  snapshot: QueuedSnapshot,
  config: AccessLogConfig,
  signal: AbortSignal,
  receipt: AccessLogSyncReceipt,
): Promise<boolean> {
  let point = await getOrCreateSource(connection, snapshot.basename, snapshot.transport);
  const verified = await inspectArchive(snapshot, config, signal, point.committedBytes);
  if (verified.prefixBytes !== point.committedBytes || verified.prefixSha256 !== point.prefixSha256)
    throw new AccessLogFailure("SOURCE_DIVERGED");
  const hash = createHash("sha256");
  let bytes = 0,
    lines = 0,
    records = point.recordCount,
    blanks = point.blankCount;
  let lastCompleteBytes = point.committedBytes,
    lastHash = point.prefixSha256;
  let pieces: Buffer[] = [],
    length = 0,
    oversized = false;
  let batch: AccessLogRecord[] = [];
  const flush = async () => {
    if (lastCompleteBytes === point.committedBytes) return;
    const next: AccessLogCheckpoint = {
      ...point,
      committedBytes: lastCompleteBytes,
      committedLines: lines,
      recordCount: records,
      blankCount: blanks,
      prefixSha256: lastHash,
    };
    await connection.beginTransaction();
    try {
      await commitAccessLogBatch(connection, point, next, batch);
      await connection.execute(
        "UPDATE access_log_sources SET snapshot_sha256=?,state='pending',error_code=NULL WHERE id=?",
        [snapshot.compressedSha256, point.sourceId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    receipt.inserted += batch.length;
    receipt.parseErrors += batch.filter((row) => row.parseStatus === "error").length;
    batch = [];
    point = next;
  };
  await streamArchive(snapshot, config, signal, async (chunk) => {
    let start = 0;
    while (start < chunk.length) {
      signal.throwIfAborted();
      const newline = chunk.indexOf(10, start),
        end = newline < 0 ? chunk.length : newline + 1;
      const segment = chunk.subarray(start, end);
      hash.update(segment);
      bytes += segment.length;
      if (bytes > point.committedBytes) {
        const content = newline < 0 ? segment : segment.subarray(0, segment.length - 1);
        length += content.length;
        if (length > config.limits.lineBytes) {
          oversized = true;
          pieces = [];
        } else if (!oversized) pieces.push(content);
      }
      start = end;
      if (newline < 0) continue;
      lines++;
      if (bytes <= point.committedBytes) continue;
      const row = parseAccessLogLine(
        oversized ? Buffer.alloc(65537) : Buffer.concat(pieces, length),
        point.sourceId,
        lines,
      );
      if (row) {
        batch.push(row);
        records++;
      } else blanks++;
      pieces = [];
      length = 0;
      oversized = false;
      lastCompleteBytes = bytes;
      lastHash = hash.copy().digest("hex");
      if (lines - point.committedLines >= config.limits.batchRows) await flush();
    }
  });
  await flush();
  const complete = verified.completeBytes === verified.bytes;
  await connection.execute(
    "UPDATE access_log_sources SET state=?,error_code=NULL,snapshot_sha256=?,last_seen_at=UTC_TIMESTAMP(3) WHERE id=?",
    [complete ? "complete" : "pending", snapshot.compressedSha256, point.sourceId],
  );
  return complete;
}

/** Owns one connection (and advisory lock), including all batch transactions: pool1 cannot deadlock itself. */
export async function syncAccessLogArchives(options: {
  pool: Pool;
  config: AccessLogConfig;
  clock: Clock;
  signal: AbortSignal;
  connection?: PoolConnection;
}): Promise<AccessLogSyncReceipt> {
  const { pool, config, clock } = options;
  assertAccessLogConfig(config);
  const deadline = AbortSignal.timeout(config.limits.runMs);
  const signal = AbortSignal.any([options.signal, deadline]);
  const receipt: AccessLogSyncReceipt = {
    state: "complete",
    inserted: 0,
    parseErrors: 0,
    pendingSources: 0,
    divergedSources: 0,
    missingSources: 0,
    sourceThrough: null,
    startedAt: clock.now().toISOString(),
    finishedAt: clock.now().toISOString(),
  };
  const pending = new Set<string>(),
    diverged = new Set<string>(),
    failed = new Set<string>();
  const connection = options.connection ?? (await pool.getConnection());
  let locked = false;
  const failure = async (basename: string, transport: "http" | "https", error: unknown) => {
    const point = await getOrCreateSource(connection, basename, transport);
    const aborted = signal.aborted;
    const code = aborted
      ? "INTERRUPTED"
      : error instanceof AccessLogFailure
        ? error.code
        : "ARCHIVE_INVALID";
    if (code === "SOURCE_DIVERGED") diverged.add(basename);
    else if (aborted || code === "SOURCE_CHANGED") pending.add(basename);
    else failed.add(basename);
    await connection.execute("UPDATE access_log_sources SET state=?,error_code=? WHERE id=?", [
      code === "SOURCE_DIVERGED" ? "diverged" : aborted ? "pending" : "error",
      code,
      point.sourceId,
    ]);
  };
  try {
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-access-sync:',LEFT(SHA2(DATABASE(),256),32)),0) acquired",
    );
    if (lock.acquired !== 1) {
      receipt.state = "pending";
      return receipt;
    }
    locked = true;
    let sourceFailure = false;
    try {
      for (const source of await discoverAccessLogArchives(config)) {
        if (signal.aborted) {
          pending.add(source.basename);
          continue;
        }
        try {
          await snapshotArchive(source, config, signal);
        } catch (error) {
          await failure(source.basename, source.transport, error);
        }
      }
    } catch {
      sourceFailure = true;
      receipt.state = "error";
    }
    const queued = await queuedSnapshots(config);
    const groups = new Map<string, QueuedSnapshot[]>();
    for (const entry of queued)
      groups.set(entry.basename, [...(groups.get(entry.basename) ?? []), entry]);
    for (const [basename, list] of groups) {
      if (signal.aborted) {
        pending.add(basename);
        continue;
      }
      const survivors: {
        snapshot: QueuedSnapshot;
        bytes: number;
        sha256: string;
        completeBytes: number;
      }[] = [];
      for (const snapshot of list) {
        try {
          const info = await inspectArchive(snapshot, config, signal);
          for (let i = survivors.length - 1; i >= 0; i--) {
            const prior = survivors[i];
            if (info.bytes < prior.bytes) {
              if (prior.completeBytes < prior.bytes) throw new AccessLogFailure("SOURCE_DIVERGED");
              continue;
            }
            const prefix =
              info.bytes === prior.bytes
                ? info.sha256
                : (await inspectArchive(snapshot, config, signal, prior.bytes)).prefixSha256;
            if (prefix === prior.sha256) {
              // The newer durable snapshot retains every byte, including a previously partial tail.
              await removeSnapshot(prior.snapshot, config);
              survivors.splice(i, 1);
            } else if (prior.completeBytes < prior.bytes)
              throw new AccessLogFailure("SOURCE_DIVERGED");
          }
          survivors.push({
            snapshot,
            bytes: info.bytes,
            sha256: info.sha256,
            completeBytes: info.completeBytes,
          });
        } catch (error) {
          await failure(snapshot.basename, snapshot.transport, error);
        }
      }
      if (diverged.has(basename)) continue;
      for (const { snapshot } of survivors) {
        try {
          signal.throwIfAborted();
          if (await importSnapshot(connection, snapshot, config, signal, receipt)) {
            await removeSnapshot(snapshot, config);
            pending.delete(basename);
          } else {
            pending.add(basename);
            break;
          }
        } catch (error) {
          await failure(basename, snapshot.transport, error);
          break;
        }
      }
    }
    const [unfinished] = await connection.query<RowDataPacket[]>(
      "SELECT basename FROM access_log_sources WHERE state IN ('pending','error','diverged')",
    );
    const available = new Set((await queuedSnapshots(config)).map((row) => row.basename));
    receipt.missingSources = unfinished.filter(
      (row) =>
        !available.has(row.basename) &&
        !pending.has(row.basename) &&
        !failed.has(row.basename) &&
        !diverged.has(row.basename),
    ).length;
    const [[through]] = await connection.query<RowDataPacket[]>(
      "SELECT MAX(source_through) value FROM access_log_sources",
    );
    receipt.sourceThrough = through.value ? sqlDate(through.value).toISOString() : null;
    receipt.pendingSources = pending.size;
    receipt.divergedSources = diverged.size;
    receipt.state =
      sourceFailure || failed.size || diverged.size || receipt.missingSources
        ? "error"
        : signal.aborted || pending.size
          ? "pending"
          : "complete";
  } catch {
    receipt.state = signal.aborted ? "pending" : "error";
  } finally {
    receipt.finishedAt = clock.now().toISOString();
    try {
      if (locked) {
        await connection.execute(
          "INSERT INTO access_log_import_runs(id,state,inserted,parse_errors,pending_sources,diverged_sources,missing_sources,source_through,started_at,finished_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [
            randomUUID(),
            receipt.state,
            receipt.inserted,
            receipt.parseErrors,
            receipt.pendingSources,
            receipt.divergedSources,
            receipt.missingSources,
            receipt.sourceThrough ? new Date(receipt.sourceThrough) : null,
            new Date(receipt.startedAt),
            new Date(receipt.finishedAt),
          ],
        );
      }
    } catch {
      receipt.state = "error";
    } finally {
      try {
        if (locked)
          await connection.query(
            "SELECT RELEASE_LOCK(CONCAT('bibi-access-sync:',LEFT(SHA2(DATABASE(),256),32)))",
          );
      } finally {
        if (!options.connection) connection.release();
      }
    }
  }
  return receipt;
}
