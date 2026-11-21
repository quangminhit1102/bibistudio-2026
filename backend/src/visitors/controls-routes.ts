import { Router } from "express";
import type { AuthService } from "../auth/service";
import { authenticate, requirePermission } from "../authorization/middleware";
import { requireBrowserOrigin, requireBrowserHeaders, type SecurityConfig } from "../http/security";
import { validate } from "../http/validation";
import { z } from "zod";
import type { createVisitorControlsService } from "./controls-service";
export function visitorControlsRoutes(
  service: ReturnType<typeof createVisitorControlsService>,
  auth: AuthService,
  config: SecurityConfig,
): Router {
  const r = Router();
  const view = [authenticate(auth), requirePermission("customer_access.view")];
  const browser = requireBrowserOrigin(config);
  r.get(
    "/exclusions",
    ...view,
    requirePermission("customer_access.manage_exclusions"),
    async (req, res) => res.json(await service.getExclusions(req.auth!)),
  );
  r.put(
    "/exclusions",
    ...view,
    browser,
    requirePermission("customer_access.manage_exclusions"),
    async (req, res) => res.json(await service.setExclusions(req.body, req.auth!)),
  );
  r.post(
    "/bulk-delete",
    ...view,
    browser,
    requirePermission("customer_access.delete"),
    async (req, res) => {
      const { ids } = validate(
        z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).strict(),
        req.body,
      );
      res.json(await service.deleteVisitors(ids, req.auth!));
    },
  );
  r.delete(
    "/:id/sessions/:sessionId",
    ...view,
    requireBrowserHeaders(config),
    requirePermission("customer_access.delete"),
    async (req, res) =>
      res.json(
        await service.deleteSession(String(req.params.id), String(req.params.sessionId), req.auth!),
      ),
  );
  r.delete(
    "/:id",
    ...view,
    requireBrowserHeaders(config),
    requirePermission("customer_access.delete"),
    async (req, res) => res.json(await service.deleteVisitors([String(req.params.id)], req.auth!)),
  );
  return r;
}
