import { readFile, realpath, lstat } from "node:fs/promises";
import { join, sep } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import { withRbacWrite } from "../authorization/transaction";
import { writeAudit } from "../audit/repository";
import type { ContentMedia } from "./media/service";
import type { MediaDto, PostDraftInput, PublishedPost } from "./contracts";
import { assertContentSchemaReady } from "./schema";
import { validateCategory, validatePostDraft, normalizeContentSlug } from "./validation";
import { sanitizePostContent } from "./sanitize";
import { escapeContentHtml as escape } from "./rich-policy";
import { reserveSlug, syncDraftMedia } from "./repository";
import { CONTENT_LIMITS as L } from "./limits";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const imageFile = z.string().regex(/^images\/[a-f0-9]{64}\.(?:jpe?g|png|webp)$/);
const slug = z
  .string()
  .max(L.slug)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().max(L.inputBytes);
const block = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("paragraph"), text }),
  z.strictObject({
    type: z.literal("heading"),
    text,
    level: z.union([z.literal(2), z.literal(3)]).optional(),
  }),
  z.strictObject({
    type: z.literal("image"),
    src: imageFile,
    alt: z.string().max(L.description),
    caption: z.string().max(L.description).optional(),
  }),
  z.strictObject({ type: z.literal("quote"), text }),
]);
const schema = z.strictObject({
  schemaVersion: z.literal(1),
  posts: z
    .array(
      z.strictObject({
        sourceKey: z.string().max(100),
        slug,
        title: z.string().min(1).max(L.title),
        excerpt: z.string().max(L.description),
        category: z.string().min(1).max(L.title),
        author: z.string().max(L.title),
        date: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
        readTime: z.string().max(100),
        coverImage: imageFile,
        content: z.array(block).max(L.nodes),
        relatedHandles: z.array(slug).max(100),
      }),
    )
    .max(10000),
  images: z
    .array(
      z.strictObject({
        file: imageFile,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        bytes: z.number().int().positive().max(L.mediaBytes),
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
        originalName: z.string().min(1).max(255),
      }),
    )
    .max(10000),
});
export type ContentSeed = z.infer<typeof schema>;
async function contained(root: string, file: string, max: number): Promise<Buffer> {
  try {
    const name = join(root, file),
      actual = await realpath(name),
      info = await lstat(name);
    if (
      !actual.startsWith(root + sep) ||
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.size > max
    )
      throw Error();
    return await readFile(actual);
  } catch {
    throw Error("Invalid seed file or image path");
  }
}
export async function verifyContentSeed(seedDirectory: string): Promise<ContentSeed> {
  const root = await realpath(seedDirectory),
    manifest = await contained(root, "seed.json", 8 * 1024 ** 2),
    expected = (await contained(root, "seed.sha256", 1024)).toString("utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(expected) || sha(manifest) !== expected)
    throw Error("Seed digest mismatch");
  let seed: ContentSeed;
  try {
    seed = schema.parse(JSON.parse(manifest.toString("utf8")));
  } catch {
    throw Error("Invalid seed manifest");
  }
  const files = new Map(seed.images.map((image) => [image.file, image]));
  if (
    files.size !== seed.images.length ||
    new Set(seed.posts.map((post) => post.sourceKey)).size !== seed.posts.length
  )
    throw Error("Invalid duplicate seed identity");
  for (const image of seed.images) {
    if (!image.file.startsWith(`images/${image.sha256}.`))
      throw Error("Seed image digest/name mismatch");
    const bytes = await contained(root, image.file, L.mediaBytes);
    if (bytes.length !== image.bytes || sha(bytes) !== image.sha256)
      throw Error("Seed image digest mismatch");
  }
  for (const post of seed.posts) {
    if (
      post.sourceKey !== "blog:" + post.slug ||
      !files.has(post.coverImage) ||
      post.content.some((item) => item.type === "image" && !files.has(item.src))
    )
      throw Error("Invalid seed post image/identity reference");
  }
  return seed;
}

// Fixed UUIDv5 namespace and names form a versioned import identity, never a user account.
export function seedId(kind: string, key: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex"))
    .update(`bibistudio.vn/content-seed/v1/${kind}/${key}`)
    .digest()
    .subarray(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function importContentSeed({
  pool,
  media,
  seedDirectory,
  clock,
}: {
  pool: Pool;
  media: ContentMedia;
  seedDirectory: string;
  clock: Clock;
}): Promise<{ created: number; skipped: number }> {
  const seed = await verifyContentSeed(seedDirectory);
  if (!seed.posts.length) throw Error("Invalid empty source seed");
  await assertContentSchemaReady(pool);
  const [markers] = await pool.query<RowDataPacket[]>(
      `SELECT id,state FROM content_seed_imports WHERE id IN (${seed.posts.map(() => "?").join(",")})`,
      seed.posts.map((post) => post.sourceKey),
    ),
    completed = new Set(
      markers.filter((row) => row.state === "complete").map((row) => String(row.id)),
    );
  if (markers.some((row) => row.state !== "complete"))
    throw Error("Incomplete seed import requires inspection");
  const pending = seed.posts.filter((post) => !completed.has(post.sourceKey));
  if (!pending.length) return { created: 0, skipped: seed.posts.length };
  const systemId = seedId("system", "legacy-blog-import"),
    images = new Map<string, MediaDto>(),
    needed = new Set(
      pending.flatMap((post) => [
        post.coverImage,
        ...post.content.filter((block) => block.type === "image").map((block) => block.src),
      ]),
    );
  for (const image of seed.images.filter((image) => needed.has(image.file))) {
    const bytes = await contained(await realpath(seedDirectory), image.file, L.mediaBytes);
    if (sha(bytes) !== image.sha256) throw Error("Seed image digest changed before import");
    images.set(
      image.file,
      await media.importSeedImage({
        id: seedId("media", image.sha256),
        bytes,
        mimeType: image.mime,
        originalName: image.originalName,
        createdBy: systemId,
      }),
    );
  }
  const prepared: Array<{
    source: ContentSeed["posts"][number];
    categoryId: string;
    postId: string;
    draft: PostDraftInput;
    snapshot: PublishedPost;
    mediaIds: string[];
    createdAt: Date;
  }> = [];
  for (const source of pending) {
    const categoryKey = source.category.trim().normalize("NFC").toLocaleLowerCase("vi"),
      categoryId = seedId("category", categoryKey),
      postId = seedId("post", source.sourceKey);
    const html = source.content
        .map((block) => {
          if (block.type === "image") {
            const image = images.get(block.src)!;
            return `<figure><img data-media-id="${image.id}" alt="${escape(block.alt)}">${block.caption ? `<figcaption>${escape(block.caption)}</figcaption>` : ""}</figure>`;
          }
          if (block.type === "heading")
            return `<h${block.level ?? 2}>${escape(block.text)}</h${block.level ?? 2}>`;
          if (block.type === "quote")
            return `<blockquote><p>${escape(block.text)}</p></blockquote>`;
          return `<p>${escape(block.text)}</p>`;
        })
        .join("\n"),
      sanitized = await sanitizePostContent(JSON.stringify({ format: "html-v1", html }));
    if (!sanitized.plainText) throw Error("Invalid empty seed article");
    const cover = images.get(source.coverImage)!,
      draft: PostDraftInput = validatePostDraft({
        title: source.title,
        slug: source.slug,
        excerpt: source.excerpt,
        content: sanitized.content,
        categoryId,
        tags: [],
        author: { kind: "brand" },
        coverMediaId: cover.id,
        coverAlt: source.title,
        seoTitle: "",
        seoDescription: "",
      }),
      mediaIds = [...new Set([cover.id, ...sanitized.mediaIds])];
    const snapshot: PublishedPost = {
      id: postId,
      snapshotId: seedId("snapshot", source.sourceKey + ":1"),
      draftRevision: 1,
      title: draft.title,
      slug: draft.slug,
      excerpt: draft.excerpt,
      html: sanitized.html,
      categoryId,
      tags: [],
      author: { kind: "brand", name: "BiBi Studio" },
      coverMediaId: cover.id,
      coverAlt: draft.coverAlt,
      seoTitle: "",
      seoDescription: "",
      publishedAt: source.date,
      modifiedAt: source.date,
      mediaIds,
    };
    prepared.push({
      source,
      categoryId,
      postId,
      draft,
      snapshot,
      mediaIds,
      createdAt: new Date(
        source.date.length === 10 ? source.date + "T00:00:00+07:00" : source.date,
      ),
    });
  }
  return withRbacWrite(pool, async (c) => {
    await assertContentSchemaReady(c);
    let created = 0;
    const categories = new Set<string>();
    for (const item of prepared) {
      const [[marker]] = await c.execute<RowDataPacket[]>(
        "SELECT state FROM content_seed_imports WHERE id=? FOR UPDATE",
        [item.source.sourceKey],
      );
      if (marker) {
        if (marker.state !== "complete") throw Error("Incomplete seed import requires inspection");
        continue;
      }
      if (!categories.has(item.categoryId)) {
        const [[existing]] = await c.execute<RowDataPacket[]>(
          "SELECT id FROM content_categories WHERE id=? FOR UPDATE",
          [item.categoryId],
        );
        if (!existing) {
          const input = validateCategory({
            name: item.source.category,
            slug: normalizeContentSlug(item.source.category),
            description: "",
            parentId: null,
            position: categories.size,
            active: true,
            seoTitle: "",
            seoDescription: "",
          });
          await reserveSlug(c, "category", item.categoryId, input.slug, clock.now());
          await c.execute(
            "INSERT INTO content_categories(id,normalized_slug,parent_id,position,active,draft_json,created_at,updated_at) VALUES(?,?,NULL,?,1,?,?,?)",
            [
              item.categoryId,
              input.slug,
              input.position,
              JSON.stringify(input),
              clock.now(),
              clock.now(),
            ],
          );
          await c.execute(
            "INSERT INTO content_category_revisions(category_id,revision,data_json,created_by,created_at) VALUES(?,1,?,?,?)",
            [item.categoryId, JSON.stringify(input), systemId, clock.now()],
          );
        }
        categories.add(item.categoryId);
      }
      await c.execute(
        "INSERT INTO content_seed_imports(id,checksum,state,created_at) VALUES(?,?,'in_progress',?)",
        [item.source.sourceKey, sha(Buffer.from(JSON.stringify(item.source))), clock.now()],
      );
      await reserveSlug(c, "post", item.postId, item.draft.slug, clock.now());
      await c.execute(
        "INSERT INTO content_posts(id,normalized_slug,category_id,draft_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        [
          item.postId,
          item.draft.slug,
          item.categoryId,
          JSON.stringify(item.draft),
          systemId,
          item.createdAt,
          clock.now(),
        ],
      );
      await c.execute(
        "INSERT INTO content_post_revisions(post_id,revision,data_json,created_by,created_at) VALUES(?,1,?,?,?)",
        [item.postId, JSON.stringify(item.draft), systemId, clock.now()],
      );
      await syncDraftMedia(c, item.postId, item.mediaIds);
      await c.execute(
        "INSERT INTO content_published_snapshots(id,post_id,draft_revision,snapshot_json,created_at) VALUES(?,?,1,?,?)",
        [item.snapshot.snapshotId, item.postId, JSON.stringify(item.snapshot), clock.now()],
      );
      for (const imageId of item.mediaIds)
        await c.execute(
          "INSERT INTO content_media_references(owner_type,owner_id,media_id) VALUES('snapshot',?,?)",
          [item.snapshot.snapshotId, imageId],
        );
      await c.execute(
        "UPDATE content_seed_imports SET state='complete',imported_count=1,completed_at=? WHERE id=?",
        [clock.now(), item.source.sourceKey],
      );
      await writeAudit(c, {
        action: "content.seed.import",
        targetType: "content_post",
        targetId: item.postId,
        metadata: { reason: "legacy-blog-seed", revision: 1 },
      });
      created++;
    }
    return { created, skipped: seed.posts.length - created };
  });
}
