import { readFileSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import type { AppOptions } from "./app";
import { readAuthConfig, readDbConfig, readProfileConfig, systemClock, type Clock } from "./config";
import { createDbPool } from "./db/pool";
import { createCatalogue } from "./visitors/catalogue";
import { openCountryLookupSync, type CountryLookup } from "./visitors/country-lookup";

/** Synchronous app dependencies; no schema or account mutation during startup. */
export function createRuntime(env: NodeJS.ProcessEnv = process.env, clock: Clock = systemClock) {
  const config = readAuthConfig(env);
  const database = readDbConfig(env);
  const profiles = readProfileConfig(env);
  const mediaDirectory = env.BIBI_MEDIA_DIR ?? resolve(__dirname, "../media");
  if (!mediaDirectory || mediaDirectory !== mediaDirectory.trim() || !isAbsolute(mediaDirectory))
    throw new Error("Invalid private media directory");
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
  let countryLookup: CountryLookup | undefined;
  if (env.ANALYTICS_RELAY_SECRET || env.GEOIP_COUNTRY_FILE) {
    if (
      !env.ANALYTICS_RELAY_SECRET ||
      !/^[A-Za-z0-9_-]{43}$/.test(env.ANALYTICS_RELAY_SECRET) ||
      Buffer.from(env.ANALYTICS_RELAY_SECRET, "base64url").toString("base64url") !==
        env.ANALYTICS_RELAY_SECRET ||
      !env.GEOIP_COUNTRY_FILE
    )
      throw new Error("Analytics relay configuration missing or invalid");
    const metadata = JSON.parse(
      readFileSync(resolve(dirname(env.GEOIP_COUNTRY_FILE), "country.lock.json"), "utf8"),
    );
    countryLookup = openCountryLookupSync({
      file: env.GEOIP_COUNTRY_FILE,
      sha256: metadata.mmdbSha256,
      version: metadata.version,
    });
  }
  const db = createDbPool(database);
  const collector = createDbPool({ ...database, connectionLimit: 2 });
  const appOptions: AppOptions = {
    db,
    config,
    clock,
    ...(profiles
      ? { profiles: { ...profiles, schemaDirectory: resolve(__dirname, "../profile-migrations") } }
      : {}),
    visitorHistory: { schemaDirectory: resolve(__dirname, "../visitor-migrations") },
    visitorControls: { schemaDirectory: resolve(__dirname, "../visitor-controls-migrations") },
    content: { schemaDirectory: resolve(__dirname, "../content-migrations"), mediaDirectory },
    ...(countryLookup
      ? { visitorContext: { schemaDirectory: resolve(__dirname, "../visitor-context-migrations") } }
      : {}),
    analytics: {
      pool: collector,
      controlsEnabled: true,
      catalogue,
      idSecret: env.ANALYTICS_ID_SECRET,
      cookieSecure: config.cookieSecure,
      probeSecret: env.RELEASE_PROBE_SECRET,
      clientIpSourceVerified: config.clientIpSourceVerified,
      trustedProxyCidrs: config.trustProxy || [],
      relaySecret: env.ANALYTICS_RELAY_SECRET,
      countryLookup,
    },
  };
  let closing: Promise<unknown> | undefined;
  return {
    appOptions,
    close: () => {
      if (!closing) {
        countryLookup?.close();
        closing = Promise.all([db.end(), collector.end()]);
      }
      return closing;
    },
  };
}
