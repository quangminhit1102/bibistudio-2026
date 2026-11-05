import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, constants } from "node:fs";
import {
  open,
  lstat,
  readdir,
  readFile,
  writeFile,
  mkdtemp,
  rename,
  unlink,
  rmdir,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import {
  AccessLogFailure,
  archiveTransport,
  canonicalDirectory,
  ensureWorkDirectory,
} from "./sources";
import type { AccessLogConfig, ArchiveSource, ArchiveSnapshot } from "./types";
import { disposeSnapshot, recoverDisposals } from "./disposal";

interface Descriptor {
  basename: string;
  transport: "http" | "https";
  compressedSha256: string;
  createdAt: number;
}
export interface QueuedSnapshot extends ArchiveSnapshot {
  createdAt: number;
}
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const folderName = (name: string, hash: string) => "snapshot-" + digest(name) + "-" + hash;
export async function workUsage(config: AccessLogConfig): Promise<number> {
  await recoverDisposals(
    config.workDirectory,
    /^snapshot-[a-f0-9]{64}-[a-f0-9]{64}$/,
    "archive.gz",
  );
  let size = 0;
  for (const folder of await readdir(config.workDirectory)) {
    if (!/^(?:snapshot-[a-f0-9]{64}-[a-f0-9]{64}|[.]pending-[a-zA-Z0-9]+)$/.test(folder))
      throw new AccessLogFailure("UNEXPECTED_WORK_ENTRY");
    const base = join(config.workDirectory, folder),
      info = await lstat(base);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new AccessLogFailure("UNSAFE_WORK_ENTRY");
    for (const name of await readdir(base)) {
      if (!["archive.gz", "descriptor.json"].includes(name))
        throw new AccessLogFailure("UNEXPECTED_WORK_ENTRY");
      const entry = await lstat(join(base, name));
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new AccessLogFailure("UNSAFE_WORK_ENTRY");
      size += entry.size;
    }
  }
  return size;
}
async function removeFolder(folder: string): Promise<void> {
  for (const name of ["archive.gz", "descriptor.json"]) {
    try {
      await unlink(join(folder, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  await rmdir(folder);
}
export async function removeSnapshot(
  snapshot: ArchiveSnapshot,
  config: AccessLogConfig,
): Promise<void> {
  const folder = join(
    config.workDirectory,
    folderName(snapshot.basename, snapshot.compressedSha256),
  );
  if (resolve(dirname(snapshot.path)) !== resolve(folder))
    throw new AccessLogFailure("UNSAFE_SNAPSHOT_PATH");
  await disposeSnapshot(folder, "archive.gz");
}
export async function queuedSnapshots(config: AccessLogConfig): Promise<QueuedSnapshot[]> {
  await ensureWorkDirectory(config);
  await workUsage(config);
  const snapshots: QueuedSnapshot[] = [];
  for (const folder of await readdir(config.workDirectory)) {
    if (!folder.startsWith("snapshot-")) continue;
    const directory = join(config.workDirectory, folder),
      file = join(directory, "descriptor.json");
    if ((await lstat(file)).size > 4096) throw new AccessLogFailure("INVALID_SNAPSHOT_DESCRIPTOR");
    const value = JSON.parse(await readFile(file, "utf8")) as Descriptor;
    if (
      !/^[a-f0-9]{64}$/.test(value.compressedSha256) ||
      archiveTransport(config, value.basename) !== value.transport ||
      folderName(value.basename, value.compressedSha256) !== folder ||
      !Number.isFinite(value.createdAt)
    )
      throw new AccessLogFailure("INVALID_SNAPSHOT_DESCRIPTOR");
    snapshots.push({ ...value, path: join(directory, "archive.gz") });
  }
  return snapshots.sort(
    (a, b) =>
      a.basename.localeCompare(b.basename) ||
      a.createdAt - b.createdAt ||
      a.compressedSha256.localeCompare(b.compressedSha256),
  );
}
export async function snapshotArchive(
  source: ArchiveSource,
  config: AccessLogConfig,
  signal: AbortSignal,
): Promise<ArchiveSnapshot> {
  await ensureWorkDirectory(config);
  await canonicalDirectory(config.archiveDirectory);
  if (
    archiveTransport(config, source.basename) !== source.transport ||
    resolve(source.path) !== resolve(join(config.archiveDirectory, source.basename))
  )
    throw new AccessLogFailure("UNSAFE_SOURCE_PATH");
  const metadata = await lstat(source.path, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new AccessLogFailure("UNSAFE_SOURCE_NOT_REGULAR");
  if (
    metadata.size > BigInt(config.limits.compressedBytes) ||
    Number(metadata.size) + (await workUsage(config)) + 4096 > config.limits.workBytes
  )
    throw new AccessLogFailure("SNAPSHOT_LIMIT_OR_QUOTA");
  const folder = await mkdtemp(join(config.workDirectory, ".pending-"));
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let kept = false;
  try {
    handle = await open(source.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    if (before.ino !== metadata.ino || before.dev !== metadata.dev)
      throw new AccessLogFailure("SOURCE_CHANGED");
    let bytes = 0;
    const hash = createHash("sha256");
    await pipeline(
      handle.createReadStream({ start: 0, autoClose: false }),
      new Transform({
        transform(chunk: Buffer, _encoding, done) {
          bytes += chunk.length;
          if (bytes > config.limits.compressedBytes) {
            done(new AccessLogFailure("COMPRESSED_LIMIT"));
            return;
          }
          hash.update(chunk);
          done(null, chunk);
        },
      }),
      createWriteStream(join(folder, "archive.gz"), { flags: "wx", mode: 0o600 }),
      { signal },
    );
    const compressedSha256 = hash.digest("hex"),
      check = createHash("sha256");
    for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) {
      signal.throwIfAborted();
      check.update(chunk);
    }
    const after = await handle.stat({ bigint: true }),
      pathAfter = await lstat(source.path, { bigint: true });
    if (
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ino !== pathAfter.ino ||
      pathAfter.isSymbolicLink() ||
      compressedSha256 !== check.digest("hex")
    )
      throw new AccessLogFailure("SOURCE_CHANGED");
    const finalFolder = join(config.workDirectory, folderName(source.basename, compressedSha256));
    const descriptor: Descriptor = {
      basename: source.basename,
      transport: source.transport,
      compressedSha256,
      createdAt: Date.now(),
    };
    await writeFile(join(folder, "descriptor.json"), JSON.stringify(descriptor), {
      flag: "wx",
      mode: 0o600,
    });
    try {
      await lstat(finalFolder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await rename(folder, finalFolder);
      kept = true;
    }
    return {
      basename: source.basename,
      transport: source.transport,
      compressedSha256,
      path: join(finalFolder, "archive.gz"),
    };
  } finally {
    await handle?.close();
    if (!kept) await removeFolder(folder);
  }
}

/** Two passes let the caller validate CRC/hash/limits and committed prefix before any DB write. */
export async function streamArchive(
  snapshot: ArchiveSnapshot,
  config: AccessLogConfig,
  signal: AbortSignal,
  consume: (chunk: Buffer) => Promise<void>,
): Promise<void> {
  const info = await lstat(snapshot.path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > config.limits.compressedBytes)
    throw new AccessLogFailure("UNSAFE_SNAPSHOT");
  let compressed = 0,
    expanded = 0;
  const hash = createHash("sha256");
  await pipeline(
    createReadStream(snapshot.path),
    new Transform({
      transform(chunk: Buffer, _encoding, done) {
        compressed += chunk.length;
        if (compressed > config.limits.compressedBytes) {
          done(new AccessLogFailure("COMPRESSED_LIMIT"));
          return;
        }
        hash.update(chunk);
        done(null, chunk);
      },
    }),
    createGunzip(),
    async function (source) {
      for await (const chunk of source) {
        signal.throwIfAborted();
        expanded += chunk.length;
        if (expanded > config.limits.expandedBytes) throw new AccessLogFailure("EXPANDED_LIMIT");
        await consume(chunk as Buffer);
      }
    },
    { signal },
  );
  if (hash.digest("hex") !== snapshot.compressedSha256)
    throw new AccessLogFailure("SNAPSHOT_CHANGED");
}

export interface ArchiveInspection {
  bytes: number;
  sha256: string;
  prefixSha256: string;
  prefixBytes: number;
  completeBytes: number;
  completeLines: number;
}
export async function inspectArchive(
  snapshot: ArchiveSnapshot,
  config: AccessLogConfig,
  signal: AbortSignal,
  prefixBytes = 0,
): Promise<ArchiveInspection> {
  const hash = createHash("sha256"),
    prefix = createHash("sha256");
  let bytes = 0,
    collected = 0,
    completeBytes = 0,
    completeLines = 0;
  await streamArchive(snapshot, config, signal, async (chunk) => {
    hash.update(chunk);
    const take = Math.min(chunk.length, Math.max(0, prefixBytes - collected));
    prefix.update(chunk.subarray(0, take));
    collected += take;
    for (let i = chunk.indexOf(10); i >= 0; i = chunk.indexOf(10, i + 1)) {
      completeBytes = bytes + i + 1;
      completeLines++;
    }
    bytes += chunk.length;
  });
  return {
    bytes,
    sha256: hash.digest("hex"),
    prefixSha256: prefix.digest("hex"),
    prefixBytes: collected,
    completeBytes,
    completeLines,
  };
}
