import { mkdir, readdir, lstat, realpath, readFile, open, statfs } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { createProfileBackup } from "../profile/backup";
import { contentSchemaStatus } from "./schema";
import { withContentEnvironmentLock } from "./environment-lock";
import type { ContentPaths, MediaVariant } from "./contracts";
import { createContentMediaStore } from "./media/store";
import { readActiveContent, readGeneration, regularBytes, digest } from "./publication/active-read";
import { readInitialContentJournal } from "./initial";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
async function size(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    total += entry.isDirectory()
      ? await size(join(directory, entry.name))
      : (await lstat(join(directory, entry.name))).size;
  }
  return total;
}
async function write(file: string, bytes: Buffer | string) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const h = await open(file, "wx", 0o600);
  try {
    await h.writeFile(bytes);
    await h.sync();
  } finally {
    await h.close();
  }
}
async function flushTree(directory: string) {
  if (process.platform === "win32") return;
  for (const entry of await readdir(directory, { withFileTypes: true }))
    if (entry.isDirectory() && !entry.isSymbolicLink())
      await flushTree(join(directory, entry.name));
  const h = await open(directory, "r");
  try {
    await h.sync();
  } finally {
    await h.close();
  }
}
async function variants(c: PoolConnection, database?: string) {
  if (database && !/^[a-zA-Z0-9_]{1,64}$/.test(database)) throw Error("Invalid verifier database");
  const prefix = database ? "`" + database + "`." : "";
  const [rows] = await c.query<RowDataPacket[]>(
    `SELECT v.* FROM ${prefix}content_media_variants v JOIN ${prefix}content_media m ON m.id=v.media_id WHERE m.state='complete' ORDER BY v.media_id,v.name`,
  );
  if (rows.length > 100000) throw Error("Content backup media limit exceeded");
  return rows.map((r) => ({
    mediaId: String(r.media_id),
    name: String(r.name),
    hash: String(r.hash),
    file: String(r.file),
    mime: r.mime as MediaVariant["mime"],
    width: Number(r.width),
    height: Number(r.height),
    bytes: Number(r.bytes),
  }));
}
/** Full native DB restore plus private profile/content files, under the writer's environment lease. */
export async function createContentBackup(
  options: Parameters<typeof createProfileBackup>[0] & {
    paths: ContentPaths;
    assetRoot: string;
    bootstrapFiles?: Record<string, string>;
  },
) {
  return withContentEnvironmentLock(options.paths, async (lease) => {
    const c = await options.pool.getConnection();
    let copiedRoot = "",
      pinsRoot = "",
      manifestPath = "";
    const files = new Map<string, { source: string; sha256: string; bytes: number }>();
    try {
      const status = await contentSchemaStatus(c, resolve(__dirname, "../../content-migrations"));
      if (!["empty", "complete"].includes(status.state))
        throw Error("Incompatible content backup schema");
      const active = await readActiveContent(options.paths);
      if (active && status.state !== "complete")
        throw Error("Active content has no compatible schema");
      const refs = status.state === "complete" ? await variants(c) : [],
        media = createContentMediaStore(options.paths),
        generations = new Map<string, string>(),
        pins = new Set<string>();
      async function add(relative: string, source: string, bytes: Buffer, expected?: string) {
        const sha256 = digest(bytes);
        if (expected && sha256 !== expected) throw Error("Content backup source checksum mismatch");
        const existing = files.get(relative);
        if (existing && existing.sha256 !== sha256) throw Error("Content backup pin collision");
        files.set(relative, { source, sha256, bytes: bytes.length });
      }
      for (const [name, file] of Object.entries(options.bootstrapFiles ?? {})) {
        if (
          ![
            "content-reader.json",
            "content-routing.json",
            "content-reader.php",
            "loader.php",
            "root.htaccess",
            "content-initial-routing.json",
          ].includes(name)
        )
          throw Error("Unknown content bootstrap backup file");
        await add(
          "bootstrap/" + name,
          file,
          await regularBytes(dirname(file), file.slice(dirname(file).length + 1), 2 * 1024 ** 2),
        );
      }
      for (const variant of refs) {
        const bytes = await media.read(variant.mediaId, variant);
        await add(
          "content/media/" + variant.file,
          join(options.paths.media, variant.file),
          bytes,
          variant.hash,
        );
      }
      for (const entry of await readdir(options.paths.generations, { withFileTypes: true })) {
        if (entry.name.startsWith(".staging-")) continue;
        if (!uuid.test(entry.name) || !entry.isDirectory() || entry.isSymbolicLink())
          throw Error("Invalid backup generation directory");
        const generation = await readGeneration(options.paths, entry.name),
          dir = join(options.paths.generations, entry.name);
        generations.set(entry.name, generation.manifestSha256);
        await add(
          `content/generations/${entry.name}/manifest.json`,
          join(dir, "manifest.json"),
          await regularBytes(dir, "manifest.json", 16 * 1024 ** 2),
          generation.manifestSha256,
        );
        for (const [file, hash] of Object.entries(generation.manifest.fileHashes))
          await add(
            `content/generations/${entry.name}/${file}`,
            join(dir, file),
            await regularBytes(dir, file, options.paths.maxGenerationBytes),
            hash,
          );
        for (const variant of Object.values(generation.manifest.media))
          await add(
            "content/media/" + variant.file,
            join(options.paths.media, variant.file),
            await media.read(variant.file.split("/")[0], variant),
            variant.hash,
          );
        for (const asset of generation.manifest.assets) pins.add(asset);
      }
      if (status.state === "complete") {
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT id,manifest_sha256 FROM content_generations WHERE manifest_sha256 IS NOT NULL ORDER BY id",
        );
        for (const row of rows)
          if (generations.get(row.id) !== row.manifest_sha256)
            throw Error("Missing or corrupt referenced content generation");
      }
      if (active) {
        if (generations.get(active.manifest.id) !== active.manifestSha256)
          throw Error("Missing active content generation");
        await add(
          "content/active",
          options.paths.active,
          await regularBytes(options.paths.root, "active", 1024),
        );
      }
      for (const asset of pins)
        await add(
          "content-assets/" + asset.slice(1),
          join(options.assetRoot, asset.slice(1)),
          await regularBytes(options.assetRoot, asset.slice(1), 10 * 1024 ** 2),
        );
      const initial = await readInitialContentJournal(options.paths);
      if (initial) {
        if (generations.get(initial.generationId) !== initial.manifestSha256)
          throw Error("Missing initial cutover recovery generation");
        await add(
          "content/initial-cutover.json",
          join(options.paths.root, "initial-cutover.json"),
          await regularBytes(options.paths.root, "initial-cutover.json", 4096),
        );
      }
      const copyBytes = [...files.values()].reduce((n, f) => n + f.bytes, 0);
      const assertPairBudget = async (assetBytes: number) => {
        const dumpBytes = options.maxBytes ?? 128 * 1024 ** 2;
        if (!Number.isSafeInteger(dumpBytes) || dumpBytes < 1024 || dumpBytes > 1024 ** 3)
          throw Error("Invalid backup dump budget");
        const reserved = copyBytes + assetBytes + 2 * dumpBytes + 64 * 1024 ** 2;
        let managed = 0;
        for (const root of options.paths.managedRoots) managed += await size(root);
        const disk = await statfs(options.paths.root);
        if (
          managed + reserved + options.paths.minHeadroomBytes > options.paths.maxManagedBytes ||
          Number(disk.bavail) * Number(disk.bsize) < reserved + options.paths.minHeadroomBytes
        )
          throw Error("Content backup storage budget/headroom exceeded");
        await options.assertPairBudget?.(assetBytes);
      };
      await assertPairBudget(0);
      const verifyFiles = async (pair: string) => {
        lease.assertActive();
        for (const [file, expected] of files) {
          const bytes = await regularBytes(
            pair,
            file,
            Math.max(options.paths.maxGenerationBytes, 32 * 1024 ** 2),
          );
          if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256)
            throw Error("Restored content file checksum mismatch");
        }
        const copiedPaths = {
          ...options.paths,
          root: copiedRoot,
          active: join(copiedRoot, "active"),
          media: join(copiedRoot, "media"),
          generations: join(copiedRoot, "generations"),
        };
        if ((await readActiveContent(copiedPaths))?.manifest.id !== active?.manifest.id)
          throw Error("Restored content active pointer mismatch");
      };
      const receipt = await createProfileBackup({
        ...options,
        assertPairBudget,
        preparePair: async (pair) => {
          copiedRoot = join(pair, "content");
          pinsRoot = join(pair, "content-assets");
          for (const dir of [
            copiedRoot,
            join(copiedRoot, "media"),
            join(copiedRoot, "generations"),
            pinsRoot,
          ])
            await mkdir(dir, { recursive: true, mode: 0o700 });
          for (const [file, expected] of files) {
            lease.assertActive();
            const info = await lstat(expected.source);
            if (
              !info.isFile() ||
              info.isSymbolicLink() ||
              (await realpath(expected.source)) !== resolve(expected.source)
            )
              throw Error("Unsafe backup source file");
            const bytes = await readFile(expected.source);
            if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256)
              throw Error("Content changed under backup lease");
            await write(join(pair, file), bytes);
          }
          await verifyFiles(pair);
          await options.preparePair?.(pair);
        },
        verifyRestored: async (connection, database) => {
          await connection.query("USE `" + database + "`");
          try {
            const restored = await contentSchemaStatus(
              connection,
              resolve(__dirname, "../../content-migrations"),
            );
            if (JSON.stringify(restored) !== JSON.stringify(status))
              throw Error("Restored content schema mismatch");
          } finally {
            await connection.query("USE `" + options.database.database + "`");
          }
          if (
            status.state === "complete" &&
            JSON.stringify(await variants(connection, database)) !== JSON.stringify(refs)
          )
            throw Error("Restored content media reference mismatch");
          await verifyFiles(dirname(copiedRoot));
          await options.verifyRestored?.(connection, database);
        },
      });
      await verifyFiles(dirname(copiedRoot));
      const text = JSON.stringify({
        schemaVersion: 1,
        releaseId: options.releaseId,
        database: { sha256: receipt.sha256, bytes: receipt.bytes },
        profileManifestSha256: receipt.manifestSha256,
        generationId: active?.manifest.id ?? null,
        lockContract: {
          version: 1,
          path: options.paths.deployLock,
          mechanism: process.platform === "win32" ? "owned-parent-holder-nonce" : "flock",
        },
        generations: Object.fromEntries(generations),
        files: Object.fromEntries(
          [...files].map(([name, value]) => [name, { sha256: value.sha256, bytes: value.bytes }]),
        ),
      });
      manifestPath = join(dirname(copiedRoot), "content-manifest.json");
      await write(manifestPath, text);
      await write(manifestPath + ".sha256", digest(text));
      await flushTree(dirname(copiedRoot));
      return {
        ...receipt,
        content: true as const,
        generationId: active?.manifest.id ?? null,
        contentDirectory: copiedRoot,
        pinsDirectory: pinsRoot,
        contentManifestPath: manifestPath,
        contentManifestSha256: digest(text),
        contentBytes: copyBytes,
      };
    } finally {
      c.release();
    }
  });
}
