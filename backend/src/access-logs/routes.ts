import { Router } from "express";
import { z } from "zod";
import type { Pool } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthService } from "../auth/service";
import { authenticate, requirePermission } from "../authorization/middleware";
import { validate } from "../http/validation";
import { createAccessLogReadService, requireAccessLogSchema } from "./read-service";
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
  );
const filters = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .max(Math.floor(Number.MAX_SAFE_INTEGER / 100))
      .default(1),
    pageSize: z.coerce
      .number()
      .refine((value) => [20, 50, 100].includes(value))
      .default(20),
    search: z.string().max(100).default(""),
    from: day.optional(),
    to: day.optional(),
    ipPrefix: z.string().max(64).optional(),
    pathname: z.string().max(2048).optional(),
    status: z.coerce.number().int().min(100).max(599).optional(),
    resourceKind: z.enum(["page", "asset", "api", "other"]).optional(),
    isBot: z.enum(["true", "false"]).optional(),
    parseStatus: z.enum(["parsed", "error"]).optional(),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to);
export function accessLogRoutes(
  pool: Pool,
  directory: string,
  clock: Clock,
  auth: AuthService,
): Router {
  const router = Router(),
    service = createAccessLogReadService(pool, clock);
  router.use(authenticate(auth), requirePermission("customer_access.view"));
  router.use(async (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    await requireAccessLogSchema(pool, directory);
    next();
  });
  router.get("/", async (req, res) => res.json(await service.list(validate(filters, req.query))));
  router.get("/status", async (_req, res) => res.json(await service.status()));
  router.get("/:id", async (req, res) =>
    res.json(await service.get(validate(z.string().regex(/^[a-f0-9]{64}$/), req.params.id))),
  );
  return router;
}
