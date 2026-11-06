import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AppOptions } from "./app";
import { readAuthConfig, readDbConfig, readProfileConfig, systemClock, type Clock } from "./config";
import { createDbPool } from "./db/pool";
import { createCatalogue } from "./visitors/catalogue";
import { accessLogConfigured } from "./access-logs/config";

/** Synchronous app dependencies; no schema or account mutation during startup. */
export function createRuntime(env: NodeJS.ProcessEnv = process.env, clock: Clock = systemClock) {
  const config = readAuthConfig(env);
  const database = readDbConfig(env);
  const logEnabled = accessLogConfigured(env);
  const profiles = readProfileConfig(env);
  if (
    !env.ANALYTICS_ID_SECRET ||
    Buffer.byteLength(env.ANALYTICS_ID_SECRET) < 32 ||
    (env.NODE_ENV === "production" &&
      (!env.RELEASE_PROBE_SECRET || Buffer.byteLength(env.RELEASE_PROBE_SECRET) < 32))
  )
    throw new Error("Analytics configuration missing or invalid");
  const catalogue = createCatalogue(
    JSON.parse(readFileSync(resolve(__dirname, "../analytics-catalogue.json"), "utf8")),
  );
  const db = createDbPool(database);
  const collector = createDbPool({ ...database, connectionLimit: 2 });
  const appOptions: AppOptions = {
    db,
    config,
    clock,
    ...(profiles
      ? { profiles: { ...profiles, schemaDirectory: resolve(__dirname, "../profile-migrations") } }
      : {}),
    ...(logEnabled
      ? {
          accessLogs: {
            pool: db,
            schemaDirectory: resolve(__dirname, "../access-log-migrations"),
            currentEnabled: Boolean(env.ACCESS_LOG_CURRENT_DIR),
          },
        }
      : {}),
    analytics: {
      pool: collector,
      catalogue,
      idSecret: env.ANALYTICS_ID_SECRET,
      cookieSecure: config.cookieSecure,
      probeSecret: env.RELEASE_PROBE_SECRET,
    },
  };
  let closing: Promise<unknown> | undefined;
  return { appOptions, close: () => (closing ??= Promise.all([db.end(), collector.end()])) };
}
