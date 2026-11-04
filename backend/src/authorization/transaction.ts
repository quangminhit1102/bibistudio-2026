import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import { resolvePrincipal, sqlDate, type UserRow } from "../auth/repository";
import { ApiError } from "../http/errors";
import { assertPermission } from "./permissions";

/** Serialize RBAC writes before determining the affected users. Login/reads remain concurrent. */
export async function withRbacWrite<T>(
  pool: Pool,
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-rbac:',LEFT(SHA2(DATABASE(),256),32)),10) acquired",
    );
    if (lock.acquired !== 1) throw new ApiError(503, "WRITE_BUSY", "Vui lòng thử lại sau");
    locked = true;
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    try {
      if (locked)
        await connection.query(
          "SELECT RELEASE_LOCK(CONCAT('bibi-rbac:',LEFT(SHA2(DATABASE(),256),32)))",
        );
    } finally {
      connection.release();
    }
  }
}

export async function lockAuthorizedUsers(
  connection: PoolConnection,
  actor: AuthPrincipal,
  code: string | undefined,
  clock: Clock,
  ids: string[] = [],
) {
  const users = new Map<string, UserRow>();
  for (const id of [...new Set([actor.principal.id, ...ids])].sort()) {
    const [rows] = await connection.execute<UserRow[]>(
      "SELECT * FROM users WHERE id=? FOR UPDATE",
      [id],
    );
    if (rows[0]) users.set(id, rows[0]);
  }
  const current = users.get(actor.principal.id);
  if (
    !current ||
    !current.active ||
    current.deleted_at ||
    current.auth_version !== actor.authVersion
  )
    throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
  const [[session]] = await connection.execute<RowDataPacket[]>(
    "SELECT * FROM refresh_token_sessions WHERE id=? AND user_id=? FOR UPDATE",
    [actor.sid, current.id],
  );
  if (
    !session ||
    session.revoked_at ||
    session.auth_version !== current.auth_version ||
    +sqlDate(session.idle_expires_at) <= +clock.now() ||
    +sqlDate(session.absolute_expires_at) <= +clock.now()
  )
    throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
  const principal = await resolvePrincipal(connection, current);
  if (code) assertPermission(principal, code);
  return { users, principal };
}
