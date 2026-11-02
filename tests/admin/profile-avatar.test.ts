import { it, expect, vi, afterEach } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { saveProfile } from "../../src/features/admin/accounts/profile-service";
import { createEntityService } from "../../src/features/admin/services/entity-service";
import { openDB } from "idb";
import { prepareAvatar } from "../../src/features/admin/accounts/profile-avatar";
const png = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])], "avatar.png", {
    type: "image/png",
  });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("viewer saves name email and private avatar together, removes only owned blobs and rejects forged CRUD references", async () => {
  const s = createAdminStore("profile-avatar");
  await ensureDataset(s, "users");
  const session = { userId: "user-4", roleId: "viewer" };
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 100, height: 100, close }));
  try {
    const before = (await s.get("users", "user-4"))!,
      role = await s.get("roles", "viewer");
    const saved = await saveProfile(
      s,
      session,
      { name: "Mai", email: "mai@example.test" },
      before.revision,
      { kind: "replace", file: png() },
    );
    expect(saved.avatar?.blobKey).toMatch(/^profile-avatar:user-4:/);
    expect(saved.revision).toBe(before.revision + 1);
    expect(await s.getBlob(saved.avatar!.blobKey)).toBeDefined();
    expect(await s.list("media")).toHaveLength(0);
    expect(await s.get("roles", "viewer")).toEqual(role);
    expect(close).toHaveBeenCalledOnce();
    await expect(
      createEntityService(s, "users", () => ({ userId: "user-1", roleId: "super-admin" })).update(
        "user-4",
        { avatar: { ...saved.avatar!, blobKey: "other-user" } },
        saved.revision,
      ),
    ).rejects.toMatchObject({ code: "validation" });
    const removed = await saveProfile(
      s,
      session,
      { name: saved.name, email: saved.email },
      saved.revision,
      { kind: "remove" },
    );
    expect(removed.avatar).toBeNull();
    expect(await s.getBlob(saved.avatar!.blobKey)).toBeUndefined();
    const next = await saveProfile(
      s,
      session,
      { name: removed.name, email: removed.email },
      removed.revision,
      { kind: "replace", file: png() },
    );
    await s.putBlob("another-owner", new Blob(["keep"]));
    await s.transaction(["users"], (tx) => tx.remove("users", "user-4"));
    expect(await s.getBlob(next.avatar!.blobKey)).toBeUndefined();
    expect(await s.getBlob("another-owner")).toBeDefined();
  } finally {
    await s.destroy();
  }
});
it("quota, decode, stale revision and session change preserve old profile and blob with no partial audit", async () => {
  const s = createAdminStore("profile-avatar-errors");
  await ensureDataset(s, "users");
  const session = { userId: "user-1", roleId: "super-admin" };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }),
  );
  try {
    const user = (await s.get("users", "user-1"))!,
      values = { name: user.name, email: user.email };
    await expect(
      saveProfile(s, session, values, user.revision, {
        kind: "replace",
        file: new File(["invalid"], "x.png", { type: "image/png" }),
      }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      saveProfile(s, session, values, 999, { kind: "replace", file: png() }),
    ).rejects.toMatchObject({ code: "conflict" });
    const put = IDBObjectStore.prototype.put;
    const fail = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "users") throw new DOMException("quota", "QuotaExceededError");
      return put.apply(this, args);
    });
    await expect(
      saveProfile(s, session, values, user.revision, { kind: "replace", file: png() }),
    ).rejects.toMatchObject({ code: "storage" });
    fail.mockRestore();
    expect(await s.get("users", user.id)).toEqual(user);
    expect(await s.list("audit")).toHaveLength(0);
    const db = await openDB("profile-avatar-errors");
    expect(await db.getAllKeys("blobs")).toEqual([]);
    db.close();
    let release!: (image: unknown) => void;
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      ),
    );
    const pending = saveProfile(s, session, values, user.revision, {
      kind: "replace",
      file: png(),
    });
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    s.invalidateOperations();
    release({ width: 10, height: 10, close: vi.fn() });
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    expect(await s.get("users", user.id)).toEqual(user);
  } finally {
    await s.destroy();
  }
});
it("validates MIME signature decode and exact size/pixel boundaries", async () => {
  for (const file of [
    new File([], "empty.png", { type: "image/png" }),
    new File(["GIF89a"], "x.gif", { type: "image/gif" }),
    new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
  ])
    await expect(prepareAvatar(file)).rejects.toMatchObject({ code: "validation" });
  vi.stubGlobal(
    "createImageBitmap",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("decode"))
      .mockResolvedValueOnce({ width: 40_000_001, height: 1, close: vi.fn() })
      .mockResolvedValueOnce({ width: 40_000_000, height: 1, close: vi.fn() }),
  );
  await expect(prepareAvatar(png())).rejects.toMatchObject({ code: "validation" });
  await expect(prepareAvatar(png())).rejects.toMatchObject({ code: "validation" });
  const data = new Uint8Array(5 * 1024 * 1024);
  data.set([137, 80, 78, 71, 13, 10, 26, 10]);
  expect((await prepareAvatar(new File([data], "limit.png", { type: "image/png" }))).width).toBe(
    40_000_000,
  );
});
