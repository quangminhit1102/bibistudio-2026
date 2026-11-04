import { createHash } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../db/transaction";

export interface RateDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}
export async function consumeRateLimit(
  pool: Pool,
  key: string,
  policy: { limit: number; windowMs: number },
  now: Date,
): Promise<RateDecision> {
  const bucket = createHash("sha256").update(key).digest("hex");
  return withTransaction(pool, async (connection) => {
    // Upsert acquires an exclusive record lock; INSERT IGNORE would retain shared locks
    // and deadlock when simultaneous callers upgrade them with SELECT FOR UPDATE.
    await connection.execute(
      "INSERT INTO rate_limit_counters(bucket_hash,hits,expires_at) VALUES (?,0,?) ON DUPLICATE KEY UPDATE hits=hits",
      [bucket, now],
    );
    const [[row]] = await connection.execute<RowDataPacket[]>(
      "SELECT hits,expires_at FROM rate_limit_counters WHERE bucket_hash=? FOR UPDATE",
      [bucket],
    );
    const expired = new Date(String(row.expires_at).replace(" ", "T") + "Z").getTime() <= +now;
    const hits = expired ? 1 : Number(row.hits) + 1;
    const expires = expired
      ? new Date(+now + policy.windowMs)
      : new Date(String(row.expires_at).replace(" ", "T") + "Z");
    await connection.execute(
      "UPDATE rate_limit_counters SET hits=?,expires_at=? WHERE bucket_hash=?",
      [hits, expires, bucket],
    );
    return {
      allowed: hits <= policy.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((+expires - +now) / 1000)),
    };
  });
}
