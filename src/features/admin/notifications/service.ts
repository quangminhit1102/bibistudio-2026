import type {
  AdminStore,
  AdminTransaction,
  DemoSession,
  ListResult,
  Notification,
} from "../services/contracts";
import { authorizeOperation, requirePermission } from "../accounts/permissions";
import { ensureDataset } from "../demo/registry";
import { ServiceError } from "../services/errors";
export type NotificationView = Notification & { isRead: boolean };
export type NotificationPage = ListResult<NotificationView> & { unreadCount: number };
async function access(store: AdminStore, session: DemoSession | null) {
  const generation = store.generation;
  if (!session) throw new ServiceError("forbidden", "Vui lòng chọn tài khoản.");
  await ensureDataset(store, "users");
  const active = await authorizeOperation(store, session, "notifications", "view");
  const user = await store.get("users", session.userId);
  if (!user?.active || user.roleId !== session.roleId)
    throw new ServiceError("forbidden", "Tài khoản đã thay đổi.");
  await ensureDataset(store, "notifications");
  const check = () => {
    active();
    if (store.generation !== generation) throw new ServiceError("aborted", "Phiên đã thay đổi.");
  };
  check();
  return check;
}
export async function loadNotifications(
  store: AdminStore,
  session: DemoSession | null,
  input: { page: number; pageSize: number },
): Promise<NotificationPage> {
  const active = await access(store, session);
  const [notes, receipts] = await Promise.all([
    store.list("notifications"),
    store.list("notificationReads"),
  ]);
  const readIds = new Set(
    receipts.filter((r) => r.userId === session!.userId).map((r) => r.notificationId),
  );
  const rows = notes
    .map((n) => ({ ...n, isRead: n.read || readIds.has(n.id) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const size = Number.isFinite(input.pageSize)
    ? Math.max(1, Math.min(100, Math.trunc(input.pageSize)))
    : 10;
  const page = Math.max(
    1,
    Math.min(Math.ceil(rows.length / size) || 1, Math.trunc(input.page) || 1),
  );
  active();
  return {
    items: rows.slice((page - 1) * size, page * size),
    page,
    pageSize: size,
    total: rows.length,
    unreadCount: rows.filter((n) => !n.isRead).length,
  };
}
export async function markNotificationsRead(
  store: AdminStore,
  session: DemoSession | null,
  ids: string[] | "all",
): Promise<void> {
  const active = await access(store, session),
    actor = session!;
  await store.transaction(
    ["notifications", "notificationReads", "users", "roles"],
    async (tx: AdminTransaction) => {
      active();
      const user = await tx.get("users", actor.userId),
        role = await tx.get("roles", actor.roleId);
      if (!user?.active || user.roleId !== actor.roleId)
        throw new ServiceError("forbidden", "Tài khoản đã thay đổi.");
      requirePermission(actor, "notifications", "view", role);
      const notes = await tx.list("notifications"),
        map = new Map(notes.map((n) => [n.id, n]));
      const selected = ids === "all" ? notes.map((n) => n.id) : [...new Set(ids)];
      for (const notificationId of selected) {
        const n = map.get(notificationId);
        if (!n) throw new ServiceError("not-found", "Thông báo không còn tồn tại.");
        const id = JSON.stringify([actor.userId, notificationId]);
        if (n.read || (await tx.get("notificationReads", id))) continue;
        const now = new Date().toISOString();
        await tx.put("notificationReads", {
          id,
          userId: actor.userId,
          notificationId,
          readAt: now,
          createdAt: now,
          updatedAt: now,
          revision: 1,
        });
      }
      active();
    },
  );
}
export function safeNotificationLink(
  raw: string,
): { kind: "internal" | "external"; href: string } | null {
  const href = raw.trim();
  if (
    !href ||
    [...href].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    href.includes("\\") ||
    href.startsWith("//")
  )
    return null;
  try {
    const url = new URL(href, "https://admin.local");
    if (url.username || url.password) return null;
    if (href.startsWith("/") && url.origin === "https://admin.local")
      return { kind: "internal", href: url.pathname + url.search + url.hash };
    if (/^https?:\/\//i.test(href) && ["http:", "https:"].includes(url.protocol))
      return { kind: "external", href: url.href };
  } catch {
    /* An invalid link never becomes navigation. */
  }
  return null;
}
