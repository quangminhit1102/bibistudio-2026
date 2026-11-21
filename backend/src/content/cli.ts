import { resolve, dirname, basename } from "node:path";
import { readDbConfig } from "../config";
import { readPrivateEnvironment } from "../db/private-env";
import { createDbPool } from "../db/pool";
import { migrateContent, contentSchemaStatus } from "./schema";

async function main() {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length || !["migrate", "status"].includes(command))
    throw new Error("Invalid content command");
  const file = process.env.BIBI_PRIVATE_ENV_FILE;
  if (process.env.NODE_ENV === "production" && (!file || basename(dirname(file)) !== "private"))
    throw new Error("Fixed private environment required");
  const env = readPrivateEnvironment(file);
  const pool = createDbPool({ ...readDbConfig(env), connectionLimit: 2 });
  const directory = resolve(__dirname, "../../content-migrations");
  try {
    if (command === "migrate") await migrateContent(pool, directory);
    const status = await contentSchemaStatus(pool, directory);
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
        error: "Content operation failed; inspect private config/schema",
      }),
    );
    process.exitCode = 1;
  });
