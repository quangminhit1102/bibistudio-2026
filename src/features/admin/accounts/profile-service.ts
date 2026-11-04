import { z } from "zod";
import type { AdminStore, DemoSession, AvatarChange, AdminUser } from "../services/contracts";
import { prepareAvatar, ownedAvatarKey } from "./profile-avatar";
import { ServiceError } from "../services/errors";
import { validateRecord } from "../services/validation";
const profile = z.object({ name: z.string().trim().min(1).max(200), email: z.string().email() });
export async function getProfile(store: AdminStore, session: DemoSession | null) {
  if (session?.kind === "http")
    throw new ServiceError("forbidden", "Hồ sơ tài khoản được quản lý qua API máy chủ");
  const user = session ? await store.get("users", session.userId) : undefined;
  if (!user?.active || user.roleId !== session?.roleId || !(await store.get("roles", user.roleId)))
    throw new ServiceError("forbidden", "Phiên không còn hoạt động.");
  return user;
}
export async function saveProfile(
  store: AdminStore,
  session: DemoSession | null,
  values: unknown,
  revision: number,
  avatarChange: AvatarChange = { kind: "keep" },
): Promise<AdminUser> {
  const parsed = profile.safeParse(values);
  if (!parsed.success) throw new ServiceError("validation", "Nhập họ tên và email hợp lệ.");
  const generation = store.generation;
  await getProfile(store, session);
  const prepared = avatarChange.kind === "replace" ? await prepareAvatar(avatarChange.file) : null;
  if (generation !== store.generation) throw new ServiceError("aborted", "Phiên đã thay đổi.");
  return store.transactionWithBlobs(["users", "roles", "audit"], async (tx) => {
    const before = await tx.get("users", session!.userId);
    if (
      !before?.active ||
      before.roleId !== session?.roleId ||
      !(await tx.get("roles", before.roleId))
    )
      throw new ServiceError("forbidden", "Tài khoản không còn hoạt động.");
    if (before.revision !== revision)
      throw new ServiceError("conflict", "Hồ sơ đã thay đổi, hãy tải lại.");
    const now = new Date().toISOString();
    let avatar = before.avatar;
    if (prepared) {
      const blobKey = `profile-avatar:${before.id}:${crypto.randomUUID()}`;
      await tx.putBlob(blobKey, prepared.file);
      avatar = {
        blobKey,
        mime: prepared.file.type,
        size: prepared.file.size,
        width: prepared.width,
        height: prepared.height,
      };
    } else if (avatarChange.kind === "remove") avatar = null;
    if (avatarChange.kind !== "keep" && ownedAvatarKey(before.id, before.avatar?.blobKey))
      await tx.removeBlob(before.avatar!.blobKey);
    const after = {
      ...before,
      ...parsed.data,
      ...(avatarChange.kind !== "keep" ? { avatar } : {}),
      updatedAt: now,
      revision: revision + 1,
    };
    await validateRecord("users", after, tx, before);
    await tx.put("users", after);
    await tx.put("audit", {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      actor: before.id,
      resource: "profile",
      recordId: before.id,
      action: "update",
      before: JSON.stringify({
        name: before.name,
        email: before.email,
        avatar: before.avatar ?? null,
      }),
      after: JSON.stringify({ ...parsed.data, avatar: after.avatar ?? null }),
    });
    if (generation !== store.generation) throw new ServiceError("aborted", "Phiên đã thay đổi.");
    return after;
  });
}
