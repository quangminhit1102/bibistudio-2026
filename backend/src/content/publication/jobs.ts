import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../../config";
import type { AuthPrincipal } from "../../auth/service";
import { resolvePrincipal, type UserRow } from "../../auth/repository";
import { lockAuthorizedUsers, withRbacWrite } from "../../authorization/transaction";
import { assertPermission } from "../../authorization/permissions";
import { ApiError } from "../../http/errors";
import { assertContentSchemaReady } from "../schema";
import { categoryRow, postRow, expectRevision, jsonValue } from "../repository";
import type { PublicationJob, PublicationRequest } from "../contracts";
const requestSchema = z
  .strictObject({
    action: z.enum(["publish", "unpublish", "trash", "apply-category", "delete-category"]),
    targetId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    idempotencyKey: z.uuid(),
    categoryRevisionToApply: z.number().int().positive().optional(),
  })
  .refine((value) => value.categoryRevisionToApply === undefined || value.action === "publish");
export function validatePublicationRequest(raw: unknown): PublicationRequest {
  const value = requestSchema.safeParse(raw);
  if (!value.success)
    throw new ApiError(400, "INVALID_CONTENT_INPUT", "Yêu cầu xuất bản không hợp lệ");
  return value.data;
}
export const isCategory = (input: PublicationRequest) =>
  input.action === "apply-category" || input.action === "delete-category";
export function publicationDto(row: RowDataPacket): PublicationJob {
  return {
    id: String(row.id),
    status: row.status,
    generationId: row.generation_id ?? null,
    error: row.error_json ? jsonValue(row.error_json) : null,
  };
}
export async function authorizePublication(
  c: PoolConnection,
  actor: AuthPrincipal,
  input: PublicationRequest,
  clock: Clock,
) {
  const category = isCategory(input),
    { principal } = await lockAuthorizedUsers(
      c,
      actor,
      category ? "content_category.view" : "post.view",
      clock,
    );
  assertPermission(principal, category ? "content_category.publish" : "post.publish");
  if (input.action === "trash") assertPermission(principal, "post.delete");
  if (input.action === "delete-category") assertPermission(principal, "content_category.delete");
  if (input.categoryRevisionToApply !== undefined) {
    assertPermission(principal, "content_category.view");
    assertPermission(principal, "content_category.publish");
  }
  await assertContentSchemaReady(c);
  return principal;
}
export async function checkPublicationTarget(c: PoolConnection, input: PublicationRequest) {
  const row = await (isCategory(input) ? categoryRow : postRow)(c, input.targetId, true);
  expectRevision(row, input.expectedRevision);
  if (!isCategory(input) && row.trashed_at)
    throw new ApiError(409, "POST_TRASHED", "Khôi phục bài trước khi xuất bản");
  if (input.categoryRevisionToApply !== undefined) {
    const categoryId = jsonValue<{ categoryId: string | null }>(row.draft_json).categoryId;
    if (!categoryId) throw new ApiError(400, "CATEGORY_REQUIRED", "Chọn danh mục trước khi đăng");
    expectRevision(await categoryRow(c, categoryId, true), input.categoryRevisionToApply);
  }
  if (input.action === "delete-category") {
    const [[counts]] = await c.execute<RowDataPacket[]>(
      "SELECT (SELECT COUNT(*) FROM content_posts WHERE category_id=?) posts,(SELECT COUNT(*) FROM content_categories WHERE parent_id=?) children",
      [input.targetId, input.targetId],
    );
    if (Number(counts.posts) || Number(counts.children))
      throw new ApiError(
        409,
        "CATEGORY_REFERENCED",
        `Danh mục còn ${Number(counts.children)} danh mục con và ${Number(counts.posts)} bài viết, kể cả nháp và thùng rác`,
      );
  }
  return row;
}
export async function storedActor(c: PoolConnection, row: RowDataPacket): Promise<AuthPrincipal> {
  const [[user]] = await c.execute<UserRow[]>("SELECT * FROM users WHERE id=?", [row.actor_id]);
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Phiên đăng nhập không còn hiệu lực");
  return {
    principal: await resolvePrincipal(c, user),
    sid: String(row.session_id),
    authVersion: Number(row.auth_version),
  };
}
export function createPublicationJobs({
  pool,
  clock,
  wake,
}: {
  pool: Pool;
  clock: Clock;
  wake: () => void;
}) {
  return {
    async request(actor: AuthPrincipal, raw: PublicationRequest): Promise<PublicationJob> {
      const input = validatePublicationRequest(raw),
        payload = JSON.stringify({
          action: input.action,
          targetId: input.targetId,
          expectedRevision: input.expectedRevision,
          ...(input.categoryRevisionToApply === undefined
            ? {}
            : { categoryRevisionToApply: input.categoryRevisionToApply }),
        }),
        hash = createHash("sha256").update(payload).digest("hex");
      const result = await withRbacWrite(pool, async (c) => {
        await authorizePublication(c, actor, input, clock);
        const [[existing]] = await c.execute<RowDataPacket[]>(
          "SELECT * FROM content_publication_jobs WHERE actor_id=? AND idempotency_key=? FOR UPDATE",
          [actor.principal.id, input.idempotencyKey],
        );
        if (existing) {
          if (existing.payload_hash !== hash)
            throw new ApiError(
              409,
              "IDEMPOTENCY_CONFLICT",
              "Khóa thử lại đã dùng cho yêu cầu khác",
            );
          return publicationDto(existing);
        }
        await checkPublicationTarget(c, input);
        const id = randomUUID();
        await c.execute(
          "INSERT INTO content_publication_jobs(id,actor_id,session_id,auth_version,action,target_id,expected_revision,idempotency_key,payload_hash,request_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'queued',?,?)",
          [
            id,
            actor.principal.id,
            actor.sid,
            actor.authVersion,
            input.action,
            input.targetId,
            input.expectedRevision,
            input.idempotencyKey,
            hash,
            JSON.stringify(input),
            clock.now(),
            clock.now(),
          ],
        );
        return { id, status: "queued" as const, generationId: null, error: null };
      });
      wake();
      return result;
    },
    async status(actor: AuthPrincipal, id: string): Promise<PublicationJob> {
      if (!z.uuid().safeParse(id).success)
        throw new ApiError(400, "INVALID_CONTENT_INPUT", "ID không hợp lệ");
      const result = await withRbacWrite(pool, async (c) => {
        const [[row]] = await c.execute<RowDataPacket[]>(
          "SELECT * FROM content_publication_jobs WHERE id=?",
          [id],
        );
        if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy lần xuất bản");
        const input = validatePublicationRequest(jsonValue(row.request_json)),
          { principal } = await lockAuthorizedUsers(
            c,
            actor,
            isCategory(input) ? "content_category.view" : "post.view",
            clock,
          );
        if (row.actor_id !== principal.id && !principal.fullAccess)
          throw new ApiError(403, "FORBIDDEN", "Không thể xem lần xuất bản này");
        return publicationDto(row);
      });
      wake();
      return result;
    },
  };
}
