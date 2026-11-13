import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../db/transaction";

export interface CleanupCounts {
  sessions: number;
  visitors: number;
  pages: number;
  products: number;
}
/** Only signed release-probe identities expire. Real visitor history has no TTL. */
export async function cleanupAnalytics(
  pool: Pool,
  now: Date,
  batchLimit = 100,
): Promise<CleanupCounts> {
  if (!Number.isInteger(batchLimit) || batchLimit < 1 || batchLimit > 1000)
    throw new Error("Invalid cleanup limit");
  const counts = { sessions: 0, visitors: 0, pages: 0, products: 0 };
  const [candidates] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT v.id FROM visitors v JOIN release_probes p ON p.visitor_id=v.id WHERE v.is_probe=1 AND p.expires_at<? ORDER BY v.id LIMIT ${batchLimit}`,
    [now],
  );
  for (const { id } of candidates) {
    const removed = await withTransaction(pool, async (connection) => {
      const [[visitor]] = await connection.execute<RowDataPacket[]>(
        "SELECT is_probe FROM visitors WHERE id=? FOR UPDATE",
        [id],
      );
      if (!visitor?.is_probe) return { sessions: 0, visitors: 0, pages: 0, products: 0 };
      const [[probe]] = await connection.execute<RowDataPacket[]>(
        "SELECT COUNT(*) n FROM release_probes WHERE visitor_id=? AND expires_at<?",
        [id, now],
      );
      if (!probe.n) return { sessions: 0, visitors: 0, pages: 0, products: 0 };
      const result = { sessions: 0, visitors: 0, pages: 0, products: 0 };
      for (const [key, table] of [
        ["pages", "visitor_session_pages"],
        ["products", "visitor_viewed_products"],
      ] as const) {
        const [deleted] = await connection.execute<ResultSetHeader>(
          `DELETE a FROM ${table} a JOIN visitor_sessions s ON s.id=a.session_id WHERE s.visitor_id=?`,
          [id],
        );
        result[key] = deleted.affectedRows;
      }
      const [sessions] = await connection.execute<ResultSetHeader>(
        "DELETE FROM visitor_sessions WHERE visitor_id=?",
        [id],
      );
      result.sessions = sessions.affectedRows;
      await connection.execute("DELETE FROM release_probes WHERE visitor_id=?", [id]);
      const [visitors] = await connection.execute<ResultSetHeader>(
        "DELETE FROM visitors WHERE id=? AND is_probe=1",
        [id],
      );
      result.visitors = visitors.affectedRows;
      return result;
    });
    for (const key of ["sessions", "visitors", "pages", "products"] as const)
      counts[key] += removed[key];
  }
  await pool.execute(`DELETE FROM rate_limit_counters WHERE expires_at<? LIMIT ${batchLimit}`, [
    now,
  ]);
  return counts;
}
