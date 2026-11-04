import { writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { readDbConfig } from "../config";
import { createDbPool } from "./pool";
import { createVerifiedBackup } from "./backup";
import { readPrivateEnvironment } from "./private-env";

async function main() {
  const file = process.env.BIBI_MAINTENANCE_ENV_FILE;
  const env = readPrivateEnvironment(file);
  if (!file || basename(dirname(file)) !== "private")
    throw new Error("Private deployment directory required");
  const database = readDbConfig(env);
  const flavor = env.DB_BACKUP_FLAVOR;
  if (flavor !== "mariadb" && flavor !== "mysql")
    throw new Error("Measured backup flavor required");
  const pool = createDbPool(database);
  try {
    const receipt = await createVerifiedBackup({
      pool,
      database,
      verifyDatabase: env.DB_VERIFY_NAME ?? "",
      directory: resolve(dirname(file), "../backups"),
      releaseId: process.argv[2] ?? "",
      flavor,
      dumpBin: env.DB_DUMP_BIN,
      clientBin: env.DB_CLIENT_BIN,
    });
    await writeFile(receipt.path + ".receipt.json", JSON.stringify(receipt, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    const { path: _privatePath, ...summary } = receipt;
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
        error: "Backup/isolated restore verification failed; activation is forbidden",
      }),
    );
    process.exitCode = 1;
  });
