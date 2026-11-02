import { afterEach, beforeEach, expect, it } from "vitest";
import { businessFixture } from "./business-fixtures";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import {
  loadNotifications,
  markNotificationsRead,
  safeNotificationLink,
} from "../../src/features/admin/notifications/service";
import { createEntityService } from "../../src/features/admin/services/entity-service";
import type { AdminStore } from "../../src/features/admin/services/contracts";
let f: Awaited<ReturnType<typeof businessFixture>>;
const viewer = { userId: "user-4", roleId: "viewer" };
beforeEach(async () => {
  f = await businessFixture("notification-service");
  await ensureDataset(f.store, "notifications");
});
afterEach(async () => {
  await f.store.destroy();
});
it("isolates read receipts by account and preserves immutable legacy defaults", async () => {
  const raw = await f.store.list("notifications");
  await markNotificationsRead(f.store, viewer, ["notification-1"]);
  const a = await loadNotifications(f.store, viewer, { page: 1, pageSize: 10 }),
    b = await loadNotifications(f.store, f.session, { page: 1, pageSize: 10 });
  expect(a.items.find((n) => n.id === "notification-1")?.isRead).toBe(true);
  expect(b.items.find((n) => n.id === "notification-1")?.isRead).toBe(false);
  expect(a.unreadCount).toBe(2);
  expect(b.unreadCount).toBe(3);
  expect(b.items.find((n) => n.id === "notification-4")?.isRead).toBe(true);
  expect(await f.store.list("notifications")).toEqual(raw);
  await markNotificationsRead(f.store, viewer, ["notification-1"]);
  expect(await f.store.list("notificationReads")).toHaveLength(1);
  await expect(
    createEntityService(f.store, "notifications", () => viewer).update(
      "notification-1",
      { href: "https://evil.test" },
      1,
    ),
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("mark all covers every page and generic receipt reads cannot expose another user", async () => {
  const before = await loadNotifications(f.store, f.session, { page: 1, pageSize: 2 });
  expect(before.total).toBe(8);
  expect(before.items).toHaveLength(2);
  await markNotificationsRead(f.store, f.session, "all");
  expect((await loadNotifications(f.store, f.session, { page: 1, pageSize: 2 })).unreadCount).toBe(
    0,
  );
  expect((await loadNotifications(f.store, viewer, { page: 1, pageSize: 2 })).unreadCount).toBe(3);
  const receipts = await createEntityService(f.store, "notificationReads", () => viewer).list({
    page: 1,
    pageSize: 100,
  });
  expect(receipts.items).toEqual([]);
  const other = (await f.store.list("notificationReads"))[0];
  await expect(
    createEntityService(f.store, "notificationReads", () => viewer).get(other.id),
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("failed or stale write rolls back and cannot write for a changed session", async () => {
  const failed: AdminStore = {
    ...f.store,
    transaction: (keys, work) =>
      f.store.transaction(keys, (tx) =>
        work({
          ...tx,
          put: async (entity, row) => {
            if (entity === "notificationReads")
              throw new DOMException("Quota", "QuotaExceededError");
            await tx.put(entity, row);
          },
        }),
      ),
  };
  await expect(markNotificationsRead(failed, f.session, "all")).rejects.toMatchObject({
    code: "storage",
  });
  expect(await f.store.list("notificationReads")).toEqual([]);
  const stale: AdminStore = {
    ...f.store,
    get generation() {
      return f.store.generation;
    },
    transaction: async (keys, work) => {
      f.store.invalidateOperations();
      return f.store.transaction(keys, work);
    },
  };
  await expect(markNotificationsRead(stale, f.session, ["notification-1"])).rejects.toMatchObject({
    code: "aborted",
  });
  expect(await f.store.list("notificationReads")).toEqual([]);
});
it("only permits safe app paths and http links", () => {
  for (const href of [
    "//evil.test",
    "/\\evil.test",
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:pass@evil.test",
  ])
    expect(safeNotificationLink(href)).toBeNull();
  expect(safeNotificationLink("/admin/dashboard?x=1#note")).toEqual({
    kind: "internal",
    href: "/admin/dashboard?x=1#note",
  });
  expect(safeNotificationLink("https://www.facebook.com/bidiary")).toEqual({
    kind: "external",
    href: "https://www.facebook.com/bidiary",
  });
});
