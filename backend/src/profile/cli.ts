import { resolve, dirname, basename } from "node:path";
import { readDbConfig, readProfileConfig } from "../config";
import { readPrivateEnvironment } from "../db/private-env";
import { createDbPool } from "../db/pool";
import { migrateProfiles, profileSchemaStatus } from "./schema";
import { cleanupProfileAssets } from "./backup";
import { createAvatarStore } from "./avatar-store";
export function profileEnvironment(file: string | undefined, env: NodeJS.ProcessEnv) {
  const config = readProfileConfig(env);
  if (!config) throw new Error("Private profile assets required");
  if (
    env.NODE_ENV === "production" &&
    (!file ||
      basename(dirname(file)) !== "private" ||
      resolve(config.assetDirectory) !== resolve(dirname(file), "profile-assets"))
  )
    throw new Error("Fixed private profile asset directory required");
  createAvatarStore({ root: config.assetDirectory });
  return config;
}
async function main() {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length || !["migrate", "status", "cleanup"].includes(command))
    throw new Error("Invalid profile command");
  const file = process.env.BIBI_PRIVATE_ENV_FILE,
    env = readPrivateEnvironment(file);
  env.NODE_ENV = process.env.NODE_ENV;
  const config = profileEnvironment(file, env),
    pool = createDbPool({ ...readDbConfig(env), connectionLimit: 2 }),
    directory = resolve(__dirname, "../../profile-migrations");
  try {
    if (command === "migrate") await migrateProfiles(pool, directory);
    if (command === "cleanup") {
      if (!file) throw new Error("Private backup directory required");
      console.log(
        JSON.stringify(
          await cleanupProfileAssets({
            pool,
            assetDirectory: config.assetDirectory,
            backupDirectory: resolve(dirname(file), "../backups"),
          }),
        ),
      );
      return;
    }
    const status = await profileSchemaStatus(pool, directory);
    console.log(JSON.stringify(status));
    if (!["empty", "complete"].includes(status.state)) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Profile operation failed; inspect private config/schema",
      }),
    );
    process.exitCode = 1;
  });
