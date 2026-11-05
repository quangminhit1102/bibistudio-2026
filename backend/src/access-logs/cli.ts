import { resolve } from "node:path";
import { readDbConfig, systemClock } from "../config";
import { createDbPool } from "../db/pool";
import { readPrivateEnvironment } from "../db/private-env";
import { readAccessLogConfig } from "./config";
import { migrateAccessLogs, readAccessLogSchema } from "./schema";
import { syncAccessLogArchives } from "./importer";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["migrate", "status", "sync"].includes(args[0]))
    throw new Error("Invalid command");
  const env = readPrivateEnvironment(process.env.BIBI_PRIVATE_ENV_FILE);
  const pool = createDbPool({ ...readDbConfig(env), connectionLimit: 1 });
  const directory = resolve(__dirname, "../../access-log-migrations");
  try {
    if (args[0] === "migrate") await migrateAccessLogs(pool, directory);
    const status = await readAccessLogSchema(pool, directory);
    if (args[0] !== "sync") {
      console.log(JSON.stringify(status));
      process.exitCode = status.state === "complete" || status.state === "empty" ? 0 : 1;
      return;
    }
    if (status.state !== "complete") throw new Error("Feature schema not ready");
    const config = readAccessLogConfig(env);
    const receipt = await syncAccessLogArchives({
      pool,
      config,
      clock: systemClock,
      signal: AbortSignal.timeout(config.limits.runMs),
    });
    console.log(JSON.stringify(receipt));
    process.exitCode = receipt.state === "complete" ? 0 : receipt.state === "pending" ? 2 : 1;
  } finally {
    await pool.end();
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Access log operation failed; inspect private configuration and schema status",
      }),
    );
    process.exitCode = 1;
  });
