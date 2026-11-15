import { resolve, dirname, basename, isAbsolute } from "node:path";
import { readDbConfig, systemClock } from "../config";
import { readPrivateEnvironment } from "../db/private-env";
import { createDbPool } from "../db/pool";
import { migrateContent, contentSchemaStatus } from "./schema";
import { syncContentPermissions, readContentPaths } from "./capabilities";
import { createContentMedia } from "./media/service";
import { importContentSeed } from "./seed";
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
  if (extra.length || !["migrate", "status", "seed"].includes(command))
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
    if (command === "seed") {
      const paths = readContentPaths(env);
      if (!paths || (await contentSchemaStatus(pool, directory)).state !== "complete")
        throw Error("Migrated private content storage required");
      const localSource =
        env.NODE_ENV !== "production" ? env.BIBI_CONTENT_SEED_DIRECTORY : undefined;
      if (localSource && !isAbsolute(localSource))
        throw Error("Absolute local seed directory required");
      const receipt = await importContentSeed({
        pool,
        media: createContentMedia({ pool, paths, clock: systemClock }),
        seedDirectory: localSource ?? resolve(__dirname, "../../content-seed"),
        clock: systemClock,
      });
      console.log(JSON.stringify(receipt));
      return;
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
