import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import type { Page } from "../http/contracts";
import { ApiError } from "../http/errors";
import { withRbacWrite, lockAuthorizedUsers } from "../authorization/transaction";
import { assertPermission } from "../authorization/permissions";
import { withTransaction } from "../db/transaction";
import { writeAudit } from "../audit/repository";
import { assertContentSchemaReady } from "./schema";
import { validatePostDraft, validateCategory } from "./validation";
import { sanitizePostContent } from "./sanitize";
import { serverMediaId } from "./rich-policy";
import {
  postRow,
  postDto,
  categoryRow,
  categoryDto,
  expectRevision,
  reserveSlug,
  syncDraftTags,
  syncDraftMedia,
  jsonValue,
} from "./repository";
import { assertCategoryPlacement, assertDraftCategory } from "./categories";
import type {
  ContentPaths,
  ContentListInput,
  CategoryInput,
  PostDraftInput,
  PostDto,
  CategoryDto,
  PublicSnapshot,
} from "./contracts";
import type { ContentMedia } from "./media/service";
export type ActiveContentRead = () => Promise<PublicSnapshot | null>;
export function createContentEditing({
  pool,
  clock,
  media,
  activeRead,
}: {
  pool: Pool;
  paths: ContentPaths;
  clock: Clock;
  media: ContentMedia;
  activeRead: ActiveContentRead;
}) {
  async function authorize(c: PoolConnection, actor: AuthPrincipal, permission: string) {
    const view = permission.startsWith("content_category.") ? "content_category.view" : "post.view";
    const { principal } = await lockAuthorizedUsers(c, actor, view, clock);
    assertPermission(principal, permission);
    await assertContentSchemaReady(c);
    return principal;
  }
  async function preflight(actor: AuthPrincipal, permission: string) {
    await withTransaction(pool, async (c) => {
      await authorize(c, actor, permission);
    });
  }
  function id(value: string) {
    if (!serverMediaId(value)) throw new ApiError(400, "INVALID_CONTENT_INPUT", "ID không hợp lệ");
    return value;
  }
  function page(input: { page: number; pageSize: number; search?: string }) {
    if (
      !Number.isInteger(input.page) ||
      input.page < 1 ||
      input.page > 1000000 ||
      !Number.isInteger(input.pageSize) ||
      input.pageSize < 1 ||
      input.pageSize > 100 ||
      (input.search?.length ?? 0) > 100
    )
      throw new ApiError(400, "INVALID_CONTENT_INPUT", "Bộ lọc không hợp lệ");
  }
  function audit(
    c: PoolConnection,
    actorId: string,
    action: string,
    type: string,
    targetId: string,
    revision: number,
  ) {
    return writeAudit(c, { actorId, action, targetType: type, targetId, metadata: { revision } });
  }
  async function saveDraft(
    actor: AuthPrincipal,
    targetId: string | null,
    raw: PostDraftInput,
    expectedRevision: number | null,
  ): Promise<PostDto> {
    if (targetId) id(targetId);
    else if (expectedRevision !== null)
      throw new ApiError(400, "INVALID_REVISION", "Bài mới chưa có phiên bản");
    const permission = targetId ? "post.update" : "post.create";
    await preflight(actor, permission);
    const input = validatePostDraft(raw),
      sanitized = await sanitizePostContent(input.content);
    input.content = sanitized.content;
    const references = [
      ...new Set([...sanitized.mediaIds, ...(input.coverMediaId ? [input.coverMediaId] : [])]),
    ];
    await media.references(references);
    return withRbacWrite(pool, async (c) => {
      const principal = await authorize(c, actor, permission),
        previous = targetId ? await postRow(c, targetId, true) : null;
      if (previous) {
        expectRevision(previous, expectedRevision);
        if (previous.trashed_at)
          throw new ApiError(409, "POST_TRASHED", "Khôi phục bài viết trước khi chỉnh sửa");
      }
      await assertDraftCategory(
        c,
        input.categoryId,
        previous ? jsonValue<PostDraftInput>(previous.draft_json).categoryId : null,
      );
      if (input.author.kind === "account") {
        const [[author]] = await c.execute<RowDataPacket[]>(
          "SELECT id FROM users WHERE id=? AND active=1 AND deleted_at IS NULL",
          [input.author.id],
        );
        if (!author) throw new ApiError(400, "INVALID_AUTHOR", "Tác giả không còn hoạt động");
      }
      const postId = targetId ?? randomUUID(),
        revision = previous ? Number(previous.revision) + 1 : 1;
      await reserveSlug(c, "post", postId, input.slug, clock.now());
      if (previous)
        await c.execute(
          "UPDATE content_posts SET draft_json=?,normalized_slug=?,category_id=?,revision=?,updated_at=? WHERE id=?",
          [JSON.stringify(input), input.slug, input.categoryId, revision, clock.now(), postId],
        );
      else
        await c.execute(
          "INSERT INTO content_posts(id,normalized_slug,category_id,draft_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
          [
            postId,
            input.slug,
            input.categoryId,
            JSON.stringify(input),
            principal.id,
            clock.now(),
            clock.now(),
          ],
        );
      await c.execute(
        "INSERT INTO content_post_revisions(post_id,revision,data_json,created_by,created_at) VALUES(?,?,?,?,?)",
        [postId, revision, JSON.stringify(input), principal.id, clock.now()],
      );
      await syncDraftTags(c, postId, input.tags, randomUUID);
      await syncDraftMedia(c, postId, references);
      await audit(c, principal.id, "content.post.save", "content_post", postId, revision);
      return postDto(await postRow(c, postId), await activeRead());
    });
  }
  async function get(actor: AuthPrincipal, targetId: string): Promise<PostDto> {
    id(targetId);
    return withTransaction(pool, async (c) => {
      await authorize(c, actor, "post.view");
      return postDto(await postRow(c, targetId), await activeRead());
    });
  }
  async function changeTrash(
    actor: AuthPrincipal,
    targetId: string,
    expectedRevision: number,
    restore: boolean,
  ): Promise<PostDto> {
    id(targetId);
    return withRbacWrite(pool, async (c) => {
      const principal = await authorize(c, actor, restore ? "post.restore" : "post.delete"),
        row = await postRow(c, targetId, true);
      expectRevision(row, expectedRevision);
      const active = await activeRead();
      if (active?.posts.some((post) => post.id === targetId))
        throw new ApiError(
          409,
          "PUBLICATION_REQUIRED",
          "Thay đổi bài công khai phải đi qua xuất bản",
        );
      if (restore ? !row.trashed_at : !!row.trashed_at)
        throw new ApiError(409, "REVISION_CONFLICT", "Trạng thái bài đã thay đổi");
      const revision = Number(row.revision) + 1;
      await c.execute("UPDATE content_posts SET trashed_at=?,revision=?,updated_at=? WHERE id=?", [
        restore ? null : clock.now(),
        revision,
        clock.now(),
        targetId,
      ]);
      await c.execute(
        "INSERT INTO content_post_revisions(post_id,revision,data_json,created_by,created_at) VALUES(?,?,?,?,?)",
        [
          targetId,
          revision,
          typeof row.draft_json === "string" ? row.draft_json : JSON.stringify(row.draft_json),
          principal.id,
          clock.now(),
        ],
      );
      await audit(
        c,
        principal.id,
        restore ? "content.post.restore" : "content.post.trash",
        "content_post",
        targetId,
        revision,
      );
      return postDto(await postRow(c, targetId), active);
    });
  }
  return {
    saveDraft,
    get,
    preflight,
    async list(actor: AuthPrincipal, input: ContentListInput): Promise<Page<PostDto>> {
      page(input);
      if (input.categoryId) id(input.categoryId);
      return withTransaction(pool, async (c) => {
        await authorize(c, actor, "post.view");
        const active = await activeRead(),
          where: string[] = [],
          values: unknown[] = [];
        where.push(input.status === "trash" ? "trashed_at IS NOT NULL" : "trashed_at IS NULL");
        if (input.search) {
          where.push("JSON_UNQUOTE(JSON_EXTRACT(draft_json,'$.title')) LIKE ?");
          values.push(`%${input.search}%`);
        }
        if (input.categoryId) {
          where.push("category_id=?");
          values.push(input.categoryId);
        }
        if (input.status === "published" || input.status === "draft") {
          const published = active?.posts.map((post) => post.id) ?? [];
          if (published.length) {
            where.push(
              `id ${input.status === "draft" ? "NOT " : ""}IN (${published.map(() => "?").join(",")})`,
            );
            values.push(...published);
          } else if (input.status === "published") where.push("1=0");
        }
        const clause = where.join(" AND "),
          [[count]] = await c.query<RowDataPacket[]>(
            `SELECT COUNT(*) total FROM content_posts WHERE ${clause}`,
            values,
          );
        const published = input.sort === "published_desc" ? (active?.posts ?? []) : [],
          orderValues: unknown[] = [];
        const publishedOrder = published.length
          ? `CASE id ${published
              .map((post) => {
                orderValues.push(post.id, Date.parse(post.publishedAt));
                return "WHEN ? THEN ?";
              })
              .join(" ")} ELSE 0 END DESC,`
          : "";
        const [rows] = await c.query<RowDataPacket[]>(
          `SELECT * FROM content_posts WHERE ${clause} ORDER BY ${publishedOrder}updated_at DESC,id DESC LIMIT ? OFFSET ?`,
          [...values, ...orderValues, input.pageSize, (input.page - 1) * input.pageSize],
        );
        return {
          items: rows.map((row) => postDto(row, active)),
          total: Number(count.total),
          page: input.page,
          pageSize: input.pageSize,
        };
      });
    },
    async duplicate(actor: AuthPrincipal, targetId: string): Promise<PostDto> {
      const source = await get(actor, targetId),
        {
          title,
          slug,
          excerpt,
          content,
          categoryId,
          tags,
          author,
          coverMediaId,
          coverAlt,
          seoTitle,
          seoDescription,
        } = source;
      return saveDraft(
        actor,
        null,
        {
          title: [...title].slice(0, 288).join("") + " (bản sao)",
          slug: slug.slice(0, 178) + "-ban-sao-" + randomUUID().slice(0, 8),
          excerpt,
          content,
          categoryId,
          tags,
          author,
          coverMediaId,
          coverAlt,
          seoTitle,
          seoDescription,
        },
        null,
      );
    },
    trashDraft: (actor: AuthPrincipal, targetId: string, revision: number) =>
      changeTrash(actor, targetId, revision, false),
    restoreDraft: (actor: AuthPrincipal, targetId: string, revision: number) =>
      changeTrash(actor, targetId, revision, true),
    async saveCategory(
      actor: AuthPrincipal,
      targetId: string | null,
      raw: CategoryInput,
      expectedRevision: number | null,
    ): Promise<CategoryDto> {
      if (targetId) id(targetId);
      else if (expectedRevision !== null)
        throw new ApiError(400, "INVALID_REVISION", "Danh mục mới chưa có phiên bản");
      const input = validateCategory(raw);
      return withRbacWrite(pool, async (c) => {
        const principal = await authorize(
            c,
            actor,
            targetId ? "content_category.update" : "content_category.create",
          ),
          previous = targetId ? await categoryRow(c, targetId, true) : null;
        if (previous) expectRevision(previous, expectedRevision);
        const categoryId = targetId ?? randomUUID(),
          revision = previous ? Number(previous.revision) + 1 : 1;
        await assertCategoryPlacement(c, categoryId, input.parentId);
        await reserveSlug(c, "category", categoryId, input.slug, clock.now());
        if (previous)
          await c.execute(
            "UPDATE content_categories SET draft_json=?,normalized_slug=?,parent_id=?,position=?,active=?,revision=?,updated_at=? WHERE id=?",
            [
              JSON.stringify(input),
              input.slug,
              input.parentId,
              input.position,
              input.active,
              revision,
              clock.now(),
              categoryId,
            ],
          );
        else
          await c.execute(
            "INSERT INTO content_categories(id,normalized_slug,parent_id,position,active,draft_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
            [
              categoryId,
              input.slug,
              input.parentId,
              input.position,
              input.active,
              JSON.stringify(input),
              clock.now(),
              clock.now(),
            ],
          );
        await c.execute(
          "INSERT INTO content_category_revisions(category_id,revision,data_json,created_by,created_at) VALUES(?,?,?,?,?)",
          [categoryId, revision, JSON.stringify(input), principal.id, clock.now()],
        );
        await audit(
          c,
          principal.id,
          "content.category.save",
          "content_category",
          categoryId,
          revision,
        );
        return categoryDto(await categoryRow(c, categoryId), await activeRead());
      });
    },
    async getCategory(actor: AuthPrincipal, targetId: string): Promise<CategoryDto> {
      id(targetId);
      return withTransaction(pool, async (c) => {
        await authorize(c, actor, "content_category.view");
        return categoryDto(await categoryRow(c, targetId), await activeRead());
      });
    },
    async listCategories(
      actor: AuthPrincipal,
      input: { page: number; pageSize: number; search?: string },
    ): Promise<Page<CategoryDto>> {
      page(input);
      return withTransaction(pool, async (c) => {
        await authorize(c, actor, "content_category.view");
        const like = `%${input.search ?? ""}%`,
          [[count]] = await c.execute<RowDataPacket[]>(
            "SELECT COUNT(*) total FROM content_categories WHERE JSON_UNQUOTE(JSON_EXTRACT(draft_json,'$.name')) LIKE ?",
            [like],
          );
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM content_categories WHERE JSON_UNQUOTE(JSON_EXTRACT(draft_json,'$.name')) LIKE ? ORDER BY position,id LIMIT ? OFFSET ?",
          [like, input.pageSize, (input.page - 1) * input.pageSize],
        );
        const active = await activeRead();
        return {
          items: rows.map((row) => categoryDto(row, active)),
          total: Number(count.total),
          page: input.page,
          pageSize: input.pageSize,
        };
      });
    },
    async removeUnusedCategory(
      actor: AuthPrincipal,
      targetId: string,
      expectedRevision: number,
    ): Promise<void> {
      id(targetId);
      await withRbacWrite(pool, async (c) => {
        const principal = await authorize(c, actor, "content_category.delete"),
          row = await categoryRow(c, targetId, true);
        expectRevision(row, expectedRevision);
        if (
          row.public_revision ||
          (await activeRead())?.categories.some((category) => category.id === targetId)
        )
          throw new ApiError(
            409,
            "PUBLICATION_REQUIRED",
            "Danh mục công khai phải được gỡ qua xuất bản",
          );
        const [[references]] = await c.execute<RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM content_posts WHERE category_id=?) posts,(SELECT COUNT(*) FROM content_categories WHERE parent_id=?) children",
          [targetId, targetId],
        );
        if (Number(references.posts) || Number(references.children))
          throw new ApiError(
            409,
            "CATEGORY_REFERENCED",
            `Danh mục còn ${Number(references.children)} danh mục con và ${Number(references.posts)} bài viết, kể cả nháp và thùng rác`,
          );
        await c.execute("DELETE FROM content_category_revisions WHERE category_id=?", [targetId]);
        await c.execute("DELETE FROM content_categories WHERE id=?", [targetId]);
        await c.execute(
          "DELETE FROM content_slug_reservations WHERE kind='category' AND target_id=?",
          [targetId],
        );
        await audit(
          c,
          principal.id,
          "content.category.remove",
          "content_category",
          targetId,
          Number(row.revision),
        );
      });
    },
  };
}
export type ContentEditing = ReturnType<typeof createContentEditing>;
