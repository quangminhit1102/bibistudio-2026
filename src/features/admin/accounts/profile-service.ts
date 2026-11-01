import { z } from "zod";
import type { AdminStore, DemoSession } from "../services/contracts";
import { ServiceError } from "../services/errors";
import { validateRecord } from "../services/validation";
const profile = z.object({ name: z.string().trim().min(1).max(200), email: z.string().email() });
export async function getProfile(store: AdminStore, session: DemoSession | null) {
  const user = session ? await store.get("users", session.userId) : undefined;
  if (!user?.active) throw new ServiceError("forbidden", "Phiên demo không còn hoạt động.");
  return user;
}
export async function saveProfile(
  store: AdminStore,
  session: DemoSession | null,
  values: unknown,
  revision: number,
) {
  const parsed = profile.safeParse(values);
  if (!parsed.success) throw new ServiceError("validation", "Nhập họ tên và email hợp lệ.");
  const generation = store.generation;
  await getProfile(store, session);
  return store.transaction(["users", "roles", "audit"], async (tx) => {
    const before = await tx.get("users", session!.userId);
    if (!before?.active) throw new ServiceError("forbidden", "Tài khoản không còn hoạt động.");
    if (before.revision !== revision)
      throw new ServiceError("conflict", "Hồ sơ đã thay đổi, hãy tải lại.");
    const now = new Date().toISOString();
    const after = { ...before, ...parsed.data, updatedAt: now, revision: revision + 1 };
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
      before: JSON.stringify({ name: before.name, email: before.email }),
      after: JSON.stringify(parsed.data),
    });
    if (generation !== store.generation) throw new ServiceError("aborted", "Phiên đã thay đổi.");
    return after;
  });
}
