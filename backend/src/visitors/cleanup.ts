import type { Pool, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../db/transaction";
import { sqlDate } from "../auth/repository";
import { ANALYTICS_TTL_MS } from "./normalize";

export interface CleanupCounts {
  sessions: number;
  visitors: number;
  pages: number;
  products: number;
}
/** Bounded maintenance, using the same visitor -> session lock order as ingestion. */
export async function cleanupAnalytics(
  pool: Pool,
  now: Date,
  batchLimit = 100,
): Promise<CleanupCounts> {
  if (!Number.isInteger(batchLimit) || batchLimit < 1 || batchLimit > 1000)
    throw new Error("Invalid cleanup limit");
  const cutoff = new Date(+now - ANALYTICS_TTL_MS);
  const counts = { sessions: 0, visitors: 0, pages: 0, products: 0 };
  const candidates = new Map<string, string>();
  const [expiredProbes] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id,s.visitor_id FROM release_probes p JOIN visitors v ON v.id=p.visitor_id JOIN visitor_sessions s ON s.visitor_id=v.id WHERE v.is_probe=1 AND p.expires_at<? ORDER BY p.expires_at LIMIT ${batchLimit}`,
    [now],
  );
  for (const row of expiredProbes) candidates.set(row.id, row.visitor_id);
  for (const sql of [
    `SELECT id,visitor_id FROM visitor_sessions WHERE last_received_at<? ORDER BY last_received_at,id LIMIT ${batchLimit}`,
    `SELECT s.id,s.visitor_id FROM visitor_session_pages p JOIN visitor_sessions s ON s.id=p.session_id WHERE p.last_received_at<? ORDER BY p.last_received_at LIMIT ${batchLimit}`,
    `SELECT s.id,s.visitor_id FROM visitor_viewed_products p JOIN visitor_sessions s ON s.id=p.session_id WHERE p.last_received_at<? ORDER BY p.last_received_at LIMIT ${batchLimit}`,
  ]) {
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [cutoff]);
    for (const row of rows)
      if (candidates.size < batchLimit) candidates.set(row.id, row.visitor_id);
  }
  for (const [sessionId, visitorId] of candidates) {
    const removed = await withTransaction(pool, async (connection) => {
      await connection.execute("SELECT id FROM visitors WHERE id=? FOR UPDATE", [visitorId]);
      const [[session]] = await connection.execute<RowDataPacket[]>(
        "SELECT last_received_at FROM visitor_sessions WHERE id=? FOR UPDATE",
        [sessionId],
      );
      if (!session) return { pages: 0, products: 0, sessions: 0 };
      const [[probe]] = await connection.execute<RowDataPacket[]>(
        "SELECT COUNT(*) n FROM release_probes p JOIN visitors v ON v.id=p.visitor_id WHERE p.visitor_id=? AND v.is_probe=1 AND p.expires_at<?",
        [visitorId, now],
      );
      const expired = +sqlDate(session.last_received_at) < +cutoff || !!probe.n;
      const result = { pages: 0, products: 0, sessions: 0 };
      for (const [key, table] of [
        ["pages", "visitor_session_pages"],
        ["products", "visitor_viewed_products"],
      ] as const) {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT COUNT(*) n FROM ${table} WHERE session_id=?${expired ? "" : " AND last_received_at<?"}`,
          expired ? [sessionId] : [sessionId, cutoff],
        );
        await connection.execute(
          `DELETE FROM ${table} WHERE session_id=?${expired ? "" : " AND last_received_at<?"} LIMIT 1000`,
          expired ? [sessionId] : [sessionId, cutoff],
        );
        result[key] = Number(rows[0].n);
      }
      if (expired) {
        await connection.execute("DELETE FROM visitor_sessions WHERE id=?", [sessionId]);
        result.sessions = 1;
      } else
        await connection.execute(
          "UPDATE visitor_sessions SET page_count=(SELECT COUNT(*) FROM visitor_session_pages WHERE session_id=?),product_count=(SELECT COUNT(*) FROM visitor_viewed_products WHERE session_id=?) WHERE id=?",
          [sessionId, sessionId, sessionId],
        );
      await connection.execute(
        "UPDATE visitors SET session_count=(SELECT COUNT(*) FROM visitor_sessions WHERE visitor_id=?) WHERE id=?",
        [visitorId, visitorId],
      );
      return result;
    });
    counts.sessions += removed.sessions;
    counts.pages += removed.pages;
    counts.products += removed.products;
  }
  const [orphans] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM visitors WHERE (last_seen_at<? OR (is_probe=1 AND EXISTS(SELECT 1 FROM release_probes WHERE visitor_id=visitors.id AND expires_at<?))) AND NOT EXISTS(SELECT 1 FROM visitor_sessions WHERE visitor_id=visitors.id) ORDER BY last_seen_at,id LIMIT ${batchLimit}`,
    [cutoff, now],
  );
  for (const { id } of orphans) {
    counts.visitors += await withTransaction(pool, async (connection) => {
      const [[visitor]] = await connection.execute<RowDataPacket[]>(
        "SELECT last_seen_at FROM visitors WHERE id=? FOR UPDATE",
        [id],
      );
      if (!visitor) return 0;
      const [[probe]] = await connection.execute<RowDataPacket[]>(
        "SELECT COUNT(*) n FROM release_probes p JOIN visitors v ON v.id=p.visitor_id WHERE p.visitor_id=? AND v.is_probe=1 AND p.expires_at<?",
        [id, now],
      );
      if (+sqlDate(visitor.last_seen_at) >= +cutoff && !probe.n) return 0;
      const [[sessions]] = await connection.execute<RowDataPacket[]>(
        "SELECT COUNT(*) n FROM visitor_sessions WHERE visitor_id=?",
        [id],
      );
      if (sessions.n) return 0;
      await connection.execute("DELETE FROM release_probes WHERE visitor_id=?", [id]);
      await connection.execute("DELETE FROM visitors WHERE id=?", [id]);
      return 1;
    });
  }
  await pool.execute(`DELETE FROM rate_limit_counters WHERE expires_at<? LIMIT ${batchLimit}`, [
    now,
  ]);
  return counts;
}
