import express, { Router } from "express";
import { z } from "zod";
import type { Pool } from "mysql2/promise";
import type { Clock } from "../../config";
import type { AuthService } from "../../auth/service";
import { authenticate } from "../../authorization/middleware";
import { consumeRateLimit } from "../../auth/throttle";
import { requireBrowserOrigin, type SecurityConfig } from "../../http/security";
import { ApiError } from "../../http/errors";
import { validate } from "../../http/validation";
import { CONTENT_LIMITS as L } from "../limits";
import type { ContentMedia } from "./service";
export function mediaRoutes(
  service: ContentMedia,
  auth: AuthService,
  config: SecurityConfig,
  { pool, clock }: { pool: Pool; clock: Clock },
): Router {
  const router = Router(),
    path = "/api/content/media";
  router.get(path, authenticate(auth), async (req, res) =>
    res.json(
      await service.list(
        req.auth!,
        validate(
          z.object({
            page: z.coerce.number().int().min(1).max(1000000).default(1),
            pageSize: z.coerce.number().int().min(1).max(100).default(20),
            search: z.string().max(100).optional(),
          }),
          req.query,
        ),
      ),
    ),
  );
  router.get(path + "/:id", authenticate(auth), async (req, res) =>
    res.json(await service.get(req.auth!, validate(z.uuid(), req.params.id))),
  );
  router.get(path + "/:id/:hash", authenticate(auth), async (req, res) => {
    const image = await service.readPrivate(
      req.auth!,
      validate(z.uuid(), req.params.id),
      validate(z.string().regex(/^[a-f0-9]{64}$/), req.params.hash),
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.type(image.mimeType).send(image.bytes);
  });
  router.post(
    path,
    authenticate(auth),
    requireBrowserOrigin(config),
    async (req, res, next) => {
      await service.preflight(req.auth!);
      const decision = await consumeRateLimit(
        pool,
        "content-media:" + req.auth!.principal.id,
        { limit: 30, windowMs: 15 * 60 * 1000 },
        clock.now(),
      );
      if (!decision.allowed) {
        res.setHeader("Retry-After", decision.retryAfterSeconds);
        throw new ApiError(
          429,
          "CONTENT_MEDIA_RATE_LIMIT",
          "Bạn tải ảnh quá nhanh, vui lòng thử lại",
        );
      }
      next();
    },
    express.json({ limit: L.mediaJsonBytes, strict: true }),
    async (req, res) => {
      const input = validate(
        z.strictObject({
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          originalName: z.string().min(1).max(255),
          data: z.string().min(1),
        }),
        req.body,
      );
      if (input.data.length > L.mediaBase64Bytes)
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dùng ảnh tối đa5MiB");
      if (input.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data))
        throw new ApiError(400, "INVALID_MEDIA_ENCODING", "Dữ liệu ảnh không hợp lệ");
      const bytes = Buffer.from(input.data, "base64");
      if (bytes.length > L.mediaBytes)
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dùng ảnh tối đa5MiB");
      if (bytes.toString("base64") !== input.data)
        throw new ApiError(400, "INVALID_MEDIA_ENCODING", "Dữ liệu ảnh không hợp lệ");
      const controller = new AbortController(),
        abort = () => controller.abort(),
        closed = () => {
          if (!res.writableEnded) abort();
        };
      req.once("aborted", abort);
      res.once("close", closed);
      if (req.aborted || res.destroyed) abort();
      try {
        res
          .status(201)
          .json(
            await service.upload(
              req.auth!,
              { bytes, mimeType: input.mimeType, originalName: input.originalName },
              controller.signal,
            ),
          );
      } catch (error) {
        if (!res.destroyed) throw error;
      } finally {
        req.off("aborted", abort);
        res.off("close", closed);
      }
    },
  );
  return router;
}
