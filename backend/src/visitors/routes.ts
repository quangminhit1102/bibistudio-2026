import { Router } from "express";
import type { Pool } from "mysql2/promise";
import { type Clock, systemClock } from "../config";
import { ApiError } from "../http/errors";
import { requireBrowserOrigin, type SecurityConfig } from "../http/security";
import type { Catalogue } from "./catalogue";
import { collectVisitor } from "./collector";
import { ANALYTICS_TTL_MS } from "./normalize";
import { verifyProbeMarker } from "./probe";

export interface AnalyticsOptions {
  pool: Pool;
  idSecret: string;
  catalogue: Catalogue;
  cookieSecure: boolean;
  probeSecret?: string;
}
export const ANALYTICS_COOKIE = "bibi_visitor";
export function analyticsRoutes(
  options: AnalyticsOptions,
  security: SecurityConfig,
  clock: Clock = systemClock,
  releaseId = "",
): Router {
  const router = Router();
  let active = 0;
  const cookieOptions = {
    httpOnly: true,
    secure: options.cookieSecure,
    sameSite: "lax" as const,
    path: "/api/analytics",
  };
  router.use(requireBrowserOrigin(security));
  router.post("/collect", async (req, res) => {
    // No collector queue: reserve the small dedicated pool for two active batches.
    if (active >= 2) throw new ApiError(503, "COLLECTOR_BUSY", "Vui lòng thử lại sau");
    active++;
    try {
      const marker = req.get("X-Bibi-Probe");
      const now = clock.now();
      const result = await collectVisitor(options.pool, req.body, {
        cookie:
          typeof req.cookies?.[ANALYTICS_COOKIE] === "string"
            ? req.cookies[ANALYTICS_COOKIE]
            : undefined,
        ip: req.ip ?? "unknown",
        userAgent: req.get("user-agent") ?? "",
        now,
        idSecret: options.idSecret,
        catalogue: options.catalogue,
        doNotTrack: req.get("DNT") === "1" || req.get("Sec-GPC") === "1",
        probe: marker ? verifyProbeMarker(marker, options.probeSecret, releaseId, now) : undefined,
      });
      if (result.cookie)
        res.cookie(ANALYTICS_COOKIE, result.cookie.value, {
          ...cookieOptions,
          maxAge: ANALYTICS_TTL_MS,
        });
      res.status(result.status).end();
    } finally {
      active--;
    }
  });
  router.post("/opt-out", (_req, res) => {
    res.clearCookie(ANALYTICS_COOKIE, cookieOptions);
    res.status(204).end();
  });
  return router;
}
