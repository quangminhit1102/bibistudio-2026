import type { Pool, RowDataPacket } from "mysql2/promise";
import { sqlDate } from "./repository";
import { withTransaction } from "../db/transaction";

/** Keep all family hashes through absolute expiry, including spent/revoked hashes. */
export async function cleanupAuthSessions(pool: Pool, now: Date, limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isFinite(+now))
    throw new Error("Invalid auth cleanup batch");
  const [candidates] = await pool.query<RowDataPacket[]>(
    "SELECT id,user_id FROM refresh_token_sessions WHERE absolute_expires_at<=? ORDER BY absolute_expires_at,id LIMIT ?",
    [now, limit],
  );
  let sessions = 0,
    tokens = 0;
  for (const candidate of candidates) {
    const remaining = limit - tokens;
    if (remaining <= 0) break;
    const removed = await withTransaction(pool, async (connection) => {
      // Same lock order as refresh/account writes: user -> family -> hashes.
      await connection.execute("SELECT id FROM users WHERE id=? FOR UPDATE", [candidate.user_id]);
      const [[session]] = await connection.execute<RowDataPacket[]>(
        "SELECT absolute_expires_at FROM refresh_token_sessions WHERE id=? AND user_id=? FOR UPDATE",
        [candidate.id, candidate.user_id],
      );
      if (!session || +sqlDate(session.absolute_expires_at) > +now)
        return { sessions: 0, tokens: 0 };
      const [hashes] = await connection.query<RowDataPacket[]>(
        "SELECT token_hash FROM refresh_tokens WHERE session_id=? ORDER BY token_hash LIMIT ? FOR UPDATE",
        [candidate.id, remaining],
      );
      if (hashes.length)
        await connection.execute(
          `DELETE FROM refresh_tokens WHERE session_id=? AND token_hash IN (${hashes.map(() => "?").join(",")})`,
          [candidate.id, ...hashes.map((row) => row.token_hash)],
        );
      const [left] = await connection.execute<RowDataPacket[]>(
        "SELECT 1 FROM refresh_tokens WHERE session_id=? LIMIT 1",
        [candidate.id],
      );
      if (!left.length)
        await connection.execute("DELETE FROM refresh_token_sessions WHERE id=?", [candidate.id]);
      return { sessions: left.length ? 0 : 1, tokens: hashes.length };
    });
    sessions += removed.sessions;
    tokens += removed.tokens;
  }
  return { sessions, tokens };
}
