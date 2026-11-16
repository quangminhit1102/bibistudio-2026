import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { AppOptions } from "./app";
import { readAuthConfig, readDbConfig, readProfileConfig, systemClock, type Clock } from "./config";
import { createDbPool } from "./db/pool";
import { createCatalogue, mergePublishedCatalogue, type Catalogue } from "./visitors/catalogue";
import { lstat } from "node:fs/promises";
import { openCountryLookupSync, type CountryLookup } from "./visitors/country-lookup";
import { readContentPaths } from "./content/capabilities";
import { readActiveContent } from "./content/publication/active-read";
import { createContentPublication } from "./content/publication/publisher";
import {
  publicationBuildConfig,
  createPublicationWakeup,
  publicationAuthority,
} from "./content/publication/cli";
import { createContentMedia } from "./content/media/service";
import { readRelease } from "./release";
import { readContentCapabilities } from "./content/capabilities";

/** Synchronous app dependencies; no schema or account mutation during startup. */
export function createRuntime(env: NodeJS.ProcessEnv = process.env, clock: Clock = systemClock) {
  const config = readAuthConfig(env);
  const database = readDbConfig(env);
  const profiles = readProfileConfig(env);
  const contentPaths = readContentPaths(env);
  const contentCapabilities = readContentCapabilities(readRelease(env));
  const activeRead = async () =>
    contentPaths ? ((await readActiveContent(contentPaths))?.snapshot ?? null) : null;
  const legacyAllowed = async () => {
    if (contentCapabilities.canWrite) return false;
    if (!env.BIBI_PRIVATE_ENV_FILE) return env.NODE_ENV !== "production";
    try {
      await lstat(resolve(dirname(env.BIBI_PRIVATE_ENV_FILE), "content-routing.json"));
      return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
      throw error;
    }
  };
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
  let cachedCatalogue: Catalogue | undefined, cachedGeneration: string | undefined;
  const readCatalogue = async () => {
    try {
      const snapshot = await activeRead();
      if (!snapshot)
        return (await legacyAllowed())
          ? catalogue
          : mergePublishedCatalogue(catalogue, { routes: [] });
      if (cachedGeneration !== snapshot.generationId) {
        cachedCatalogue = mergePublishedCatalogue(catalogue, snapshot);
        cachedGeneration = snapshot.generationId;
      }
      return cachedCatalogue!;
    } catch {
      return mergePublishedCatalogue(catalogue, { routes: [] });
    }
  };
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
  const wake = createPublicationWakeup(env);
  const publication =
    contentPaths &&
    env.BIBI_CONTENT_ASSET_ROOT &&
    readContentCapabilities(readRelease(env)).canWrite
      ? createContentPublication({
          pool: db,
          clock,
          paths: contentPaths,
          media: createContentMedia({ pool: db, clock, paths: contentPaths }),
          ...publicationBuildConfig(env),
          wake,
          assertWritable: publicationAuthority(env),
        })
      : undefined;
  const appOptions: AppOptions = {
    db,
    config,
    clock,
    publicContent: { activeRead, legacyAllowed },
    ...(contentPaths
      ? {
          content: {
            paths: contentPaths,
            schemaDirectory: resolve(__dirname, "../content-migrations"),
            activeRead,
            publication,
          },
        }
      : {}),
    ...(profiles
      ? { profiles: { ...profiles, schemaDirectory: resolve(__dirname, "../profile-migrations") } }
      : {}),
    visitorHistory: { schemaDirectory: resolve(__dirname, "../visitor-migrations") },
    ...(countryLookup
      ? { visitorContext: { schemaDirectory: resolve(__dirname, "../visitor-context-migrations") } }
      : {}),
    analytics: {
      pool: collector,
      catalogue,
      readCatalogue,
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
    start: () => {
      if (publication) wake();
    },
    close: () => {
      if (!closing) {
        countryLookup?.close();
        closing = Promise.all([db.end(), collector.end()]);
      }
      return closing;
    },
  };
}
