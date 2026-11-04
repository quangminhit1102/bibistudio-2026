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
