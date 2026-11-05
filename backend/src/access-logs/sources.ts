import { lstat, realpath, readdir, mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { AccessLogConfig, ArchiveSource } from "./types";

export class AccessLogFailure extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function assertAccessLogConfig(config: AccessLogConfig): void {
  const bounds = {
    compressedBytes: 64 * 1024 ** 2,
    expandedBytes: 256 * 1024 ** 2,
    workBytes: 512 * 1024 ** 2,
    lineBytes: 65536,
    batchRows: 500,
    runMs: 120000,
  };
  if (
    !isAbsolute(config.archiveDirectory) ||
    !isAbsolute(config.workDirectory) ||
    (config.currentDirectory !== undefined && !isAbsolute(config.currentDirectory)) ||
    (config.currentDirectory !== undefined && config.domainAlias.length + 8 > 255) ||
    !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(config.domainAlias) ||
    config.domainAlias.includes("..") ||
    Object.entries(bounds).some(([key, max]) => {
      const n = config.limits[key as keyof typeof bounds];
      return !Number.isSafeInteger(n) || n < 1 || n > max;
    })
  )
    throw new AccessLogFailure("INVALID_CONFIG");
  const part = relative(resolve(config.archiveDirectory), resolve(config.workDirectory));
  if (!part || (!part.startsWith("..") && !isAbsolute(part)))
    throw new AccessLogFailure("INVALID_CONFIG");
}
export function archiveTransport(
  config: AccessLogConfig,
  basename: string,
): "http" | "https" | null {
  const domain = config.domainAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    "^" + domain + "(-ssl_log)?-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-[0-9]{4}[.]gz$",
  ).exec(basename);
  return match && basename.length <= 255 ? (match[1] ? "https" : "http") : null;
}
export async function canonicalDirectory(directory: string): Promise<void> {
  const actual = await realpath(directory),
    expected = resolve(directory);
  if (
    (process.platform === "win32"
      ? actual.toLowerCase() !== expected.toLowerCase()
      : actual !== expected) ||
    !(await lstat(directory)).isDirectory()
  )
    throw new AccessLogFailure("UNSAFE_DIRECTORY");
}
export async function ensureWorkDirectory(config: AccessLogConfig): Promise<void> {
  assertAccessLogConfig(config);
  await mkdir(config.workDirectory, { recursive: true, mode: 0o700 });
  await canonicalDirectory(config.workDirectory);
  const info = await lstat(config.workDirectory);
  if (
    process.platform !== "win32" &&
    ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())
  )
    throw new AccessLogFailure("UNSAFE_WORK_DIRECTORY");
}
export async function discoverAccessLogArchives(config: AccessLogConfig): Promise<ArchiveSource[]> {
  assertAccessLogConfig(config);
  await canonicalDirectory(config.archiveDirectory);
  const result: ArchiveSource[] = [];
  for (const basename of (await readdir(config.archiveDirectory)).sort()) {
    const transport = archiveTransport(config, basename);
    if (!transport) continue;
    const path = join(config.archiveDirectory, basename),
      info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink())
      throw new AccessLogFailure("UNSAFE_SOURCE_NOT_REGULAR");
    result.push({ basename, path, transport });
  }
  return result;
}
