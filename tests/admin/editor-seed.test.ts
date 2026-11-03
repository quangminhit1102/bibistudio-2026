import { expect, it } from "vitest";
import { seed } from "../../src/features/admin/content/seed";
import { readRichContent } from "../../src/features/admin/content/rich-content";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { ensureContentMedia } from "../../src/features/admin/content/seed-upgrade";
it("seeds inline article images and captions alongside real local assets", () => {
  const batch = seed();
  const images = batch.posts!.filter((p) => readRichContent(p.content).includes("data-media-id"));
  expect(images.length).toBeGreaterThan(0);
  expect(images.some((p) => readRichContent(p.content).includes("<figcaption>"))).toBe(true);
  expect(
    batch.media!.some((m) => m.id.startsWith("journal-inline-") && m.url?.startsWith("/")),
  ).toBe(true);
});
it("adds missing media without rewriting an existing article or existing media", async () => {
  const s = createAdminStore("editor-seed-" + crypto.randomUUID());
  try {
    const p = { ...seed().posts![0], title: "Tự sửa", content: "Nội dung đã sửa", revision: 4 };
    const asset = { ...seed().media![0], name: "Ảnh đã sửa", url: "/custom.jpg" };
    await s.transaction(["posts", "media"], async (tx) => {
      await tx.put("posts", p);
      await tx.put("media", asset);
    });
    await s.setMeta("seed:content", true);
    await ensureContentMedia(s);
    await ensureContentMedia(s);
    expect(await s.get("posts", p.id)).toEqual(p);
    expect(await s.get("media", asset.id)).toEqual(asset);
    expect((await s.list("media")).some((m) => m.id.startsWith("journal-inline-"))).toBe(true);
  } finally {
    await s.destroy();
  }
});
