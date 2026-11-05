import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AccessLogConfig, AccessLogSyncReceipt } from "./types";
import { syncAccessLogArchives } from "./importer";
import { syncCurrentLogs } from "./current-cache";
import { currentSnapshotWorkUsage } from "./current-snapshot";
import { AccessLogFailure } from "./sources";
/** One owned connection and job lock span both datasets; no extra runtime DB pool. */
export async function syncAccessLogs(options: {
  pool: Pool;
  config: AccessLogConfig;
  clock: Clock;
  signal: AbortSignal;
}) {
  const { pool, config, clock } = options,
    signal = AbortSignal.any([options.signal, AbortSignal.timeout(config.limits.runMs)]);
  const connection = await pool.getConnection();
  let locked = false;
  const fallback: AccessLogSyncReceipt = {
    state: "pending",
    inserted: 0,
    parseErrors: 0,
    pendingSources: 0,
    divergedSources: 0,
    missingSources: 0,
    sourceThrough: null,
    startedAt: clock.now().toISOString(),
    finishedAt: clock.now().toISOString(),
  };
  try {
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-log-job:',LEFT(SHA2(DATABASE(),256),32)),0) acquired",
    );
    if (lock.acquired !== 1) return fallback;
    locked = true;
    let archive: AccessLogSyncReceipt;
    try {
      const reserved = config.currentDirectory ? await currentSnapshotWorkUsage(config) : 0;
      const remaining = config.limits.workBytes - reserved;
      if (remaining < 1) throw new AccessLogFailure("SNAPSHOT_LIMIT_OR_QUOTA");
      archive = await syncAccessLogArchives({
        ...options,
        connection,
        signal,
        config: { ...config, limits: { ...config.limits, workBytes: remaining } },
      });
    } catch {
      archive = { ...fallback, state: signal.aborted ? "pending" : "error" };
    }
    const current = config.currentDirectory
      ? await syncCurrentLogs({ ...options, connection, signal })
      : undefined;
    const states = [archive.state, ...(current ? [current.state] : [])];
    const state = states.includes("error")
      ? "error"
      : states.includes("pending")
        ? "pending"
        : "complete";
    return {
      ...archive,
      state: state as "complete" | "pending" | "error",
      finishedAt: clock.now().toISOString(),
      ...(current ? { current } : {}),
    };
  } finally {
    try {
      if (locked)
        await connection.query(
          "SELECT RELEASE_LOCK(CONCAT('bibi-log-job:',LEFT(SHA2(DATABASE(),256),32)))",
        );
    } finally {
      connection.release();
    }
  }
}
