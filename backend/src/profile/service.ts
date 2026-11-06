import type { Pool, PoolConnection } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import { resolvePrincipal, type UserRow } from "../auth/repository";
import { withTransaction } from "../db/transaction";
import { withRbacWrite, lockAuthorizedUsers } from "../authorization/transaction";
import { ApiError } from "../http/errors";
import { writeAudit } from "../audit/repository";
import { assertProfileSchemaReady } from "./schema";
import type { ProfileDto } from "./types";
export interface ProfileInput {
  displayName?: string;
  email?: string | null;
  phone?: string | null;
}
async function dto(connection: PoolConnection, user: UserRow): Promise<ProfileDto> {
  return {
    ...(await resolvePrincipal(connection, user)),
    phone: user.phone ?? null,
    avatarId: user.avatar_id ?? null,
  };
}
export function createProfileService({ pool, clock }: { pool: Pool; clock: Clock }) {
  async function current(connection: PoolConnection, actor: AuthPrincipal) {
    const { users } = await lockAuthorizedUsers(connection, actor, undefined, clock);
    await assertProfileSchemaReady(connection);
    return users.get(actor.principal.id)!;
  }
  return {
    getSelf: (actor: AuthPrincipal): Promise<ProfileDto> =>
      withTransaction(pool, async (connection) =>
        dto(connection, await current(connection, actor)),
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
          if (user.is_master)
            throw new ApiError(
              403,
              "PROTECTED_ACCOUNT",
              "Không thể thay đổi tài khoản quản trị chính",
            );
          if (user.revision !== revision)
            throw new ApiError(409, "REVISION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại");
          const fields = (
            [
              ["displayName", "display_name"],
              ["email", "email"],
              ["phone", "phone"],
            ] as const
          ).filter(([key, column]) => input[key] !== undefined && input[key] !== user[column]);
          if (!fields.length) return dto(connection, user);
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
          return dto(connection, updated);
        },
        { profileAssets: true },
      ),
  };
}
export type ProfileService = ReturnType<typeof createProfileService>;
