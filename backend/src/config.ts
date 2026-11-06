import { isAbsolute } from "node:path";
export function readProfileConfig(env: NodeJS.ProcessEnv): { assetDirectory: string } | undefined {
  const root = env.PROFILE_ASSET_DIR;
  if (root === undefined) return undefined;
  if (!root || root !== root.trim() || !isAbsolute(root))
    throw new Error("Invalid private profile asset directory");
  return { assetDirectory: root };
}
export interface Clock {
  now(): Date;
}
export interface AuthConfig {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  cookieSecure: boolean;
  allowedOrigins: string[];
  trustProxy: false | string[];
}
export const systemClock: Clock = { now: () => new Date() };
export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const invalid = () => new Error("Authentication configuration missing or invalid");
  const allowedOrigins = (env.AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const production = env.NODE_ENV === "production";
  if (!env.AUTH_JWT_SECRET || Buffer.byteLength(env.AUTH_JWT_SECRET) < 32 || !allowedOrigins.length)
    throw invalid();
  for (const origin of allowedOrigins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw invalid();
    }
    if (
      url.origin !== origin ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          !production &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ))
    )
      throw invalid();
  }
  const proxies = (env.TRUSTED_PROXY_CIDRS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (proxies.some((value) => !ipaddr.isValidCIDR(value))) throw invalid();
  return {
    jwtSecret: env.AUTH_JWT_SECRET,
    jwtIssuer: env.AUTH_JWT_ISSUER || "bibistudio-api",
    jwtAudience: env.AUTH_JWT_AUDIENCE || "bibistudio-admin",
    cookieSecure: production,
    allowedOrigins,
    trustProxy: proxies.length ? proxies : false,
  };
}
export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  connectionLimit: number;
  socketPath?: string;
}
export function readDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const port = Number(env.DB_PORT || 3306);
  const connectionLimit = Number(env.DB_POOL_LIMIT || 5);
  if (
    !env.DB_HOST ||
    !env.DB_USER ||
    !env.DB_PASSWORD ||
    !/^[a-zA-Z0-9_]{1,64}$/.test(env.DB_NAME || "") ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isInteger(connectionLimit) ||
    connectionLimit < 1 ||
    connectionLimit > 10
  ) {
    throw new Error("Database configuration missing or invalid");
  }
  return {
    host: env.DB_HOST,
    port,
    database: env.DB_NAME!,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionLimit,
    socketPath: env.DB_SOCKET || undefined,
  };
}
import ipaddr from "ipaddr.js";
