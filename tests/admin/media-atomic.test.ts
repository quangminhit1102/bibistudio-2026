import { it, expect, vi } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { seedBase } from "../../src/features/admin/demo/clock";
import { createEntityService } from "../../src/features/admin/services/entity-service";
it("image write quota failure rolls back blob, metadata and audit; delete releases blob", async () => {
  const store = createAdminStore("media-atomic");
  const image = {
    asset: {
      ...seedBase("image"),
      name: "photo",
      mime: "image/png",
      size: 1,
      width: 1,
      height: 1,
      blobKey: "image",
    },
    blob: new Blob(["x"]),
  };
  try {
    const original = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "media") throw new DOMException("quota", "QuotaExceededError");
      return original.apply(this, args);
    });
    await expect(store.importMedia([image], "u")).rejects.toMatchObject({ code: "storage" });
    spy.mockRestore();
    expect(await store.getBlob("image")).toBeUndefined();
    expect(await store.list("media")).toEqual([]);
    expect(await store.list("audit")).toEqual([]);
    await store.importMedia([image], "u");
    expect((await store.list("audit")).length).toBe(1);
    await createEntityService(store, "media", () => ({
      userId: "u",
      roleId: "super-admin",
    })).remove("image", 1);
    expect(await store.getBlob("image")).toBeUndefined();
  } finally {
    vi.restoreAllMocks();
    await store.destroy();
  }
});
