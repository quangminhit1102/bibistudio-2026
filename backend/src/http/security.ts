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
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Bibi-Request");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });
  app.use(express.json({ limit: "16kb", strict: true }));
  app.use(cookieParser());
}
export function requireBrowserOrigin(config: SecurityConfig): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get("origin");
    if (!origin || !config.allowedOrigins.includes(origin) || req.get("X-Bibi-Request") !== "1") {
      next(new ApiError(403, "ORIGIN_REJECTED", "Yêu cầu không được phép"));
      return;
    }
    if (!req.is("application/json")) {
      next(new ApiError(415, "JSON_REQUIRED", "Yêu cầu dữ liệu JSON"));
      return;
    }
    next();
  };
}
