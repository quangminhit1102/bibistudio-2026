import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import type { UserRow } from "../auth/repository";
import { hashPassword, verifyPassword } from "../auth/password";
import { withTransaction } from "../db/transaction";
import { withRbacWrite, lockAuthorizedUsers } from "../authorization/transaction";
import { ApiError } from "../http/errors";
import { writeAudit } from "../audit/repository";
import { assertProfileSchemaReady } from "./schema";
import type { ProfileDto } from "./types";
import type { AvatarStore } from "./avatar-store";
import { createAvatarService } from "./avatar-service";
import { profileDto } from "./repository";
export interface ProfileInput {
  displayName?: string;
  email?: string | null;
  phone?: string | null;
}
export function createProfileService({
  pool,
  clock,
  assets,
}: {
  pool: Pool;
  clock: Clock;
  assets?: AvatarStore;
}) {
  async function current(connection: PoolConnection, actor: AuthPrincipal) {
    const { users } = await lockAuthorizedUsers(connection, actor, undefined, clock);
    await assertProfileSchemaReady(connection);
    return users.get(actor.principal.id)!;
  }
  return {
    ...createAvatarService({ pool, clock, assets }),
    getSelf: (actor: AuthPrincipal): Promise<ProfileDto> =>
      withTransaction(pool, async (connection) =>
        profileDto(connection, await current(connection, actor)),
      ),
    updateSelf: (
      input: ProfileInput,
      revision: number,
      actor: AuthPrincipal,
    ): Promise<ProfileDto> =>
      withRbacWrite(
        pool,
        async (connection) => {
          const user = await current(connection, actor);
          if (user.revision !== revision)
            throw new ApiError(409, "REVISION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại");
          const fields = (
            [
              ["displayName", "display_name"],
              ["email", "email"],
              ["phone", "phone"],
            ] as const
          ).filter(([key, column]) => input[key] !== undefined && input[key] !== user[column]);
          if (!fields.length) return profileDto(connection, user);
          await connection.execute(
            `UPDATE users SET ${fields.map(([, column]) => column + "=?").join(",")},revision=revision+1,updated_at=? WHERE id=?`,
            [...fields.map(([key]) => input[key] ?? null), clock.now(), user.id],
          );
          await writeAudit(connection, {
            actorId: user.id,
            action: "profile.update",
            targetType: "account",
            targetId: user.id,
            metadata: { changedFields: fields.map(([key]) => key) },
          });
          const [[updated]] = await connection.execute<UserRow[]>(
            "SELECT * FROM users WHERE id=?",
            [user.id],
          );
          return profileDto(connection, updated);
        },
        { profileAssets: true },
      ),
    /** Keeps the session that asked and signs the account out everywhere else. */
    async changePassword(
      input: { currentPassword: string; newPassword: string },
      actor: AuthPrincipal,
    ): Promise<ProfileDto> {
      // bcrypt runs before the write lock is taken; the hash is compared again under it.
      const verified = (await withTransaction(pool, (connection) => current(connection, actor)))
        .password_hash;
      if (!(await verifyPassword(input.currentPassword, verified)))
        throw new ApiError(400, "INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không đúng");
      if (await verifyPassword(input.newPassword, verified))
        throw new ApiError(400, "PASSWORD_UNCHANGED", "Mật khẩu mới phải khác mật khẩu hiện tại");
      const hash = await hashPassword(input.newPassword);
      return withRbacWrite(pool, async (connection) => {
        const user = await current(connection, actor);
        if (user.password_hash !== verified)
          throw new ApiError(409, "REVISION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại");
        await connection.execute(
          "UPDATE users SET password_hash=?,revision=revision+1,updated_at=? WHERE id=?",
          [hash, clock.now(), user.id],
        );
        const [revoked] = await connection.execute<ResultSetHeader>(
          "UPDATE refresh_token_sessions SET revoked_at=?,revoke_reason='password_changed' WHERE user_id=? AND id<>? AND revoked_at IS NULL",
          [clock.now(), user.id, actor.sid],
        );
        await writeAudit(connection, {
          actorId: user.id,
          action: "profile.password_change",
          targetType: "account",
          targetId: user.id,
          metadata: { sessionCount: revoked.affectedRows },
        });
        const [[updated]] = await connection.execute<UserRow[]>("SELECT * FROM users WHERE id=?", [
          user.id,
        ]);
        return profileDto(connection, updated);
      });
    },
  };
}
export type ProfileService = ReturnType<typeof createProfileService>;
