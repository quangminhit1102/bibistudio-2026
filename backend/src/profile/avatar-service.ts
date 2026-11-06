import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import type { UserRow } from "../auth/repository";
import { lockAuthorizedUsers, withRbacWrite } from "../authorization/transaction";
import { withTransaction } from "../db/transaction";
import { ApiError } from "../http/errors";
import { writeAudit } from "../audit/repository";
import { assertProfileSchemaReady } from "./schema";
import { profileDto } from "./repository";
import { normalizeAvatar } from "./avatar-codec";
import type { AvatarStore, StoredAvatar } from "./avatar-store";
import type { ProfileDto } from "./types";
function mutable(user: UserRow, revision: number) {
  if (user.is_master)
    throw new ApiError(403, "PROTECTED_ACCOUNT", "Không thể thay đổi tài khoản quản trị chính");
  if (user.revision !== revision)
    throw new ApiError(409, "REVISION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại");
}
function activeRequest(signal?: AbortSignal) {
  if (signal?.aborted) throw new ApiError(408, "REQUEST_ABORTED", "Yêu cầu đã bị hủy");
}
export function createAvatarService({
  pool,
  clock,
  assets,
}: {
  pool: Pool;
  clock: Clock;
  assets?: AvatarStore;
}) {
  const store = () => {
    if (!assets) throw new ApiError(503, "PROFILE_NOT_READY", "Dịch vụ ảnh chưa sẵn sàng");
    return assets;
  };
  async function target(
    c: PoolConnection,
    targetId: string | undefined,
    actor: AuthPrincipal,
    permission: string,
  ) {
    const { users, principal } = await lockAuthorizedUsers(
      c,
      actor,
      targetId === undefined ? undefined : permission,
      clock,
      targetId === undefined ? [] : [targetId],
    );
    await assertProfileSchemaReady(c);
    const user = users.get(targetId ?? actor.principal.id);
    if (!user || user.deleted_at) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy tài khoản");
    return { user, principal };
  }
  async function quota(c: PoolConnection, userId: string, additional = 0) {
    const [[row]] = await c.execute<RowDataPacket[]>(
      "SELECT COUNT(*) n,COALESCE(SUM(bytes),0) bytes FROM profile_avatar_assets WHERE user_id=?",
      [userId],
    );
    if (Number(row.n) >= 128 || Number(row.bytes) + additional > 64 * 1024 ** 2)
      throw new ApiError(
        429,
        "AVATAR_QUOTA_EXCEEDED",
        "Đã đạt giới hạn ảnh lưu giữ. Vui lòng thử lại sau khi dọn dữ liệu theo chính sách lưu trữ",
      );
  }
  async function preflightAvatar(
    targetId: string | undefined,
    revision: number,
    actor: AuthPrincipal,
  ): Promise<void> {
    store();
    await withTransaction(pool, async (c) => {
      const { user } = await target(c, targetId, actor, "account.update");
      mutable(user, revision);
      await quota(c, user.id);
    });
  }
  async function retire(c: PoolConnection, user: UserRow) {
    if (user.avatar_id)
      await c.execute(
        "UPDATE profile_avatar_assets SET retired_at=COALESCE(retired_at,?) WHERE id=? AND user_id=?",
        [clock.now(), user.avatar_id, user.id],
      );
  }
  async function changed(c: PoolConnection, userId: string) {
    const [[row]] = await c.execute<UserRow[]>("SELECT * FROM users WHERE id=?", [userId]);
    return profileDto(c, row);
  }
  return {
    preflightAvatar,
    async replaceAvatar(
      targetId: string | undefined,
      bytes: Buffer,
      mime: string,
      revision: number,
      actor: AuthPrincipal,
      options: { signal?: AbortSignal } = {},
    ): Promise<ProfileDto> {
      activeRequest(options.signal);
      await preflightAvatar(targetId, revision, actor);
      const image = await normalizeAvatar(bytes, mime);
      activeRequest(options.signal);
      const file = await store().write(image);
      let attempted = false;
      try {
        activeRequest(options.signal);
        return await withRbacWrite(
          pool,
          async (c) => {
            const { user, principal } = await target(c, targetId, actor, "account.update");
            mutable(user, revision);
            await quota(c, user.id, file.byteLength);
            activeRequest(options.signal);
            await c.execute(
              "INSERT INTO profile_avatar_assets(id,user_id,format,width,height,bytes,sha256,created_at) VALUES(?,?,?,?,?,?,?,?)",
              [
                file.id,
                user.id,
                file.format,
                file.width,
                file.height,
                file.byteLength,
                file.sha256,
                clock.now(),
              ],
            );
            await retire(c, user);
            await c.execute(
              "UPDATE users SET avatar_id=?,revision=revision+1,updated_at=? WHERE id=?",
              [file.id, clock.now(), user.id],
            );
            await writeAudit(c, {
              actorId: principal.id,
              action: "profile.avatar.replace",
              targetType: "account",
              targetId: user.id,
              metadata: {
                changedFields: ["avatar"],
                assetIds: [...(user.avatar_id ? [user.avatar_id] : []), file.id],
              },
            });
            return changed(c, user.id);
          },
          {
            profileAssets: true,
            beforeCommit: () => {
              activeRequest(options.signal);
              attempted = true;
            },
          },
        );
      } catch (error) {
        // A commit may have succeeded even if its acknowledgement was lost.
        if (!attempted)
          await store()
            .remove(file.id, file.format)
            .catch(() => {});
        throw error;
      }
    },
    async removeAvatar(
      targetId: string | undefined,
      revision: number,
      actor: AuthPrincipal,
    ): Promise<ProfileDto> {
      store();
      return withRbacWrite(
        pool,
        async (c) => {
          const { user, principal } = await target(c, targetId, actor, "account.update");
          mutable(user, revision);
          if (!user.avatar_id) return profileDto(c, user);
          await retire(c, user);
          await c.execute(
            "UPDATE users SET avatar_id=NULL,revision=revision+1,updated_at=? WHERE id=?",
            [clock.now(), user.id],
          );
          await writeAudit(c, {
            actorId: principal.id,
            action: "profile.avatar.remove",
            targetType: "account",
            targetId: user.id,
            metadata: { changedFields: ["avatar"], assetIds: [user.avatar_id] },
          });
          return changed(c, user.id);
        },
        { profileAssets: true },
      );
    },
    async readAvatar(
      targetId: string | undefined,
      assetId: string,
      actor: AuthPrincipal,
    ): Promise<{ bytes: Buffer; format: "jpeg" | "png" }> {
      const asset = await withTransaction(pool, async (c) => {
        const { user } = await target(c, targetId, actor, "account.view");
        if (user.avatar_id !== assetId)
          throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh đại diện");
        const [[row]] = await c.execute<RowDataPacket[]>(
          "SELECT * FROM profile_avatar_assets WHERE id=? AND user_id=? AND retired_at IS NULL",
          [assetId, user.id],
        );
        if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh đại diện");
        return {
          id: String(row.id),
          format: row.format,
          width: Number(row.width),
          height: Number(row.height),
          byteLength: Number(row.bytes),
          sha256: String(row.sha256),
        } as StoredAvatar;
      });
      return { bytes: await store().read(asset), format: asset.format };
    },
  };
}
