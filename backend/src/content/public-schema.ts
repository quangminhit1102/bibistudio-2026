import { z } from "zod";
import { CONTENT_LIMITS as L } from "./limits";
import { serverMediaId } from "./rich-policy";
import { normalizeContentSlug } from "./validation";
import type { PublicSnapshot, PublicAssetManifest } from "./contracts";
const id = z.string().refine(serverMediaId),
  text = (max: number) => z.string().refine((value) => [...value].length <= max),
  date = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
const slug = z.string().refine((value) => {
  try {
    return normalizeContentSlug(value) === value;
  } catch {
    return false;
  }
});
const category = z
  .strictObject({
    id,
    revision: z.number().int().positive(),
    publicRevision: z.number().int().positive(),
    name: text(L.title),
    slug,
    description: text(L.description),
    parentId: id.nullable(),
    position: z.number().int().min(0).max(1000000),
    active: z.boolean(),
    seoTitle: text(L.title),
    seoDescription: text(L.description),
  })
  .refine((value) => value.publicRevision === value.revision);
const variant = z.strictObject({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  file: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9]{64}\.(?:webp|png|jpg)$/),
  mime: z.enum(["image/webp", "image/jpeg", "image/png"]),
  width: z.number().int().positive().max(L.mediaEdge),
  height: z.number().int().positive().max(L.mediaEdge),
  bytes: z
    .number()
    .int()
    .positive()
    .max(32 * 1024 ** 2),
});
const post = z.strictObject({
  id,
  snapshotId: id,
  draftRevision: z.number().int().positive(),
  title: text(L.title),
  slug,
  excerpt: text(L.description),
  html: z.string().refine((value) => Buffer.byteLength(value) <= L.bodyBytes),
  categoryId: id,
  tags: z.array(text(L.tag)).max(L.tags),
  author: z.strictObject({ kind: z.enum(["brand", "account"]), name: text(L.title) }),
  coverMediaId: id,
  coverAlt: text(L.description),
  seoTitle: text(L.title),
  seoDescription: text(L.description),
  publishedAt: date,
  modifiedAt: date,
  mediaIds: z.array(id).max(L.nodes),
});
const snapshot = z.strictObject({
  schemaVersion: z.literal(1),
  generationId: id,
  posts: z.array(post).max(10000),
  categories: z.array(category).max(10000),
  redirects: z.record(z.string(), z.string()),
  media: z.record(z.string(), variant),
  routes: z.array(z.strictObject({ path: z.string().max(1000), label: text(600) })).max(100000),
  committedAt: date,
});
export function parsePublicSnapshot(input: unknown): PublicSnapshot {
  const parsed = snapshot.safeParse(input);
  if (!parsed.success) throw Error("Invalid public snapshot");
  const value = parsed.data,
    categories = new Map(value.categories.map((category) => [category.id, category]));
  if (
    categories.size !== value.categories.length ||
    new Set(value.categories.map((category) => category.slug)).size !== value.categories.length ||
    new Set(value.posts.map((post) => post.id)).size !== value.posts.length ||
    new Set(value.posts.map((post) => post.slug)).size !== value.posts.length
  )
    throw Error("Invalid public snapshot identity");
  for (const category of value.categories) {
    const seen = new Set<string>();
    let current: typeof category | undefined = category;
    while (current) {
      if (seen.has(current.id) || seen.size >= L.categoryDepth)
        throw Error("Invalid public category tree");
      seen.add(current.id);
      if (current.parentId && !categories.has(current.parentId))
        throw Error("Invalid public category parent");
      current = current.parentId ? categories.get(current.parentId) : undefined;
    }
  }
  const mediaIds = new Set<string>();
  for (const [key, image] of Object.entries(value.media)) {
    const [mediaId, file] = image.file.split("/"),
      extension = image.mime === "image/jpeg" ? "jpg" : image.mime.split("/")[1];
    if (key !== image.file || !serverMediaId(mediaId) || file !== `${image.hash}.${extension}`)
      throw Error("Invalid public media registry");
    mediaIds.add(mediaId);
  }
  for (const post of value.posts)
    if (
      !post.title.trim() ||
      !post.coverAlt.trim() ||
      !categories.has(post.categoryId) ||
      !post.mediaIds.includes(post.coverMediaId) ||
      post.mediaIds.some((id) => !mediaIds.has(id)) ||
      new Set(post.mediaIds).size !== post.mediaIds.length ||
      Date.parse(post.modifiedAt) < Date.parse(post.publishedAt)
    )
      throw Error("Invalid public post references");
  return value;
}
export function publicOrigin(value: string): string {
  const url = new URL(value);
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("Invalid public canonical origin");
  return url.origin;
}
export function publicAssetPath(value: string): boolean {
  return (
    /^\/assets\/[A-Za-z0-9_./-]+\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/.test(value) &&
    !value.split("/").some((part) => part === "." || part === "..") &&
    !/(?:admin|tinymce)/i.test(value)
  );
}
export function parsePublicAssets(input: PublicAssetManifest): PublicAssetManifest {
  if (
    input.schemaVersion !== 1 ||
    !input.rendererVersion ||
    !Array.isArray(input.assets) ||
    !input.assets.length ||
    !Array.isArray(input.css) ||
    !input.css.length ||
    !input.script?.endsWith(".js") ||
    !publicAssetPath(input.script) ||
    input.css.some((path) => !publicAssetPath(path) || !path.endsWith(".css")) ||
    input.assets.some((path) => !publicAssetPath(path)) ||
    ![input.script, ...input.css].every((path) => input.assets.includes(path)) ||
    !Array.isArray(input.staticRoutes)
  )
    throw Error("Invalid public asset manifest");
  return input;
}
