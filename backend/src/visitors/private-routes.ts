import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/service";
import { authenticate, requirePermission } from "../authorization/middleware";
import { validate } from "../http/validation";
import type { createVisitorService } from "./service";

const pagination = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
const filters = pagination
  .extend({
    search: z.string().max(100).default(""),
    deviceType: z.enum(["mobile", "tablet", "desktop"]).optional(),
    browser: z.string().max(50).optional(),
    product: z.string().max(160).optional(),
  })
  .strict();
export function visitorReadRoutes(
  service: ReturnType<typeof createVisitorService>,
  auth: AuthService,
): Router {
  const router = Router();
  router.use(authenticate(auth), requirePermission("customer_access.view"));
  router.get("/", async (req, res) => res.json(await service.list(validate(filters, req.query))));
  router.get("/filter-options", async (_req, res) => res.json(await service.filterOptions()));
  router.get("/report", async (_req, res) => res.json(await service.report()));
  router.get("/:id/sessions", async (req, res) =>
    res.json(await service.sessions(String(req.params.id), validate(pagination, req.query))),
  );
  router.get("/:id", async (req, res) => res.json(await service.get(String(req.params.id))));
  return router;
}
