import { constants, createWriteStream } from "node:fs";
import {
  open,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  rename,
  unlink,
  rmdir,
} from "node:fs/promises";
import { join, resolve, dirname, isAbsolute, relative } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import type { AccessLogConfig, CurrentSnapshot } from "./types";
import {
  AccessLogFailure,
  assertAccessLogConfig,
  canonicalDirectory,
  ensureWorkDirectory,
} from "./sources";
import { workUsage } from "./snapshot";

export const currentWorkDirectory = (config: AccessLogConfig) => config.workDirectory + "-current";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function currentBasename(config: AccessLogConfig, transport: "http" | "https"): string {
  return config.domainAlias + (transport === "https" ? "-ssl_log" : "");
}
async function prepare(config: AccessLogConfig): Promise<string> {
  assertAccessLogConfig(config);
  if (!config.currentDirectory || !isAbsolute(config.currentDirectory))
    throw new AccessLogFailure("CURRENT_CONFIG_MISSING");
  const root = currentWorkDirectory(config),
    part = relative(resolve(config.currentDirectory), resolve(root));
  if (!part || (!part.startsWith("..") && !isAbsolute(part)))
    throw new AccessLogFailure("INVALID_CONFIG");
  await ensureWorkDirectory(config);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await canonicalDirectory(root);
  const info = await lstat(root);
  if (
    process.platform !== "win32" &&
    ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())
  )
    throw new AccessLogFailure("UNSAFE_WORK_DIRECTORY");
  return root;
}
export async function currentSnapshotWorkUsage(config: AccessLogConfig): Promise<number> {
  const root = await prepare(config);
  let size = 0;
  for (const folder of await readdir(root)) {
    if (!/^snapshot-[a-f0-9-]{36}$|^[.]pending-[a-zA-Z0-9]+$/.test(folder))
      throw new AccessLogFailure("UNEXPECTED_WORK_ENTRY");
    const dir = join(root, folder),
      info = await lstat(dir);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new AccessLogFailure("UNSAFE_WORK_ENTRY");
    for (const name of await readdir(dir)) {
      if (!["source.log", "descriptor.json"].includes(name))
        throw new AccessLogFailure("UNEXPECTED_WORK_ENTRY");
      const file = await lstat(join(dir, name));
      if (!file.isFile() || file.isSymbolicLink()) throw new AccessLogFailure("UNSAFE_WORK_ENTRY");
      size += file.size;
    }
  }
  return size;
}
export async function assertCombinedWorkBudget(
  config: AccessLogConfig,
  reserve = 0,
): Promise<void> {
  if (
    reserve + (await currentSnapshotWorkUsage(config)) + (await workUsage(config)) >
    config.limits.workBytes
  )
    throw new AccessLogFailure("SNAPSHOT_LIMIT_OR_QUOTA");
}
export async function removeCurrentSnapshot(
  snapshot: CurrentSnapshot,
  config: AccessLogConfig,
): Promise<void> {
  const folder = join(currentWorkDirectory(config), "snapshot-" + snapshot.id);
  if (!uuid.test(snapshot.id) || resolve(dirname(snapshot.path)) !== resolve(folder))
    throw new AccessLogFailure("UNSAFE_SNAPSHOT_PATH");
  await unlink(join(folder, "source.log"));
  await unlink(join(folder, "descriptor.json"));
  await rmdir(folder);
}
export async function queuedCurrentSnapshots(config: AccessLogConfig): Promise<CurrentSnapshot[]> {
  const root = await prepare(config);
  await assertCombinedWorkBudget(config);
  const result: CurrentSnapshot[] = [];
  for (const folder of await readdir(root)) {
    if (!folder.startsWith("snapshot-")) continue;
    const descriptor = join(root, folder, "descriptor.json");
    if ((await lstat(descriptor)).size > 4096)
      throw new AccessLogFailure("INVALID_SNAPSHOT_DESCRIPTOR");
    const s = JSON.parse(await readFile(descriptor, "utf8")) as CurrentSnapshot;
    if (
      !uuid.test(s.id) ||
      folder !== "snapshot-" + s.id ||
      !["http", "https"].includes(s.transport) ||
      s.basename !== currentBasename(config, s.transport) ||
      !/^[a-f0-9]{64}$/.test(s.sha256) ||
      !Number.isSafeInteger(s.bytes) ||
      s.bytes < 0 ||
      s.bytes > Math.min(config.limits.compressedBytes, config.limits.expandedBytes) ||
      ![s.capturedAt, s.sourceModifiedAt].every((time) => Number.isFinite(Date.parse(time)))
    )
      throw new AccessLogFailure("INVALID_SNAPSHOT_DESCRIPTOR");
    result.push({ ...s, path: join(root, folder, "source.log") });
  }
  return result.sort(
    (a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id),
  );
}
/** Trusted hook exercises mutation between copy and verification; never exposed over HTTP. */
export async function captureCurrentLog(
  config: AccessLogConfig,
  transport: "http" | "https",
  signal: AbortSignal,
  hooks: { onCopied?: () => Promise<unknown>; onLocated?: () => Promise<unknown> } = {},
): Promise<CurrentSnapshot> {
  const root = await prepare(config);
  signal.throwIfAborted();
  await canonicalDirectory(config.currentDirectory!);
  const basename = currentBasename(config, transport),
    file = join(config.currentDirectory!, basename),
    info = await lstat(file, { bigint: true });
  if (!info.isFile() || info.isSymbolicLink())
    throw new AccessLogFailure("UNSAFE_SOURCE_NOT_REGULAR");
  const limit = Math.min(config.limits.compressedBytes, config.limits.expandedBytes);
  if (info.size > BigInt(limit)) throw new AccessLogFailure("CURRENT_SIZE_LIMIT");
  await assertCombinedWorkBudget(config, Number(info.size) + 4096);
  const folder = await mkdtemp(join(root, ".pending-"));
  let handle: Awaited<ReturnType<typeof open>> | undefined,
    kept = false;
  try {
    await hooks.onLocated?.();
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    if (before.ino !== info.ino || before.dev !== info.dev || before.size < info.size)
      throw new AccessLogFailure("SOURCE_CHANGED");
    const hash = createHash("sha256");
    let bytes = 0;
    if (info.size === 0n)
      await writeFile(join(folder, "source.log"), "", { mode: 0o600, flag: "wx" });
    else
      await pipeline(
        handle.createReadStream({ start: 0, end: Number(info.size) - 1, autoClose: false }),
        new Transform({
          transform(chunk: Buffer, _e, done) {
            bytes += chunk.length;
            hash.update(chunk);
            done(null, chunk);
          },
        }),
        createWriteStream(join(folder, "source.log"), { mode: 0o600, flags: "wx" }),
        { signal },
      );
    const sha256 = hash.digest("hex");
    await hooks.onCopied?.();
    signal.throwIfAborted();
    const check = createHash("sha256");
    let checked = 0;
    if (info.size > 0n)
      for await (const chunk of handle.createReadStream({
        start: 0,
        end: Number(info.size) - 1,
        autoClose: false,
      })) {
        signal.throwIfAborted();
        checked += chunk.length;
        check.update(chunk);
      }
    const after = await handle.stat({ bigint: true }),
      pathAfter = await lstat(file, { bigint: true });
    if (
      bytes !== Number(info.size) ||
      checked !== bytes ||
      sha256 !== check.digest("hex") ||
      after.size < info.size ||
      pathAfter.ino !== before.ino ||
      pathAfter.dev !== before.dev ||
      pathAfter.isSymbolicLink()
    )
      throw new AccessLogFailure("SOURCE_CHANGED");
    const id = randomUUID(),
      snapshot: CurrentSnapshot = {
        id,
        transport,
        basename,
        path: join(root, "snapshot-" + id, "source.log"),
        sha256,
        bytes,
        sourceModifiedAt: new Date(Number(info.mtimeMs)).toISOString(),
        capturedAt: new Date().toISOString(),
      };
    await writeFile(
      join(folder, "descriptor.json"),
      JSON.stringify({ ...snapshot, path: undefined }),
      { mode: 0o600, flag: "wx" },
    );
    await rename(folder, dirname(snapshot.path));
    kept = true;
    return snapshot;
  } finally {
    await handle?.close();
    if (!kept) {
      for (const name of ["source.log", "descriptor.json"])
        await unlink(join(folder, name)).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      await rmdir(folder);
    }
  }
}
