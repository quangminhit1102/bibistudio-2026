import { Router } from "express";
import { z } from "zod";
import type { Pool } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthService } from "../auth/service";
import { consumeRateLimit } from "../auth/throttle";
import { ApiError } from "../http/errors";
import { networkPrefix } from "../http/network";
import { authenticate } from "../authorization/middleware";
import { requireBrowserOrigin, type SecurityConfig } from "../http/security";
import { validate } from "../http/validation";
import { phoneSchema } from "./validation";
import type { ProfileService } from "./service";
export function profileRoutes(
  service: ProfileService,
  auth: AuthService,
  config: SecurityConfig,
  { pool, clock }: { pool: Pool; clock: Clock },
): Router {
  const router = Router();
  const bytes = (max: number) => (value: string) => Buffer.byteLength(value, "utf8") <= max;
  router.use(authenticate(auth));
  router.get("/", async (req, res) => res.json(await service.getSelf(req.auth!)));
  router.patch("/", requireBrowserOrigin(config), async (req, res) => {
    const { revision, ...input } = validate(
      z
        .object({
          revision: z.number().int().positive(),
          displayName: z.string().trim().min(1).max(160).optional(),
          email: z.email().max(254).nullable().optional(),
          phone: phoneSchema,
        })
        .strict()
        .refine((v) =>
          Object.entries(v).some(([key, value]) => key !== "revision" && value !== undefined),
        ),
      req.body,
    );
    res.json(await service.updateSelf(input, revision, req.auth!));
  });
  router.post("/password", requireBrowserOrigin(config), async (req, res) => {
    // Every attempt counts, right or wrong: the form is a place to guess the current password.
    for (const [bucket, limit] of [
      [`profile-password:account:${req.auth!.principal.id}`, 5],
      [`profile-password:network:${networkPrefix(req.ip ?? "")}`, 30],
    ] as const) {
      const decision = await consumeRateLimit(
        pool,
        bucket,
        { limit, windowMs: 15 * 60 * 1000 },
        clock.now(),
      );
      if (!decision.allowed) {
        res.setHeader("Retry-After", decision.retryAfterSeconds);
        throw new ApiError(429, "RATE_LIMITED", "Vui lòng thử lại sau");
      }
    }
    const input = validate(
      z
        .object({
          currentPassword: z.string().min(1).refine(bytes(72)),
          newPassword: z.string().min(8).refine(bytes(72)),
        })
        .strict(),
      req.body,
    );
    res.json(await service.changePassword(input, req.auth!));
  });
  return router;
}
