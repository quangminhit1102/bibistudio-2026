import express, { type Express } from "express";
import type { ReleaseInfo } from "./release";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { installSecurity, type SecurityConfig } from "./http/security";
import { ApiError, errorHandler } from "./http/errors";
import { systemClock, type Clock, type AuthConfig } from "./config";
import { createAuthService } from "./auth/service";
import { authRoutes } from "./auth/routes";
import { createAccountService } from "./accounts/service";
import { accountRoutes } from "./accounts/routes";

export interface AppOptions {
  db?: Pool;
  config?: SecurityConfig | AuthConfig;
  clock?: Clock;
}

export function createApp(release: ReleaseInfo, options: AppOptions = {}): Express {
  const app = express();
  const authConfig = options.config && "jwtSecret" in options.config ? options.config : undefined;
  const auth =
    options.db && authConfig
      ? createAuthService({
          pool: options.db,
          config: authConfig,
          clock: options.clock ?? systemClock,
        })
      : undefined;
  installSecurity(app, options.config ?? { allowedOrigins: [], trustProxy: false });
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
      const start = performance.now();
      res.once("finish", () =>
        console.log(
          `${req.method} ${req.path} ${res.statusCode} ${Math.round(performance.now() - start)}ms`,
        ),
      );
    }
    next();
  });
  const endpoints = ["/api/health", "/api/version", "/api/demo"];
  app.use((req, res, next) => {
    if (endpoints.includes(req.path) && !["GET", "HEAD"].includes(req.method)) {
      res.setHeader("Allow", "GET, HEAD");
      res.status(405).json({ error: "Method not allowed" });
    } else next();
  });
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/ready", async (_req, res) => {
    if (!options.db || !options.config || !auth)
      throw new ApiError(503, "NOT_READY", "Dịch vụ chưa sẵn sàng");
    const [schema] = await options.db.query<RowDataPacket[]>(
      "SELECT version,state FROM schema_migrations ORDER BY version",
    );
    const [[master]] = await options.db.query<RowDataPacket[]>(
      "SELECT COUNT(*) n FROM users WHERE is_master=1 AND active=1 AND deleted_at IS NULL",
    );
    if (schema.length !== 4 || schema.some((row) => row.state !== "complete") || master.n !== 1)
      throw new ApiError(503, "NOT_READY", "Dịch vụ chưa sẵn sàng");
    res.json({ ok: true });
  });
  if (auth && authConfig && options.db)
    app.use(
      "/api/auth",
      authRoutes({
        auth,
        config: authConfig,
        pool: options.db,
        clock: options.clock ?? systemClock,
      }),
    );
  else
    app.use("/api/auth", () => {
      throw new ApiError(503, "NOT_READY", "Dịch vụ chưa sẵn sàng");
    });
  if (auth && authConfig && options.db)
    app.use(
      "/api/accounts",
      accountRoutes(
        createAccountService({ pool: options.db, clock: options.clock ?? systemClock }),
        auth,
        authConfig,
      ),
    );
  else
    app.use("/api/accounts", () => {
      throw new ApiError(503, "NOT_READY", "Dịch vụ chưa sẵn sàng");
    });
  app.get("/api/version", (_req, res) => {
    res.json({ releaseId: release.releaseId, sourceSha: release.sourceSha });
  });
  app.get("/api/demo", (_req, res) => {
    res.json({
      message: "Hello from BiBi Studio API",
      framework: "Express",
      items: ["React", "Express", "cPanel"],
    });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);
  return app;
}
