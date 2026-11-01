import { it, expect, afterEach } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { createEntityService } from "../../src/features/admin/services/entity-service";
const store = createAdminStore("integrity-test");
afterEach(() => store.reset());
const admin = () => ({ userId: "user-1", roleId: "super-admin" });
it("protects Super Admin role and rejects missing category/media references", async () => {
  await ensureDataset(store, "roles");
  await ensureDataset(store, "products");
  await expect(
    createEntityService(store, "roles", admin).update("super-admin", { permissions: {} }, 1),
  ).rejects.toMatchObject({ code: "validation" });
  const product = (await store.list("products"))[0];
  await expect(
    createEntityService(store, "products", admin).update(
      product.id,
      { categoryId: "missing" },
      product.revision,
    ),
  ).rejects.toMatchObject({ code: "validation" });
});
it("prevents non-Super Admin from promoting a user to Super Admin", async () => {
  await ensureDataset(store, "users");
  const user = (await store.list("users")).find((u) => u.roleId === "viewer")!;
  await expect(
    createEntityService(store, "users", () => ({
      userId: "user-13",
      roleId: "administrator",
    })).update(user.id, { roleId: "super-admin" }, user.revision),
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("protects media embedded in post documents", async () => {
  await ensureDataset(store, "posts");
  const post = (await store.list("posts"))[0];
  const now = new Date().toISOString();
  await store.transaction(["media", "posts"], async (tx) => {
    await tx.put("media", {
      id: "image-1",
      name: "image",
      mime: "image/png",
      size: 1,
      width: 1,
      height: 1,
      blobKey: "image-1",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    await tx.put("posts", {
      ...post,
      content: JSON.stringify({
        type: "doc",
        content: [{ type: "image", attrs: { mediaId: "image-1" } }],
      }),
    });
  });
  await expect(
    createEntityService(store, "media", admin).remove("image-1", 1),
  ).rejects.toMatchObject({ code: "validation" });
});
