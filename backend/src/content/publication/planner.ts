import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../../config";
import type {
  CategoryDto,
  CategoryInput,
  MediaVariant,
  PostDraftInput,
  PublicationRequest,
  PublishedPost,
  PublicSnapshot,
} from "../contracts";
import type { ContentMedia } from "../media/service";
import { ApiError } from "../../http/errors";
import { jsonValue, categoryRow } from "../repository";
import { sanitizePostContent } from "../sanitize";
import { parsePublicSnapshot } from "../public-schema";
import { checkPublicationTarget } from "./jobs";
export interface PublicationPlan {
  snapshot: PublicSnapshot;
  newPost: PublishedPost | null;
  trashId: string | null;
  deleteCategoryId: string | null;
}
export async function capturePublication(
  c: PoolConnection,
  input: PublicationRequest,
  previous: PublicSnapshot | null,
) {
  const row = await checkPublicationTarget(c, input),
    category = input.action === "apply-category" || input.action === "delete-category";
  const targetCategory = category
    ? row
    : input.categoryRevisionToApply !== undefined
      ? await categoryRow(c, jsonValue<PostDraftInput>(row.draft_json).categoryId!, true)
      : null;
  let author: { kind: "brand" | "account"; name: string } = { kind: "brand", name: "BiBi Studio" };
  if (!category && input.action === "publish") {
    const draft = jsonValue<PostDraftInput>(row.draft_json);
    if (draft.author.kind === "account") {
      const [[user]] = await c.execute<RowDataPacket[]>(
        "SELECT display_name FROM users WHERE id=? AND active=1 AND deleted_at IS NULL",
        [draft.author.id],
      );
      if (!user) throw new ApiError(400, "INVALID_AUTHOR", "Tác giả không còn hoạt động");
      author = { kind: "account", name: String(user.display_name) };
    }
  }
  const [[existing]] = await c.execute<RowDataPacket[]>(
    "SELECT snapshot_json FROM content_published_snapshots WHERE post_id=? AND draft_revision=?",
    [input.targetId, input.expectedRevision],
  );
  const [history] =
    input.action === "publish"
      ? await c.execute<RowDataPacket[]>(
          "SELECT DISTINCT s.snapshot_json FROM content_generation_posts p JOIN content_generations g ON g.id=p.generation_id JOIN content_published_snapshots s ON s.id=p.snapshot_id WHERE g.state='committed' AND s.post_id=?",
          [input.targetId],
        )
      : [[]];
  const [generations] =
    targetCategory && input.action !== "delete-category"
      ? await c.query<RowDataPacket[]>(
          "SELECT id,manifest_sha256 FROM content_generations WHERE state='committed'",
        )
      : [[]];
  return {
    row,
    targetCategory,
    author,
    previous,
    existing: existing ? jsonValue<PublishedPost>(existing.snapshot_json) : null,
    history: history.map((row) => jsonValue<PublishedPost>(row.snapshot_json)),
    historyGenerations: generations.map((row) => ({
      id: String(row.id),
      hash: String(row.manifest_sha256),
    })),
    categoryAliases: [] as string[],
  };
}
export async function planPublication(
  captured: Awaited<ReturnType<typeof capturePublication>>,
  input: PublicationRequest,
  media: ContentMedia,
  clock: Clock,
): Promise<PublicationPlan> {
  const { row, targetCategory, author, previous } = captured,
    now = clock.now().toISOString(),
    snapshot: PublicSnapshot = previous
      ? structuredClone(previous)
      : {
          schemaVersion: 1,
          generationId: randomUUID(),
          posts: [],
          categories: [],
          redirects: {},
          media: {},
          routes: [],
          committedAt: now,
        };
  snapshot.generationId = randomUUID();
  snapshot.committedAt = now;
  snapshot.routes = [];
  let newPost: PublishedPost | null = null;
  if (targetCategory && input.action !== "delete-category") {
    const data = jsonValue<CategoryInput>(targetCategory.draft_json),
      category: CategoryDto = {
        ...data,
        id: String(targetCategory.id),
        revision: Number(targetCategory.revision),
        publicRevision: Number(targetCategory.revision),
      },
      old = snapshot.categories.find((item) => item.id === category.id);
    if (old && old.slug !== category.slug)
      redirectOwner(snapshot, "/blog/category/" + old.slug, "/blog/category/" + category.slug);
    for (const slug of captured.categoryAliases)
      if (slug !== category.slug)
        redirectOwner(snapshot, "/blog/category/" + slug, "/blog/category/" + category.slug);
    snapshot.categories = snapshot.categories
      .filter((item) => item.id !== category.id)
      .concat(category);
  }
  if (input.action === "delete-category") {
    if (
      snapshot.categories.some((item) => item.parentId === input.targetId) ||
      snapshot.posts.some((item) => item.categoryId === input.targetId)
    )
      throw new ApiError(
        409,
        "CATEGORY_REFERENCED",
        "Danh mục vẫn có danh mục con hoặc bài công khai",
      );
    snapshot.categories = snapshot.categories.filter((item) => item.id !== input.targetId);
    removeOwner(
      snapshot,
      "/blog/category/" + jsonValue<CategoryInput>(row.draft_json).slug,
      previous?.categories.find((item) => item.id === input.targetId)?.slug
        ? "/blog/category/" + previous.categories.find((item) => item.id === input.targetId)!.slug
        : undefined,
    );
  } else if (input.action === "publish") {
    const draft = jsonValue<PostDraftInput>(row.draft_json),
      category = snapshot.categories.find((item) => item.id === draft.categoryId);
    if (!category || !category.active || !draft.coverMediaId || !draft.coverAlt.trim())
      throw new ApiError(
        400,
        "PUBLICATION_INCOMPLETE",
        "Cần danh mục công khai, ảnh bìa và mô tả ảnh",
      );
    const sanitized = await sanitizePostContent(draft.content);
    if (!sanitized.plainText.trim())
      throw new ApiError(400, "PUBLICATION_INCOMPLETE", "Bài viết cần nội dung");
    const ids = [...new Set([draft.coverMediaId, ...sanitized.mediaIds])],
      resolved = await media.references(ids),
      old = snapshot.posts.find((item) => item.id === input.targetId);
    newPost = captured.existing ?? {
      id: input.targetId,
      snapshotId: randomUUID(),
      draftRevision: input.expectedRevision,
      title: draft.title,
      slug: draft.slug,
      excerpt: draft.excerpt,
      html: sanitized.html,
      categoryId: category.id,
      tags: draft.tags,
      author,
      coverMediaId: draft.coverMediaId,
      coverAlt: draft.coverAlt,
      seoTitle: draft.seoTitle,
      seoDescription: draft.seoDescription,
      publishedAt:
        old?.publishedAt ??
        captured.history
          .map((post) => post.publishedAt)
          .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ??
        now,
      modifiedAt: now,
      mediaIds: ids,
    };
    for (const image of resolved)
      for (const variant of image.variants) snapshot.media[variant.file] = variant;
    if (old && old.slug !== draft.slug)
      redirectOwner(snapshot, "/blog/" + old.slug, "/blog/" + draft.slug);
    for (const post of captured.history)
      if (post.slug !== newPost.slug)
        redirectOwner(snapshot, "/blog/" + post.slug, "/blog/" + newPost.slug);
    snapshot.posts = snapshot.posts.filter((item) => item.id !== input.targetId).concat(newPost);
  } else if (input.action === "unpublish" || input.action === "trash") {
    const old = snapshot.posts.find((item) => item.id === input.targetId);
    if (!old) throw new ApiError(409, "POST_NOT_PUBLIC", "Bài viết chưa được đăng");
    snapshot.posts = snapshot.posts.filter((item) => item.id !== input.targetId);
    removeOwner(snapshot, "/blog/" + old.slug);
  }
  // Validates the proposed PUBLIC tree, which may differ from the working tree.
  parsePublicSnapshot(snapshot);
  return {
    snapshot,
    newPost,
    trashId: input.action === "trash" ? input.targetId : null,
    deleteCategoryId: input.action === "delete-category" ? input.targetId : null,
  };
}
function redirectOwner(snapshot: PublicSnapshot, oldPath: string, next: string) {
  for (const [source, target] of Object.entries(snapshot.redirects))
    if (target === oldPath) snapshot.redirects[source] = next;
  delete snapshot.redirects[next];
  snapshot.redirects[oldPath] = next;
}
function removeOwner(snapshot: PublicSnapshot, ...paths: Array<string | undefined>) {
  for (const [source, target] of Object.entries(snapshot.redirects))
    if (paths.includes(target) || paths.includes(source)) delete snapshot.redirects[source];
}
