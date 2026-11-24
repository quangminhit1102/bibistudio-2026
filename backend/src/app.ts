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
import { createRoleService } from "./roles/service";
import { roleRoutes } from "./roles/routes";
import { auditRoutes } from "./audit/routes";
import { authenticate, requirePermission } from "./authorization/middleware";
import { analyticsRoutes, type AnalyticsOptions } from "./visitors/routes";
import { visitorReadRoutes } from "./visitors/private-routes";
import { createVisitorService } from "./visitors/service";
import { visitorHistorySchemaStatus } from "./visitors/schema";
import { visitorContextSchemaStatus } from "./visitors/context-schema";
import { profileRoutes } from "./profile/routes";
import { createProfileService } from "./profile/service";
import { profileSchemaStatus } from "./profile/schema";
import { createAvatarStore, type AvatarStore } from "./profile/avatar-store";
import { avatarRoutes } from "./profile/avatar-routes";

import { visitorControlsRoutes } from "./visitors/controls-routes";
import { createVisitorControlsService } from "./visitors/controls-service";
import { visitorControlsSchemaStatus } from "./visitors/controls-schema";
import { contentSchemaStatus } from "./content/schema";
import { contentRoutes } from "./content/routes";
import { createContentService } from "./content/service";
import { contentPublicRoutes } from "./content/public-routes";
import { createMediaStore, type MediaStore } from "./content/media-store";
import { mediaRoutes } from "./content/media-routes";

