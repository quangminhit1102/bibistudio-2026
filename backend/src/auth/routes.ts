import { Router, type RequestHandler, type Response } from "express";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import type { AuthConfig, Clock } from "../config";
import { ApiError } from "../http/errors";
import { requireBrowserOrigin } from "../http/security";
import { validate } from "../http/validation";
import { networkPrefix } from "../http/network";
import { consumeRateLimit } from "./throttle";
import { hashRefresh } from "./tokens";
import type { AuthGrant, AuthService } from "./service";

const cookieName = "bibi_refresh";
export function authRoutes({
  auth,
  config,
  pool,
  clock,
}: {
  auth: AuthService;
  config: AuthConfig;
  pool: Pool;
  clock: Clock;
}): Router {
  const router = Router();
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax" as const,
    path: "/api/auth",
  };
  const browser = requireBrowserOrigin(config);
  const credentials = z
    .object({
      username: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[a-zA-Z0-9_.-]+$/),
      password: z
        .string()
        .min(1)
        .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
    })
    .strict();
  const grant = (res: Response, value: AuthGrant) => {
    res.cookie(cookieName, value.refreshToken, { ...cookieOptions, maxAge: 7 * 86400000 });
    res.json({
      accessToken: value.accessToken,
      expiresAt: value.expiresAt,
      profile: value.profile,
    });
  };
  const throttle =
    (kind: "login" | "refresh"): RequestHandler =>
    async (req, res, next) => {
      try {
        const key =
          kind === "login"
            ? String(req.body?.username ?? "")
                .trim()
                .toLowerCase()
            : hashRefresh(String(req.cookies?.[cookieName] ?? ""));
        for (const [bucket, limit] of [
          [`${kind}:network:${networkPrefix(req.ip ?? "")}`, kind === "login" ? 30 : 120],
          [`${kind}:identity:${key}`, kind === "login" ? 10 : 30],
        ] as const) {
          const decision = await consumeRateLimit(
            pool,
            bucket,
            { limit, windowMs: 60000 },
            clock.now(),
          );
          if (!decision.allowed) {
            res.setHeader("Retry-After", decision.retryAfterSeconds);
            throw new ApiError(429, "RATE_LIMITED", "Vui lòng thử lại sau");
          }
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  router.post("/login", browser, throttle("login"), async (req, res) => {
    grant(res, await auth.login(validate(credentials, req.body)));
  });
  router.post("/refresh", browser, throttle("refresh"), async (req, res) => {
    validate(z.object({}).strict(), req.body);
    try {
      grant(res, await auth.refresh(String(req.cookies?.[cookieName] ?? "")));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        res.clearCookie(cookieName, cookieOptions);
      throw error;
    }
  });
  router.post("/logout", browser, async (req, res) => {
    validate(z.object({}).strict(), req.body);
    await auth.logout(String(req.cookies?.[cookieName] ?? ""));
    res.clearCookie(cookieName, cookieOptions).sendStatus(204);
  });
  router.get("/profile", async (req, res) => {
    const header = req.get("authorization") ?? "";
    if (!header.startsWith("Bearer "))
      throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
    res.json((await auth.authenticate(header.slice(7))).principal);
  });
  router.post("/revoke", browser, async (req, res) => {
    const command = validate(z.object({ all: z.boolean().optional() }).strict(), req.body);
    const header = req.get("authorization") ?? "";
    if (!header.startsWith("Bearer "))
      throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại");
    await auth.revoke(await auth.authenticate(header.slice(7)), command);
    res.clearCookie(cookieName, cookieOptions).sendStatus(204);
  });
  return router;
}
