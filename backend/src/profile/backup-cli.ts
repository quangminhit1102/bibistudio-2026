import { resolve, dirname, basename } from "node:path";
import { readDbConfig } from "../config";
import { readPrivateEnvironment } from "../db/private-env";
import { createDbPool } from "../db/pool";
import { profileEnvironment } from "./cli";
import { createProfileBackup } from "./backup";
async function main() {
  const file = process.env.BIBI_MAINTENANCE_ENV_FILE,
    env = readPrivateEnvironment(file);
  env.NODE_ENV = process.env.NODE_ENV;
  if (!file || basename(dirname(file)) !== "private") throw new Error("Private directory required");
  const config = profileEnvironment(file, env),
    database = readDbConfig(env),
    pool = createDbPool({ ...database, connectionLimit: 3 });
  const flavor = env.DB_BACKUP_FLAVOR;
  if (flavor !== "mysql" && flavor !== "mariadb")
    throw new Error("Measured backup flavor required");
  try {
    const receipt = await createProfileBackup({
      pool,
      database,
      verifyDatabase: env.DB_VERIFY_NAME ?? "",
      directory: resolve(dirname(file), "../backups"),
      assetDirectory: config.assetDirectory,
      releaseId: process.argv[2] ?? "",
      flavor,
      dumpBin: env.DB_DUMP_BIN,
      clientBin: env.DB_CLIENT_BIN,
    });
    const { path: _path, manifestPath: _manifest, assetsDirectory: _assets, ...summary } = receipt;
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
        error: "Paired profile backup/restore failed; activation forbidden",
      }),
    );
    process.exitCode = 1;
  });
