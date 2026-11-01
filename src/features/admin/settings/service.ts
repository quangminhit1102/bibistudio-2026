import { z } from "zod";
import type { AdminStore, DemoSession } from "../services/contracts";
import { authorizeOperation } from "../accounts/permissions";
import { drainSeedJobs, clearSeedCache } from "../demo/registry";
export async function resetDemoData(store: AdminStore, session: DemoSession | null) {
  const assertActive = await authorizeOperation(store, session, "settings", "settings");
  await drainSeedJobs(store);
  assertActive();
  await store.reset();
  clearSeedCache(store);
}
import { ServiceError } from "../services/errors";
const schemas = {
  general: z.object({
    studioName: z.string().trim().min(1).max(100),
    email: z.string().email(),
    timezone: z.enum(["Asia/Ho_Chi_Minh", "UTC"]),
    language: z.enum(["vi", "en"]),
  }),
  security: z.object({
    demoMfa: z.boolean(),
    sessionTimeout: z.coerce.number().int().min(5).max(120),
  }),
};
export async function saveSetting(
  store: AdminStore,
  session: DemoSession | null,
  key: "general" | "security",
  values: unknown,
  revision: number,
) {
  const assertActive = await authorizeOperation(store, session, "settings", "update");
  const parsed = schemas[key].safeParse(values);
  if (!parsed.success)
    throw new ServiceError(
      "validation",
      "Thông tin cài đặt không hợp lệ. Kiểm tra tên, email và thời gian phiên (5–120 phút).",
    );
  return store.transaction(["settings", "audit"], async (tx) => {
    assertActive();
    const before = await tx.get("settings", key);
    if (!before) throw new ServiceError("not-found", "Không tìm thấy cài đặt.");
    if (before.revision !== revision)
      throw new ServiceError("conflict", "Cài đặt đã thay đổi. Hãy tải lại.");
    const now = new Date().toISOString();
    const after = { ...before, values: parsed.data, updatedAt: now, revision: revision + 1 };
    await tx.put("settings", after);
    await tx.put("audit", {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      actor: session!.userId,
      resource: "settings",
      action: "update",
      recordId: key,
      before: JSON.stringify(before.values),
      after: JSON.stringify(after.values),
    });
    assertActive();
    return after;
  });
}
