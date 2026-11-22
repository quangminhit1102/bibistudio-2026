import { resolve, dirname, basename } from "node:path";
import { readFile } from "node:fs/promises";
import { readDbConfig } from "../config";
import { readPrivateEnvironment } from "../db/private-env";
import { createDbPool } from "../db/pool";
import { migrateContent, contentSchemaStatus } from "./schema";
import { seedContent, type ContentSeedData } from "./seed";

async function main() {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length || !["migrate", "status", "seed"].includes(command))
    throw new Error("Invalid content command");
  const file = process.env.BIBI_PRIVATE_ENV_FILE;
  if (process.env.NODE_ENV === "production" && (!file || basename(dirname(file)) !== "private"))
    throw new Error("Fixed private environment required");
  const env = readPrivateEnvironment(file);
  const pool = createDbPool({ ...readDbConfig(env), connectionLimit: 2 });
  const directory = resolve(__dirname, "../../content-migrations");
  try {
    if (command === "seed") {
      const data = JSON.parse(
        await readFile(resolve(__dirname, "../../content-seed.json"), "utf8"),
      ) as ContentSeedData;
      const inserted = await seedContent(pool, data);
      console.log(JSON.stringify({ ok: true, inserted }));
      return;
    }
    if (command === "migrate") await migrateContent(pool, directory);
    const status = await contentSchemaStatus(pool, directory);
    console.log(JSON.stringify(status));
    if (!["empty", "dirty", "complete"].includes(status.state)) process.exitCode = 1;
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
