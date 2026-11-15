import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createContentMediaFixture, validDraft, validCategory } from "./content.mjs";
import { makePublicSnapshot, makePublicAssets } from "./public-content.mjs";
import { createContentEditing } from "../../dist/content/editing.js";
import { createContentPublication } from "../../dist/content/publication/publisher.js";
import { createGenerationStore } from "../../dist/content/publication/store.js";
import { withContentEnvironmentLock } from "../../dist/content/environment-lock.js";
import { readActiveContent } from "../../dist/content/publication/active-read.js";
import { renderContentGeneration } from "../../dist/content/render/document.js";
export const postInput = (post, patch = {}) =>
  Object.fromEntries(
    Object.keys(validDraft()).map((key) => [key, key in patch ? patch[key] : post[key]]),
  );
export const publicationRequest = (post) => ({
  action: "publish",
  targetId: post.id,
  expectedRevision: post.revision,
  idempotencyKey: randomUUID(),
});
export async function createPublicationFixture(t) {
  const f = await createContentMediaFixture(t),
    assets = makePublicAssets(),
    assetRoot = join(f.paths.root, "public-assets");
  for (const path of assets.assets) {
    await mkdir(join(assetRoot, "assets"), { recursive: true });
    await writeFile(join(assetRoot, path.slice(1)), path.endsWith(".css") ? "body{}" : "fixture");
  }
  const store = createGenerationStore(f.paths, assetRoot),
    base = makePublicSnapshot({ postCount: 0 });
  base.categories = [];
  await withContentEnvironmentLock(f.paths, async (lease) => {
    const rendered = await renderContentGeneration(base, assets, "https://bibistudio.vn");
    await store.prepare(rendered, lease);
    await store.activate(base.generationId, null, lease);
  });
  const activeRead = async () => (await readActiveContent(f.paths))?.snapshot ?? null,
    editing = createContentEditing({ ...f, media: f.media, activeRead }),
    canaries = [];
  const publication = createContentPublication({
    ...f,
    assets,
    assetRoot,
    origin: "https://bibistudio.vn",
    canary: async (active) => {
      canaries.push(active?.manifest.id ?? null);
    },
  });
  const image = await sharp({
      create: { width: 600, height: 400, channels: 3, background: "#aabbcc" },
    })
      .png()
      .toBuffer(),
    uploaded = await f.media.upload(f.admin, {
      originalName: "test.png",
      mimeType: "image/png",
      bytes: image,
    });
  const category = await editing.saveCategory(f.admin, null, validCategory(), null),
    categoryJob = await publication.request(f.admin, {
      action: "apply-category",
      targetId: category.id,
      expectedRevision: category.revision,
      idempotencyKey: randomUUID(),
    });
  await publication.reconcile();
  if ((await publication.status(f.admin, categoryJob.id)).status !== "succeeded")
    throw Error("Fixture category publication failed");
  const previousId = (await readActiveContent(f.paths)).manifest.id;
  canaries.length = 0;
  return {
    ...f,
    editing,
    assets,
    assetRoot,
    previousId,
    publication,
    context: publication.context,
    canaries,
    database: f.dbConfig,
    removeAsset: () => unlink(join(assetRoot, assets.script.slice(1))),
    makePost: (slug) =>
      editing.saveDraft(
        f.admin,
        null,
        validDraft({
          slug,
          title: slug,
          categoryId: category.id,
          coverMediaId: uploaded.id,
          coverAlt: "Ảnh bìa",
        }),
        null,
      ),
  };
}
