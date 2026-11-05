import type { AccessLogConfig } from "./types";
import { assertAccessLogConfig } from "./sources";

export function readAccessLogConfig(env: NodeJS.ProcessEnv): AccessLogConfig {
  const config: AccessLogConfig = {
    archiveDirectory: env.ACCESS_LOG_ARCHIVE_DIR ?? "",
    domainAlias: env.ACCESS_LOG_DOMAIN_ALIAS ?? "",
    workDirectory: env.ACCESS_LOG_WORK_DIR ?? "",
    ...(env.ACCESS_LOG_CURRENT_DIR ? { currentDirectory: env.ACCESS_LOG_CURRENT_DIR } : {}),
    limits: {
      compressedBytes: 64 * 1024 ** 2,
      expandedBytes: 256 * 1024 ** 2,
      workBytes: 512 * 1024 ** 2,
      lineBytes: 65536,
      batchRows: 500,
      runMs: 120000,
    },
  };
  assertAccessLogConfig(config);
  return config;
}
export function accessLogConfigured(env: NodeJS.ProcessEnv): boolean {
  const configured = [
    env.ACCESS_LOG_ARCHIVE_DIR,
    env.ACCESS_LOG_DOMAIN_ALIAS,
    env.ACCESS_LOG_WORK_DIR,
    env.ACCESS_LOG_CURRENT_DIR,
  ].some(Boolean);
  if (configured) readAccessLogConfig(env);
  return configured;
}
