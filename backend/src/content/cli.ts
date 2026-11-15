import { resolve, dirname, basename } from "node:path";
import { readDbConfig } from "../config";
import { readPrivateEnvironment } from "../db/private-env";
import { createDbPool } from "../db/pool";
import { migrateContent, contentSchemaStatus } from "./schema";
import { syncContentPermissions } from "./capabilities";
export function contentEnvironment(file: string | undefined, env: NodeJS.ProcessEnv): void {
  if (
    env.NODE_ENV === "production" &&
    (!file ||
      basename(dirname(file)) !== "private" ||
      !env.BIBI_CONTENT_ROOT ||
      resolve(env.BIBI_CONTENT_ROOT) !== resolve(dirname(file), "../content"))
  )
    throw Error("Fixed private content configuration required");
}
async function main() {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length || !["migrate", "status"].includes(command))
    throw Error("Invalid content command");
  const file = process.env.BIBI_PRIVATE_ENV_FILE,
    env = readPrivateEnvironment(file);
  env.NODE_ENV = process.env.NODE_ENV;
  contentEnvironment(file, env);
  const pool = createDbPool({ ...readDbConfig(env), connectionLimit: 2 }),
    directory = resolve(__dirname, "../../content-migrations");
  try {
    if (command === "migrate") {
      await migrateContent(pool, directory);
      await syncContentPermissions(pool);
    }
    const status = await contentSchemaStatus(pool, directory);
    console.log(JSON.stringify(status));
    if (status.state === "dirty") process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Content operation failed; inspect private config/schema",
      }),
    );
    process.exitCode = 1;
  });
