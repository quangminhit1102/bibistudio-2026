import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";
import { sqlDate } from "../auth/repository";
import type {
  CategoryDto,
  CategoryInput,
  PostDto,
  PostDraftInput,
  PublicSnapshot,
} from "./contracts";
type Connection = Pool | PoolConnection;
export const jsonValue = <T>(value: unknown): T =>
  typeof value === "string" ? JSON.parse(value) : (value as T);
export const iso = (value: unknown) => sqlDate(value as string).toISOString();
export async function postRow(c: Connection, id: string, lock = false): Promise<RowDataPacket> {
  const [[row]] = await c.execute<RowDataPacket[]>(
    `SELECT * FROM content_posts WHERE id=?${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
  if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy bài viết");
  return row;
}
export async function categoryRow(c: Connection, id: string, lock = false): Promise<RowDataPacket> {
  const [[row]] = await c.execute<RowDataPacket[]>(
    `SELECT * FROM content_categories WHERE id=?${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
  if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy danh mục");
  return row;
}
export function postDto(row: RowDataPacket, active: PublicSnapshot | null): PostDto {
  const published = active?.posts.find((post) => post.id === row.id);
  return {
    ...jsonValue<PostDraftInput>(row.draft_json),
    id: String(row.id),
    revision: Number(row.revision),
    trashedAt: row.trashed_at ? iso(row.trashed_at) : null,
    updatedAt: iso(row.updated_at),
    public: published
      ? {
          snapshotId: published.snapshotId,
          draftRevision: published.draftRevision,
          slug: published.slug,
          publishedAt: published.publishedAt,
          modifiedAt: published.modifiedAt,
        }
      : null,
  };
}
export function categoryDto(row: RowDataPacket, active: PublicSnapshot | null): CategoryDto {
  const published = active?.categories.find((category) => category.id === row.id);
  return {
    ...jsonValue<CategoryInput>(row.draft_json),
    id: String(row.id),
    revision: Number(row.revision),
    publicRevision: published?.revision ?? null,
  };
}
export function expectRevision(row: RowDataPacket, expected: number | null) {
  if (!Number.isSafeInteger(expected) || Number(expected) < 1)
    throw new ApiError(400, "INVALID_REVISION", "Phiên bản không hợp lệ");
  if (row.revision !== expected)
    throw new ApiError(409, "REVISION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại");
}
export async function reserveSlug(
  c: PoolConnection,
  kind: "post" | "category",
  id: string,
  slug: string,
  now: Date,
) {
  const [[reservation]] = await c.execute<RowDataPacket[]>(
    "SELECT target_id FROM content_slug_reservations WHERE kind=? AND slug=? FOR UPDATE",
    [kind, slug],
  );
  if (reservation && reservation.target_id !== id)
    throw new ApiError(409, "SLUG_TAKEN", "Slug đã được sử dụng hoặc được giữ cho URL cũ");
  await c.execute(
    "UPDATE content_slug_reservations SET is_canonical=0 WHERE kind=? AND target_id=?",
    [kind, id],
  );
  await c.execute(
    "INSERT INTO content_slug_reservations(kind,slug,target_id,is_canonical,created_at) VALUES(?,?,?,1,?) ON DUPLICATE KEY UPDATE is_canonical=1",
    [kind, slug, id, now],
  );
}
export async function syncDraftTags(
  c: PoolConnection,
  postId: string,
  tags: string[],
  id: () => string,
) {
  await c.execute("DELETE FROM content_post_tags WHERE post_id=?", [postId]);
  for (const name of tags) {
    const normalized = name.normalize("NFC").toLocaleLowerCase("vi");
    await c.execute("INSERT IGNORE INTO content_tags(id,name,normalized_name) VALUES(?,?,?)", [
      id(),
      name.normalize("NFC"),
      normalized,
    ]);
    const [[tag]] = await c.execute<RowDataPacket[]>(
      "SELECT id FROM content_tags WHERE normalized_name=?",
      [normalized],
    );
    await c.execute("INSERT INTO content_post_tags(post_id,tag_id) VALUES(?,?)", [postId, tag.id]);
  }
}
export async function syncDraftMedia(c: PoolConnection, postId: string, ids: string[]) {
  await c.execute("DELETE FROM content_media_references WHERE owner_type='post' AND owner_id=?", [
    postId,
  ]);
  for (const id of [...new Set(ids)])
    await c.execute(
      "INSERT INTO content_media_references(owner_type,owner_id,media_id) VALUES('post',?,?)",
      [postId, id],
    );
}
