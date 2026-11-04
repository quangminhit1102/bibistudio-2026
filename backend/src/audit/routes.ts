import { Router } from "express";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import type { AuthService } from "../auth/service";
import { authenticate, requirePermission } from "../authorization/middleware";
import { validate } from "../http/validation";
import { systemClock, type Clock } from "../config";
import { listAudit } from "./service";
export function auditRoutes(pool: Pool, auth: AuthService, clock: Clock = systemClock): Router {
  const router = Router();
  router.use(authenticate(auth), requirePermission("audit.view"));
  router.get("/", async (req, res) => {
    const query = validate(
      z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
          search: z.string().max(100).default(""),
        })
        .strict(),
      req.query,
    );
    res.json(await listAudit(pool, clock, query, req.auth!));
  });
  return router;
}
