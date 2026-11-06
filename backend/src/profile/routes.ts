import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/service";
import { authenticate } from "../authorization/middleware";
import { requireBrowserOrigin, type SecurityConfig } from "../http/security";
import { validate } from "../http/validation";
import { phoneSchema } from "./validation";
import type { ProfileService } from "./service";
export function profileRoutes(
  service: ProfileService,
  auth: AuthService,
  config: SecurityConfig,
): Router {
  const router = Router();
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
  return router;
}
