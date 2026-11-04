import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AuthConfig, Clock } from "../config";
import type { PrincipalDto } from "../http/contracts";
import { ApiError } from "../http/errors";
import { withTransaction } from "../db/transaction";
import { writeAudit } from "../audit/repository";
import { lockAuthorizedUsers, withRbacWrite } from "../authorization/transaction";
import { hashPassword, verifyPassword } from "./password";
import { hashRefresh, newRefreshToken, signAccess, verifyAccess } from "./tokens";
import { resolvePrincipal, sqlDate, type UserRow, type SessionRow } from "./repository";

const day = 86400000;
export interface AuthPrincipal {
  principal: PrincipalDto;
  sid: string;
  authVersion: number;
}
export interface AuthGrant {
  accessToken: string;
  expiresAt: string;
  profile: PrincipalDto;
  refreshToken: string;
}
const unauthorized = (): ApiError => new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
const loginFailure = (): ApiError =>
  new ApiError(401, "INVALID_CREDENTIALS", "Tên tài khoản hoặc mật khẩu không đúng");
let dummyHash: Promise<string> | undefined;

export function createAuthService({
  pool,
  clock,
  config,
}: {
  pool: Pool;
  clock: Clock;
  config: AuthConfig;
}) {
  if (Buffer.byteLength(config.jwtSecret) < 32 || !config.jwtIssuer || !config.jwtAudience)
    throw new Error("Auth configuration invalid");
  async function lockedUser(connection: PoolConnection, id: string): Promise<UserRow | undefined> {
    const [rows] = await connection.execute<UserRow[]>(
      "SELECT * FROM users WHERE id=? FOR UPDATE",
      [id],
    );
    return rows[0];
  }
  async function grant(
    connection: PoolConnection,
    user: UserRow,
    sid: string,
    now: Date,
  ): Promise<AuthGrant> {
    const refreshToken = newRefreshToken();
    await connection.execute(
      "INSERT INTO refresh_tokens(token_hash,session_id,created_at) VALUES (?,?,?)",
      [hashRefresh(refreshToken), sid, now],
    );
    const profile = await resolvePrincipal(connection, user);
    return {
      accessToken: signAccess({ sub: user.id, sid, authVersion: user.auth_version }, config, clock),
      expiresAt: new Date(Math.floor(+clock.now() / 1000) * 1000 + 900000).toISOString(),
      profile,
      refreshToken,
    };
  }
  async function checkSession(
    connection: PoolConnection,
    user: UserRow | undefined,
    sid: string,
    version?: number,
  ): Promise<SessionRow | undefined> {
    if (
      !user ||
      !user.active ||
      user.deleted_at ||
      (version !== undefined && user.auth_version !== version)
    )
      return undefined;
    const [rows] = await connection.execute<SessionRow[]>(
      "SELECT * FROM refresh_token_sessions WHERE id=? AND user_id=? FOR UPDATE",
      [sid, user.id],
    );
    const session = rows[0];
    const now = clock.now();
    if (
      !session ||
      session.revoked_at ||
      session.auth_version !== user.auth_version ||
      +sqlDate(session.idle_expires_at) <= +now ||
      +sqlDate(session.absolute_expires_at) <= +now
    )
      return undefined;
    return session;
  }
  async function touch(connection: PoolConnection, session: SessionRow): Promise<void> {
    const now = new Date(Math.max(+clock.now(), +sqlDate(session.last_activity_at)));
    const idle = new Date(Math.min(+now + 7 * day, +sqlDate(session.absolute_expires_at)));
    await connection.execute(
      "UPDATE refresh_token_sessions SET last_activity_at=?,idle_expires_at=? WHERE id=?",
      [now, idle, session.id],
    );
  }
  async function locate(
    rawToken: string,
  ): Promise<{ sid: string; userId: string; hash: string } | undefined> {
    if (!/^[a-zA-Z0-9_-]{43}$/.test(rawToken)) return undefined;
    const hash = hashRefresh(rawToken);
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT s.id,s.user_id FROM refresh_tokens t JOIN refresh_token_sessions s ON s.id=t.session_id WHERE t.token_hash=?",
      [hash],
    );
    return rows[0] ? { sid: String(rows[0].id), userId: String(rows[0].user_id), hash } : undefined;
  }
  return {
    async login(credentials: { username: string; password: string }): Promise<AuthGrant> {
      const username = credentials.username.trim().toLowerCase();
      const [rows] = await pool.execute<UserRow[]>("SELECT * FROM users WHERE username=?", [
        username,
      ]);
      const snapshot = rows[0];
      dummyHash ??= hashPassword("internal-dummy-comparison-only");
      const valid = await verifyPassword(
        credentials.password,
        snapshot?.password_hash ?? (await dummyHash),
      );
      const result = await withTransaction(pool, async (connection) => {
        const user = snapshot ? await lockedUser(connection, snapshot.id) : undefined;
        if (
          !valid ||
          !user ||
          !user.active ||
          user.deleted_at ||
          user.password_hash !== snapshot?.password_hash
        ) {
          await writeAudit(connection, {
            action: "auth.login_failure",
            metadata: { reason: "credentials" },
          });
          return undefined;
        }
        const now = clock.now();
        const sid = randomUUID();
        await connection.execute(
          "INSERT INTO refresh_token_sessions(id,user_id,auth_version,created_at,last_activity_at,idle_expires_at,absolute_expires_at) VALUES (?,?,?,?,?,?,?)",
          [
            sid,
            user.id,
            user.auth_version,
            now,
            now,
            new Date(+now + 7 * day),
            new Date(+now + 30 * day),
          ],
        );
        await writeAudit(connection, {
          actorId: user.id,
          action: "auth.login",
          targetType: "session",
          targetId: sid,
        });
        return grant(connection, user, sid, now);
      });
      if (!result) throw loginFailure();
      return result;
    },
    async refresh(rawToken: string): Promise<AuthGrant> {
      const located = await locate(rawToken);
      if (!located) throw unauthorized();
      const result = await withTransaction(pool, async (connection) => {
        const user = await lockedUser(connection, located.userId);
        const session = await checkSession(connection, user, located.sid);
        if (!session || !user) return undefined;
        const [[token]] = await connection.execute<RowDataPacket[]>(
          "SELECT consumed_at FROM refresh_tokens WHERE token_hash=? AND session_id=? FOR UPDATE",
          [located.hash, located.sid],
        );
        if (!token) return undefined;
        if (token.consumed_at) {
          await connection.execute(
            "UPDATE refresh_token_sessions SET revoked_at=?,revoke_reason='token_reuse' WHERE id=?",
            [clock.now(), session.id],
          );
          await writeAudit(connection, {
            actorId: user.id,
            action: "auth.token_reuse",
            targetType: "session",
            targetId: session.id,
          });
          return undefined; // Commit revoke BEFORE producing the public 401.
        }
        await connection.execute("UPDATE refresh_tokens SET consumed_at=? WHERE token_hash=?", [
          clock.now(),
          located.hash,
        ]);
        await touch(connection, session);
        return grant(connection, user, session.id, clock.now());
      });
      if (!result) throw unauthorized();
      return result;
    },
    async authenticate(accessToken: string): Promise<AuthPrincipal> {
      const claims = verifyAccess(accessToken, config, clock);
      const result = await withTransaction(pool, async (connection) => {
        const user = await lockedUser(connection, claims.sub);
        const session = await checkSession(connection, user, claims.sid, claims.authVersion);
        if (!session || !user) return undefined;
        await touch(connection, session);
        return {
          principal: await resolvePrincipal(connection, user),
          sid: session.id,
          authVersion: user.auth_version,
        };
      });
      if (!result) throw unauthorized();
      return result;
    },
    async logout(rawToken: string): Promise<void> {
      const located = await locate(rawToken);
      if (!located) return;
      await withTransaction(pool, async (connection) => {
        await lockedUser(connection, located.userId);
        const [rows] = await connection.execute<SessionRow[]>(
          "SELECT * FROM refresh_token_sessions WHERE id=? FOR UPDATE",
          [located.sid],
        );
        if (!rows[0] || rows[0].revoked_at) return;
        await connection.execute(
          "UPDATE refresh_token_sessions SET revoked_at=?,revoke_reason='logout' WHERE id=?",
          [clock.now(), located.sid],
        );
        await writeAudit(connection, {
          actorId: located.userId,
          action: "auth.logout",
          targetType: "session",
          targetId: located.sid,
        });
      });
    },
    async revoke(actor: AuthPrincipal, command: { all?: boolean; userId?: string }): Promise<void> {
      const targetId = command.userId ?? actor.principal.id;
      const other = targetId !== actor.principal.id;
      await withRbacWrite(pool, async (connection) => {
        const { users } = await lockAuthorizedUsers(
          connection,
          actor,
          other ? "account.revoke_session" : undefined,
          clock,
          [targetId],
        );
        const target = users.get(targetId);
        if (!target || target.deleted_at)
          throw new ApiError(404, "NOT_FOUND", "Không tìm thấy tài khoản");
        if (other && target.is_master)
          throw new ApiError(
            403,
            "PROTECTED_ACCOUNT",
            "Không thể thay đổi tài khoản quản trị chính",
          );
        const all = other || command.all;
        const predicate = all ? "user_id=?" : "user_id=? AND id=?";
        const values = all ? [targetId] : [targetId, actor.sid];
        await connection.execute(
          `UPDATE refresh_token_sessions SET revoked_at=?,revoke_reason='revoked' WHERE ${predicate} AND revoked_at IS NULL`,
          [clock.now(), ...values],
        );
        await writeAudit(connection, {
          actorId: actor.principal.id,
          action: "auth.revoke",
          targetType: "account",
          targetId,
        });
      });
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