export interface AppOptions {
  db?: Pool;
  config?: SecurityConfig | AuthConfig;
  clock?: Clock;
  analytics?: AnalyticsOptions;
  accessLogs?: { pool: Pool; schemaDirectory: string; currentEnabled?: boolean };
  visitorHistory?: { schemaDirectory: string };
  visitorContext?: { schemaDirectory: string };
  visitorControls?: { schemaDirectory: string };
  content?: { schemaDirectory: string; mediaDirectory?: string; media?: MediaStore };
  profiles?: { schemaDirectory: string; assetDirectory: string; assets?: AvatarStore };
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
  app.use("/api/customer-access/access-logs", () => {
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy chức năng");
  });
  if (auth && options.db && options.visitorControls && options.config)
    app.use(
      "/api/customer-access",
      visitorControlsRoutes(
        createVisitorControlsService(options.db, options.clock ?? systemClock),
        auth,
        options.config,
      ),
    );
  if (auth && options.db && options.analytics)
    app.use(
      "/api/customer-access",
      visitorReadRoutes(
        createVisitorService(
          options.db,
          options.analytics.catalogue,
          options.clock ?? systemClock,
          !!options.visitorContext,
        ),
        auth,
      ),
    );
  else
    app.use("/api/customer-access", () => {
      throw new ApiError(503, "NOT_READY", "Dịch vụ chưa sẵn sàng");
    });
  if (options.analytics && options.config)
    app.use(
      "/api/analytics",
      analyticsRoutes(
        {
          ...options.analytics,
          controlsEnabled: !!options.visitorControls || options.analytics.controlsEnabled,
        },
        options.config,
        options.clock,
        release.releaseId,
      ),
    );
  else
    app.use("/api/analytics", () => {
      throw new ApiError(503, "NOT_READY", "Dịch vụ chưa sẵn sàng");
    });
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
  const endpoints = ["/api/health", "/api/version"];
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
    if (
      schema.length !== 4 ||
      schema.some((row, index) => row.version !== index + 1 || row.state !== "complete") ||
      master.n !== 1
    )
      throw new ApiError(503, "NOT_READY", "Dịch vụ chưa sẵn sàng");
    if ((release.schemaVersion ?? 0) >= 4 && !options.profiles)
      throw new ApiError(503, "PROFILE_NOT_READY", "Dịch vụ hồ sơ chưa sẵn sàng");
    if (options.profiles) {
      try {
        if (
          (await profileSchemaStatus(options.db, options.profiles.schemaDirectory)).state !==
          "complete"
        )
          throw new Error("profile schema not ready");
      } catch {
        throw new ApiError(503, "PROFILE_NOT_READY", "Dịch vụ hồ sơ chưa sẵn sàng");
      }
    }
    if ((release.schemaVersion ?? 0) >= 5 && !options.visitorHistory)
      throw new ApiError(503, "VISITOR_HISTORY_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
    if (options.visitorHistory) {
      try {
        if (
          (await visitorHistorySchemaStatus(options.db, options.visitorHistory.schemaDirectory))
            .state !== "complete"
        )
          throw new Error();
      } catch {
        throw new ApiError(503, "VISITOR_HISTORY_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
      }
    }
    if (
      (release.schemaVersion ?? 0) >= 6 &&
      (!options.visitorContext ||
        !options.analytics?.relaySecret ||
        !options.analytics.countryLookup)
    )
      throw new ApiError(503, "VISITOR_CONTEXT_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
    if (options.visitorContext) {
      try {
        if (
          (await visitorContextSchemaStatus(options.db, options.visitorContext.schemaDirectory))
            .state !== "complete"
        )
          throw new Error();
      } catch {
        throw new ApiError(503, "VISITOR_CONTEXT_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
      }
    }
    if ((release.schemaVersion ?? 0) >= 7 && !options.visitorControls)
      throw new ApiError(503, "VISITOR_CONTROLS_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
    if (options.visitorControls) {
      try {
        if (
          (await visitorControlsSchemaStatus(options.db, options.visitorControls.schemaDirectory))
            .state !== "complete"
        )
          throw new Error();
      } catch {
        throw new ApiError(503, "VISITOR_CONTROLS_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
      }
    }
    if ((release.schemaVersion ?? 0) >= 8 && !options.content)
      throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng");
    if (options.content) {
      try {
        if (
          (await contentSchemaStatus(options.db, options.content.schemaDirectory)).state !==
          "complete"
        )
          throw new Error();
      } catch {
        throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng");
      }
    }
    res.json({ ok: true });
  });
  if (options.db)
    app.use("/api/public", contentPublicRoutes(options.db, options.clock ?? systemClock));
  if (auth && authConfig && options.db && options.profiles) {
    const service = createProfileService({
      pool: options.db,
      clock: options.clock ?? systemClock,
      assets:
        options.profiles.assets ?? createAvatarStore({ root: options.profiles.assetDirectory }),
    });
    app.use(
      avatarRoutes(service, auth, authConfig, {
        pool: options.db,
        clock: options.clock ?? systemClock,
      }),
    );
    app.use(
      "/api/profile",
      profileRoutes(service, auth, authConfig, {
        pool: options.db,
        clock: options.clock ?? systemClock,
      }),
    );
  } else
    app.use("/api/profile", () => {
      throw new ApiError(503, "PROFILE_NOT_READY", "Dịch vụ hồ sơ chưa sẵn sàng");
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
  if (auth && authConfig && options.db) {
    const roles = createRoleService({ pool: options.db, clock: options.clock ?? systemClock });
    app.use("/api/roles", roleRoutes(roles, auth, authConfig));
    app.get(
      "/api/permissions",
      authenticate(auth),
      requirePermission("permission.view"),
      async (req, res) => res.json(await roles.listPermissions(req.auth!)),
    );
    app.use("/api/audit", auditRoutes(options.db, auth, options.clock ?? systemClock));
  } else
    app.use(["/api/roles", "/api/permissions", "/api/audit"], () => {
      throw new ApiError(503, "NOT_READY", "Dịch vụ chưa sẵn sàng");
    });
  if (auth && authConfig && options.db && options.content && options.config) {
    app.use(
      "/api",
      contentRoutes(
        createContentService(options.db, options.clock ?? systemClock),
        auth,
        options.config,
      ),
    );
    const mediaStore =
      options.content.media ??
      (options.content.mediaDirectory
        ? createMediaStore({ root: options.content.mediaDirectory })
        : undefined);
    if (mediaStore)
      app.use(
        "/api/media",
        mediaRoutes(mediaStore, auth, options.config, {
          pool: options.db,
          clock: options.clock ?? systemClock,
        }),
      );
    else
      app.use("/api/media", (_req, _res, next) =>
        next(new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng")),
      );
  } else {
    app.use("/api/content", (_req, _res, next) =>
      next(new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng")),
    );
    app.use("/api/media", (_req, _res, next) =>
      next(new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng")),
    );
  }
  app.get("/api/version", (_req, res) => {
    res.json({ releaseId: release.releaseId, sourceSha: release.sourceSha });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);
  return app;
}
