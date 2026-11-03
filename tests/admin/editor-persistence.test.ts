import { expect, it } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureDataset } from "../../src/features/admin/demo/registry";
import { createEntityService } from "../../src/features/admin/services/entity-service";
import { readRichContent, writeRichContent } from "../../src/features/admin/content/rich-content";
it("persists HTML body and image captions through the real post service", async () => {
  const store = createAdminStore("editor-persist-" + crypto.randomUUID());
  try {
    await ensureDataset(store, "posts");
    const p = (await store.list("posts"))[0],
      media = (await store.list("media"))[0];
    const content = writeRichContent(
      `<h2>Giữ nội dung</h2><h4>Thông số</h4><p><span style="color: #ab1234">Màu chữ</span></p><table><tbody><tr><td>120 trang</td></tr></tbody></table><figure><img data-media-id="${media.id}" alt="Sổ" width="320"><figcaption>Chú thích</figcaption></figure>`,
    );
    const updated = await createEntityService(store, "posts", () => ({
      userId: "user-1",
      roleId: "super-admin",
    })).update(p.id, { content }, p.revision);
    expect(readRichContent(updated.content)).toContain("<h2>Giữ nội dung</h2>");
    expect(readRichContent(updated.content)).toContain("<figcaption>Chú thích</figcaption>");
    expect(readRichContent(updated.content)).toContain("<h4>Thông số</h4>");
    expect(readRichContent(updated.content)).toContain("<td>120 trang</td>");
    expect(readRichContent(updated.content)).toContain('width="320"');
    expect(readRichContent(updated.content)).toContain("color: rgb(171, 18, 52)");
    await store.close();
    expect((await store.get("posts", p.id))?.content).toBe(content);
    await expect(
      createEntityService(store, "media", () => ({
        userId: "user-1",
        roleId: "super-admin",
      })).remove(media.id, media.revision),
    ).rejects.toMatchObject({ code: "validation" });
  } finally {
    await store.destroy();
  }
});
it("validates product inline image references and protects them from deletion", async () => {
  const store = createAdminStore("editor-product-media-" + crypto.randomUUID());
  const admin = () => ({ userId: "user-1", roleId: "super-admin" });
  try {
    await ensureDataset(store, "products");
    await ensureDataset(store, "media");
    const p = (await store.list("products"))[0],
      media = (await store.list("media")).find((m) => !p.imageIds.includes(m.id))!;
    const service = createEntityService(store, "products", admin);
    await expect(
      service.update(
        p.id,
        { description: writeRichContent('<img data-media-id="missing">') },
        p.revision,
      ),
    ).rejects.toMatchObject({ code: "validation" });
    await service.update(
      p.id,
      { description: writeRichContent(`<img data-media-id="${media.id}">`) },
      p.revision,
    );
    await expect(
      createEntityService(store, "media", admin).remove(media.id, media.revision),
    ).rejects.toMatchObject({ code: "validation" });
  } finally {
    await store.destroy();
  }
});
