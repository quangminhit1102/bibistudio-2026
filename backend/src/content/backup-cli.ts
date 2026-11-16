import { resolve, dirname, basename } from "node:path";
import { mkdir, lstat } from "node:fs/promises";
import { readDbConfig } from "../config";
import { readPrivateEnvironment } from "../db/private-env";
import { createDbPool } from "../db/pool";
import { profileEnvironment } from "../profile/cli";
import { contentEnvironment } from "./cli";
import { readContentPaths } from "./capabilities";
import { createContentBackup } from "./backup";
async function main() {
  const file = process.env.BIBI_MAINTENANCE_ENV_FILE,
    env = readPrivateEnvironment(file);
  if (!file || basename(dirname(file)) !== "private" || process.argv.length !== 3)
    throw Error("Fixed private maintenance configuration required");
  env.NODE_ENV = process.env.NODE_ENV;
  env.BIBI_PRIVATE_ENV_FILE = file;
  contentEnvironment(file, env);
  const paths = readContentPaths(env),
    profiles = profileEnvironment(file, env),
    database = readDbConfig(env);
  if (!paths || !env.BIBI_CONTENT_ASSET_ROOT) throw Error("Private content configuration required");
  let cutover = false;
  try {
    await lstat(resolve(dirname(file), "content-routing.json"));
    cutover = true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  for (const dir of [paths.root, paths.media, paths.generations]) {
    if (!cutover) await mkdir(dir, { recursive: true, mode: 0o700 });
    if (!(await lstat(dir)).isDirectory()) throw Error("Missing content storage");
  }
  const flavor = env.DB_BACKUP_FLAVOR;
  if (flavor !== "mysql" && flavor !== "mariadb")
    throw Error("Measured native backup flavor required");
  const pool = createDbPool({ ...database, connectionLimit: 4 });
  try {
    const deployment = resolve(dirname(file), ".."),
      bootstrapFiles: Record<string, string> = {};
    for (const [name, source] of Object.entries({
      "content-reader.json": resolve(dirname(file), "content-reader.json"),
      "content-routing.json": resolve(dirname(file), "content-routing.json"),
      "content-initial-routing.json": resolve(dirname(file), "content-initial-routing.json"),
      "content-reader.php": resolve(deployment, "public-reader/content-reader.php"),
      "loader.php": resolve(env.BIBI_CONTENT_ASSET_ROOT, "_bibi-content/reader.php"),
      "root.htaccess": resolve(env.BIBI_CONTENT_ASSET_ROOT, ".htaccess"),
    })) {
      try {
        await lstat(source);
        bootstrapFiles[name] = source;
      } catch (error) {
        if (cutover || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const receipt = await createContentBackup({
      pool,
      database,
      verifyDatabase: env.DB_VERIFY_NAME ?? "",
      directory: resolve(dirname(file), "../backups"),
      assetDirectory: profiles.assetDirectory,
      paths,
      assetRoot: env.BIBI_CONTENT_ASSET_ROOT,
      releaseId: process.argv[2],
      flavor,
      dumpBin: env.DB_DUMP_BIN,
      clientBin: env.DB_CLIENT_BIN,
      bootstrapFiles,
    });
    const {
      path: _path,
      manifestPath: _manifest,
      assetsDirectory: _assets,
      contentDirectory: _content,
      pinsDirectory: _pins,
      contentManifestPath: _contentManifest,
      ...summary
    } = receipt;
    console.log(JSON.stringify(summary));
  } finally {
    await pool.end();
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Paired content backup/restore failed; activation forbidden",
      }),
    );
    process.exitCode = 1;
  });
