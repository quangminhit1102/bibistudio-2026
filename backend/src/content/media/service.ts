import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../../config";
import type { AuthPrincipal } from "../../auth/service";
import type { Page } from "../../http/contracts";
import { ApiError } from "../../http/errors";
import { lockAuthorizedUsers, withRbacWrite } from "../../authorization/transaction";
import { withTransaction } from "../../db/transaction";
import { writeAudit } from "../../audit/repository";
import type { ContentPaths, MediaDto, MediaVariant } from "../contracts";
import { assertContentSchemaReady } from "../schema";
import { serverMediaId } from "../rich-policy";
import { CONTENT_LIMITS as L } from "../limits";
import { withContentEnvironmentLock } from "../environment-lock";
import { activeContentRequest, normalizeContentImage } from "./codec";
import { createContentMediaStore } from "./store";
type Connection = Pool | PoolConnection;
export function createContentMedia({
  pool,
  paths,
  clock,
  codec = normalizeContentImage,
}: {
  pool: Pool;
  paths: ContentPaths;
  clock: Clock;
  codec?: typeof normalizeContentImage;
}) {
  const store = createContentMediaStore(paths);
  async function authorize(c: PoolConnection, actor: AuthPrincipal, upload = false) {
    const { principal } = await lockAuthorizedUsers(
      c,
      actor,
      upload ? undefined : "post.view",
      clock,
    );
    await assertContentSchemaReady(c);
    if (
      upload &&
      !principal.fullAccess &&
      !principal.permissions.some((code) => ["post.create", "post.update"].includes(code))
    )
      throw new ApiError(403, "FORBIDDEN", "Bạn không có quyền tải ảnh nội dung");
    return principal;
  }
  async function dto(c: Connection, id: string): Promise<MediaDto> {
    const [[row]] = await c.execute<RowDataPacket[]>(
      "SELECT * FROM content_media WHERE id=? AND state='complete'",
      [id],
    );
    if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
    const [variants] = await c.execute<RowDataPacket[]>(
      "SELECT * FROM content_media_variants WHERE media_id=? ORDER BY width,height,name",
      [id],
    );
    return {
      id: String(row.id),
      originalName: String(row.original_name),
      width: Number(row.width),
      height: Number(row.height),
      variants: variants.map((variant) => ({
        hash: String(variant.hash),
        file: String(variant.file),
        mime: variant.mime as MediaVariant["mime"],
        width: Number(variant.width),
        height: Number(variant.height),
        bytes: Number(variant.bytes),
      })),
    };
  }
  async function preflight(actor: AuthPrincipal): Promise<void> {
    await withTransaction(pool, async (c) => {
      await authorize(c, actor, true);
    });
  }
  return {
    preflight,
    async upload(
      actor: AuthPrincipal,
      input: { bytes: Buffer; mimeType: string; originalName: string },
      signal?: AbortSignal,
    ): Promise<MediaDto> {
      activeContentRequest(signal);
      await preflight(actor);
      activeContentRequest(signal);
      if (!Buffer.isBuffer(input.bytes) || input.bytes.length > L.mediaBytes)
        throw new ApiError(413, "CONTENT_IMAGE_TOO_LARGE", "Dùng ảnh tối đa5MiB và16MP");
      const originalName =
        typeof input.originalName === "string"
          ? input.originalName.split(/[\\/]/).at(-1)!.trim()
          : "";
      if (
        !originalName ||
        [...originalName].length > 255 ||
        [...originalName].some((c) => c.charCodeAt(0) < 32)
      )
        throw new ApiError(400, "INVALID_CONTENT_IMAGE", "Tên ảnh không hợp lệ");
      const image = await codec(input.bytes, input.mimeType, signal);
      activeContentRequest(signal);
      const id = randomUUID();
      return withContentEnvironmentLock(paths, async (lease) => {
        await preflight(actor);
        activeContentRequest(signal);
        lease.assertActive();
        const variants = await store.write(id, image, lease);
        activeContentRequest(signal);
        // Final files are immutable. If commit acknowledgement is lost they remain
        // private for reconciliation; never delete a potentially committed asset.
        return withRbacWrite(
          pool,
          async (c) => {
            const principal = await authorize(c, actor, true);
            activeContentRequest(signal);
            lease.assertActive();
            await c.execute(
              "INSERT INTO content_media(id,original_name,mime,width,height,original_bytes,state,created_by,created_at) VALUES(?,?,?,?,?,?,'complete',?,?)",
              [
                id,
                originalName,
                "image/webp",
                image.width,
                image.height,
                input.bytes.length,
                principal.id,
                clock.now(),
              ],
            );
            for (let n = 0; n < variants.length; n++) {
              const variant = variants[n];
              await c.execute(
                "INSERT INTO content_media_variants(media_id,name,hash,file,mime,width,height,bytes) VALUES(?,?,?,?,?,?,?,?)",
                [
                  id,
                  image.variants[n].name,
                  variant.hash,
                  variant.file,
                  variant.mime,
                  variant.width,
                  variant.height,
                  variant.bytes,
                ],
              );
            }
            await writeAudit(c, {
              actorId: principal.id,
              action: "content.media.upload",
              targetType: "content_media",
              targetId: id,
              metadata: { variantCount: variants.length },
            });
            return dto(c, id);
          },
          {
            beforeCommit() {
              activeContentRequest(signal);
              lease.assertActive();
            },
          },
        );
      });
    },
    async list(
      actor: AuthPrincipal,
      input: { page: number; pageSize: number; search?: string },
    ): Promise<Page<MediaDto>> {
      const { page, pageSize, search = "" } = input;
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > 1000000 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100 ||
        search.length > 100
      )
        throw new ApiError(400, "INVALID_CONTENT_INPUT", "Bộ lọc không hợp lệ");
      return withTransaction(pool, async (c) => {
        await authorize(c, actor);
        const where = "state='complete' AND original_name LIKE ?",
          like = `%${search}%`;
        const [[count]] = await c.execute<RowDataPacket[]>(
          `SELECT COUNT(*) total FROM content_media WHERE ${where}`,
          [like],
        );
        const [rows] = await c.query<RowDataPacket[]>(
          `SELECT id FROM content_media WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
          [like, pageSize, (page - 1) * pageSize],
        );
        return {
          items: await Promise.all(rows.map((row) => dto(c, String(row.id)))),
          total: Number(count.total),
          page,
          pageSize,
        };
      });
    },
    async readPrivate(
      actor: AuthPrincipal,
      id: string,
      variantHash: string,
    ): Promise<{ bytes: Buffer; mimeType: string }> {
      if (!serverMediaId(id) || !/^[a-f0-9]{64}$/.test(variantHash))
        throw new ApiError(400, "INVALID_CONTENT_INPUT", "Tham chiếu ảnh không hợp lệ");
      const value = await withTransaction(pool, async (c) => {
        await authorize(c, actor);
        return dto(c, id);
      });
      const variant = value.variants.find((item) => item.hash === variantHash);
      if (!variant) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
      return { bytes: await store.read(id, variant), mimeType: variant.mime };
    },
    async references(ids: string[]): Promise<MediaDto[]> {
      const unique = [...new Set(ids)];
      if (unique.length > 1000 || unique.some((id) => !serverMediaId(id)))
        throw new ApiError(400, "INVALID_MEDIA_REFERENCE", "Ảnh tham chiếu không hợp lệ");
      const result: MediaDto[] = [];
      for (const id of unique) {
        try {
          result.push(await dto(pool, id));
        } catch (error) {
          if (error instanceof ApiError && error.status === 404)
            throw new ApiError(400, "INVALID_MEDIA_REFERENCE", "Ảnh tham chiếu không tồn tại");
          throw error;
        }
      }
      return result;
    },
  };
}
export type ContentMedia = ReturnType<typeof createContentMedia>;
