import express, { Router, type Request } from "express";
import { z } from "zod";
import type { Pool } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthService } from "../auth/service";
import { authenticate } from "../authorization/middleware";
import { consumeRateLimit } from "../auth/throttle";
import { requireBrowserHeaders, type SecurityConfig } from "../http/security";
import { ApiError } from "../http/errors";
import { validate } from "../http/validation";
import type { ProfileService } from "./service";
function revision(req: Request): number {
  const header = req.get("If-Match");
  if (!header)
    throw new ApiError(
      428,
      "PRECONDITION_REQUIRED",
      "Vui lòng tải lại thông tin trước khi thay ảnh",
    );
  if (!/^"[1-9]\d{0,9}"$/.test(header))
    throw new ApiError(400, "INVALID_REVISION", "Phiên bản dữ liệu không hợp lệ");
  return Number(header.slice(1, -1));
}
export function avatarRoutes(
  service: ProfileService,
  auth: AuthService,
  config: SecurityConfig,
  { pool, clock }: { pool: Pool; clock: Clock },
): Router {
  const router = Router(),
    browser = requireBrowserHeaders(config);
  for (const management of [false, true]) {
    const path = management ? "/api/accounts/:id/avatar" : "/api/profile/avatar";
    const target = (req: Request) => (management ? validate(z.uuid(), req.params.id) : undefined);
    router.get(path + "/:assetId", authenticate(auth), async (req, res) => {
      const image = await service.readAvatar(
        target(req),
        validate(z.uuid(), req.params.assetId),
        req.auth!,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.type(image.format === "jpeg" ? "image/jpeg" : "image/png").send(image.bytes);
    });
    router.put(
      path,
      authenticate(auth),
      browser,
      async (req, res, next) => {
        const version = revision(req);
        await service.preflightAvatar(target(req), version, req.auth!);
        const mime = (req.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
        if (!["image/png", "image/jpeg"].includes(mime))
          throw new ApiError(415, "AVATAR_FORMAT", "Dùng ảnh JPEG hoặc PNG");
        const decision = await consumeRateLimit(
          pool,
          "avatar-upload:" + req.auth!.principal.id,
          { limit: 10, windowMs: 15 * 60 * 1000 },
          clock.now(),
        );
        if (!decision.allowed) {
          res.setHeader("Retry-After", decision.retryAfterSeconds);
          throw new ApiError(
            429,
            "AVATAR_RATE_LIMIT",
            "Bạn đổi ảnh quá nhanh. Vui lòng thử lại sau",
          );
        }
        res.locals.avatarRevision = version;
        res.locals.avatarMime = mime;
        next();
      },
      express.raw({ type: () => true, limit: 2097152 }),
      async (req, res) => {
        if (!Buffer.isBuffer(req.body) || !req.body.length)
          throw new ApiError(400, "AVATAR_REQUIRED", "Vui lòng chọn ảnh");
        const controller = new AbortController(),
          abort = () => controller.abort(),
          closed = () => {
            if (!res.writableEnded) abort();
          };
        req.once("aborted", abort);
        res.once("close", closed);
        if (req.aborted || res.destroyed) abort();
        try {
          res.json(
            await service.replaceAvatar(
              target(req),
              req.body,
              res.locals.avatarMime,
              res.locals.avatarRevision,
              req.auth!,
              { signal: controller.signal },
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
    router.delete(path, authenticate(auth), browser, async (req, res) =>
      res.json(await service.removeAvatar(target(req), revision(req), req.auth!)),
    );
  }
  return router;
}
