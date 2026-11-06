import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile, readFile, readdir, lstat, open } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { createVerifiedBackup, type BackupReceipt } from "../db/backup";
import { createAvatarStore, type StoredAvatar } from "./avatar-store";
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
async function digest(file: string) {
  const h = createHash("sha256");
  for await (const bytes of createReadStream(file)) h.update(bytes);
  return h.digest("hex");
}
export async function withProfileAssetLock<T>(
  pool: Pool,
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const c = await pool.getConnection();
  let locked = false;
  try {
    const [[row]] = await c.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-profile-assets:',LEFT(SHA2(DATABASE(),256),32)),10) acquired",
    );
    if (row.acquired !== 1) throw new Error("Profile asset lock unavailable");
    locked = true;
    return await work(c);
  } finally {
    try {
      if (locked)
        await c.query(
          "SELECT RELEASE_LOCK(CONCAT('bibi-profile-assets:',LEFT(SHA2(DATABASE(),256),32)))",
        );
    } finally {
      c.release();
    }
  }
}
async function references(c: PoolConnection, database?: string): Promise<StoredAvatar[]> {
  if (database && !/^[a-zA-Z0-9_]{1,64}$/.test(database)) throw new Error("Invalid verifier");
  const [[exists]] = await c.execute<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=COALESCE(?,DATABASE()) AND table_name='users' AND column_name='avatar_id'",
    [database ?? null],
  );
  if (!Number(exists.n)) return [];
  const prefix = database ? "`" + database + "`." : "";
  const [rows] = await c.query<RowDataPacket[]>(
    `SELECT u.avatar_id pointer,a.* FROM ${prefix}users u LEFT JOIN ${prefix}profile_avatar_assets a ON a.id=u.avatar_id AND a.user_id=u.id WHERE u.avatar_id IS NOT NULL ORDER BY u.avatar_id`,
  );
  if (rows.length > 10000) throw new Error("Profile backup asset count exceeds limit");
  return rows.map((row) => {
    if (!row.id || row.retired_at) throw new Error("Invalid referenced profile asset");
    return {
      id: String(row.id),
      format: row.format,
      width: Number(row.width),
      height: Number(row.height),
      byteLength: Number(row.bytes),
      sha256: String(row.sha256),
    };
  });
}
interface PairedManifest {
  version: 1;
  releaseId: string;
  database: { file: string; sha256: string; bytes: number };
  assets: StoredAvatar[];
}
async function privateDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  return createAvatarStore({ root: directory });
}
async function flushWrite(file: string, bytes: Buffer | string) {
  const handle = await open(file, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function createProfileBackup(
  options: Parameters<typeof createVerifiedBackup>[0] & { assetDirectory: string },
): Promise<
  BackupReceipt & {
    profiles: true;
    assetCount: number;
    manifestPath: string;
    manifestSha256: string;
    assetsDirectory: string;
  }
> {
  const source = createAvatarStore({ root: options.assetDirectory });
  await privateDirectory(options.directory);
  return withProfileAssetLock(options.pool, async (c) => {
    const assets = await references(c),
      pair = join(options.directory, "profile-" + randomUUID()),
      assetsDirectory = join(pair, "assets");
    await privateDirectory(pair);
    const snapshot = await privateDirectory(assetsDirectory);
    let total = 0;
    for (const asset of assets) {
      const bytes = await source.read(asset);
      total += bytes.length;
      if (total > 1024 ** 3) throw new Error("Profile snapshot exceeds size limit");
      await flushWrite(join(assetsDirectory, asset.id + "." + asset.format), bytes);
      await snapshot.read(asset);
    }
    const receipt = await createVerifiedBackup({
      ...options,
      directory: pair,
      verifyRestored: async (connection, database) => {
        const restored = await references(connection, database);
        if (JSON.stringify(restored) !== JSON.stringify(assets))
          throw new Error("Restored profile reference mismatch");
        for (const asset of restored) await snapshot.read(asset);
        await options.verifyRestored?.(connection, database);
      },
    });
    const manifest: PairedManifest = {
      version: 1,
      releaseId: options.releaseId,
      database: {
        file: receipt.path.slice(pair.length + 1),
        sha256: receipt.sha256,
        bytes: receipt.bytes,
      },
      assets,
    };
    const text = JSON.stringify(manifest, null, 2) + "\n",
      manifestPath = join(pair, "manifest.json");
    await flushWrite(manifestPath, text);
    await flushWrite(manifestPath + ".sha256", hash(text));
    if (process.platform !== "win32")
      for (const dir of [assetsDirectory, pair, options.directory]) {
        const h = await open(dir, "r");
        try {
          await h.sync();
        } finally {
          await h.close();
        }
      }
    return {
      ...receipt,
      profiles: true,
      assetCount: assets.length,
      manifestPath,
      manifestSha256: hash(text),
      assetsDirectory,
    };
  });
}
async function backupPins(directory: string): Promise<Set<string>> {
  await privateDirectory(directory);
  const pins = new Set<string>();
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.length > 10000) throw new Error("Too many backups; inspect retention");
  for (const entry of entries) {
    if (!entry.name.startsWith("profile-")) continue;
    if (
      !/^profile-[a-f0-9-]{36}$/.test(entry.name) ||
      !entry.isDirectory() ||
      entry.isSymbolicLink()
    )
      throw new Error("Unsafe profile backup");
    const pair = join(directory, entry.name);
    createAvatarStore({ root: pair });
    const path = join(pair, "manifest.json"),
      stat = await lstat(path);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size > 4 * 1024 ** 2 ||
      (process.platform !== "win32" &&
        ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()))
    )
      throw new Error("Unsafe profile backup manifest");
    const text = await readFile(path, "utf8"),
      sidecar = path + ".sha256",
      sideStat = await lstat(sidecar);
    if (
      !sideStat.isFile() ||
      sideStat.isSymbolicLink() ||
      sideStat.size !== 64 ||
      (await readFile(sidecar, "utf8")) !== hash(text)
    )
      throw new Error("Corrupt profile backup manifest");
    const manifest = JSON.parse(text) as PairedManifest;
    if (
      manifest.version !== 1 ||
      !Array.isArray(manifest.assets) ||
      manifest.assets.length > 10000 ||
      !/^[a-f0-9]{40}-[1-9][0-9]*-[a-f0-9-]{36}\.sql$/.test(manifest.database?.file ?? "")
    )
      throw new Error("Invalid profile backup manifest");
    const db = join(pair, manifest.database.file),
      dbstat = await lstat(db);
    if (
      !dbstat.isFile() ||
      dbstat.isSymbolicLink() ||
      dbstat.size !== manifest.database.bytes ||
      (await digest(db)) !== manifest.database.sha256
    )
      throw new Error("Corrupt paired database backup");
    const store = createAvatarStore({ root: join(pair, "assets") });
    for (const asset of manifest.assets) {
      await store.read(asset);
      pins.add(asset.id);
    }
  }
  return pins;
}
export async function cleanupProfileAssets({
  pool,
  assetDirectory,
  backupDirectory,
  now = new Date(),
}: {
  pool: Pool;
  assetDirectory: string;
  backupDirectory: string;
  now?: Date;
}): Promise<{ removed: number; orphans: number }> {
  if (!Number.isFinite(+now)) throw new Error("Invalid cleanup time");
  const store = createAvatarStore({ root: assetDirectory });
  return withProfileAssetLock(pool, async (c) => {
    const pins = await backupPins(backupDirectory);
    let removed = 0,
      orphans = 0;
    const [rows] = await c.execute<RowDataPacket[]>(
      "SELECT a.* FROM profile_avatar_assets a WHERE retired_at<=? AND NOT EXISTS(SELECT 1 FROM users u WHERE u.avatar_id=a.id)",
      [new Date(+now - 30 * 86400000)],
    );
    for (const row of rows) {
      if (pins.has(row.id)) continue;
      await store.remove(row.id, row.format);
      await c.execute(
        "DELETE FROM profile_avatar_assets WHERE id=? AND NOT EXISTS(SELECT 1 FROM users WHERE avatar_id=?)",
        [row.id, row.id],
      );
      removed++;
    }
    for (const entry of await readdir(assetDirectory, { withFileTypes: true })) {
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpeg)$/.test(
          entry.name,
        )
      )
        continue;
      const id = entry.name.slice(0, 36),
        format = entry.name.slice(37);
      if (format !== "png" && format !== "jpeg") continue;
      if (pins.has(id)) continue;
      const [[row]] = await c.execute<RowDataPacket[]>(
        "SELECT COUNT(*) n FROM profile_avatar_assets WHERE id=?",
        [id],
      );
      if (Number(row.n)) continue;
      const stat = await lstat(join(assetDirectory, entry.name));
      if (+now - stat.mtimeMs < 86400000) continue;
      await store.remove(id, format);
      orphans++;
    }
    return { removed, orphans };
  });
}
