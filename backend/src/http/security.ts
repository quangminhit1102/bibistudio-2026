import { randomUUID } from "node:crypto";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { ApiError } from "./errors";

export interface SecurityConfig {
  allowedOrigins: string[];
  trustProxy: false | string[];
}
export function installSecurity(app: Express, config: SecurityConfig): void {
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader("X-Request-Id", res.locals.requestId);
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use((req, res, next) => {
    const origin = req.get("origin");
    res.vary("Origin");
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Bibi-Request, If-Match",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });
  const json = express.json({ limit: "16kb", strict: true });
  app.use((req, res, next) => {
    // Avatar envelopes are bounded and parsed only after authentication/preflight.
    if (
      req.method === "PUT" &&
      /^\/api\/(?:profile|accounts\/[a-f0-9-]{36})\/avatar\/?$/i.test(req.path)
    )
      return next();
    json(req, res, next);
  });
  app.use(cookieParser());
}
export function requireBrowserOrigin(config: SecurityConfig): RequestHandler {
  return (req, _res, next) => {
    requireBrowserHeaders(config)(req, _res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      if (!req.is("application/json")) {
        next(new ApiError(415, "JSON_REQUIRED", "Yêu cầu dữ liệu JSON"));
        return;
      }
      next();
    });
  };
}
export function requireBrowserHeaders(config: SecurityConfig): RequestHandler {
  return (req, _res, next) => {
    if (
      !req.get("origin") ||
      !config.allowedOrigins.includes(req.get("origin")!) ||
      req.get("X-Bibi-Request") !== "1"
    )
      next(new ApiError(403, "ORIGIN_REJECTED", "Yêu cầu không được phép"));
    else next();
  };
}
