import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthService } from "../auth/service";
import { authenticate } from "../authorization/middleware";
import { hasPermission } from "../authorization/permissions";
import { requireBrowserHeaders, type SecurityConfig } from "../http/security";
import { ApiError } from "../http/errors";
import { validate } from "../http/validation";
import { avatarHeader } from "../profile/avatar-header";
import type { MediaStore } from "./media-store";

const requireMediaCreate: RequestHandler = (req, _res, next) => {
  try {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
    if (
      !hasPermission(req.auth.principal, "product.create") &&
      !hasPermission(req.auth.principal, "post.create")
    )
      throw new ApiError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này");
    next();
  } catch (error) {
    next(error);
  }
};

export function mediaRoutes(
  store: MediaStore,
  auth: AuthService,
  config: SecurityConfig,
  { pool, clock }: { pool: Pool; clock: Clock },
): Router {
  const router = Router(),
    browser = requireBrowserHeaders(config);
  router.post(
    "/",
    authenticate(auth),
    browser,
    requireMediaCreate,
    express.json({ limit: 2797228, strict: true }),
    async (req, res) => {
      const envelope = validate(
        z
          .object({ mimeType: z.enum(["image/png", "image/jpeg"]), data: z.string().min(1) })
          .strict(),
        req.body,
      );
      if (envelope.data.length > 2796204)
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dùng ảnh tối đa 2 MiB");
      if (envelope.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(envelope.data))
        throw new ApiError(400, "INVALID_MEDIA_ENCODING", "Dữ liệu ảnh không hợp lệ");
      const bytes = Buffer.from(envelope.data, "base64");
      if (bytes.length > 2097152)
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dùng ảnh tối đa 2 MiB");
      if (bytes.toString("base64") !== envelope.data)
        throw new ApiError(400, "INVALID_MEDIA_ENCODING", "Dữ liệu ảnh không hợp lệ");
      let width: number, height: number;
      try {
        ({ width, height } = avatarHeader(bytes, envelope.mimeType));
      } catch (error) {
        if (error instanceof ApiError && error.code === "AVATAR_TOO_LARGE")
          throw new ApiError(413, "MEDIA_TOO_LARGE", "Ảnh tối đa 2 MiB");
        if (error instanceof ApiError && error.code === "AVATAR_FORMAT")
          throw new ApiError(415, "MEDIA_FORMAT", "Dùng ảnh JPEG hoặc PNG");
        throw new ApiError(422, "INVALID_MEDIA", "Ảnh không hợp lệ hoặc đã bị hỏng");
      }
      const stored = await store.save(bytes, envelope.mimeType, width, height);
      try {
        await pool.execute(
          "INSERT INTO media (id,mime,size,width,height,path,created_at,updated_at,revision) VALUES (?,?,?,?,?,?,?,?,1)",
          [
            stored.id,
            envelope.mimeType,
            bytes.length,
            width,
            height,
            stored.path,
            clock.now(),
            clock.now(),
          ],
        );
      } catch (error) {
        await store.remove(stored.id).catch(() => {});
        throw error;
      }
      res.status(201).json({ id: stored.id, width, height, size: bytes.length });
    },
  );
  router.get("/:id", async (req, res) => {
    const id = validate(z.uuid(), req.params.id);
    const [[row]] = await pool.execute<RowDataPacket[]>("SELECT * FROM media WHERE id=?", [id]);
    if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy tệp phương tiện");
    const bytes = await store.read(id);
    if (bytes.length !== Number(row.size))
      throw new ApiError(503, "MEDIA_UNAVAILABLE", "Không đọc được tệp phương tiện lúc này");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.type(String(row.mime)).send(bytes);
  });
  return router;
}
