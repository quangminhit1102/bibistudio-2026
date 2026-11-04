import { resolve } from "node:path";
import { readDbConfig } from "../config";
import { createDbPool } from "./pool";
import { migrate } from "./migrate";
import { seedIdentity } from "./seed";
import { cleanupAnalytics } from "../visitors/cleanup";
import { readSchemaStatus } from "./status";
import { readPrivateEnvironment } from "./private-env";
import { seedProbeIdentity } from "./probe-identity";

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!["migrate", "seed", "status", "analytics:cleanup"].includes(command)) {
    throw new Error("Use migrate, seed, status or analytics:cleanup");
  }
  const pool = createDbPool(readDbConfig());
  try {
    if (command === "migrate") {
      console.log(JSON.stringify(await migrate(pool, resolve(__dirname, "../../migrations"))));
    } else if (command === "seed") {
      const masterPassword = process.env.MASTER_ADMIN_PASSWORD || "";
      const userPassword = process.env.SEED_USER_PASSWORD || "";
      await seedIdentity(pool, { masterPassword, userPassword });
      if (process.env.RELEASE_PROBE_PASSWORD || process.env.NODE_ENV === "production")
        await seedProbeIdentity(pool, process.env.RELEASE_PROBE_PASSWORD ?? "");
      console.log(JSON.stringify({ ok: true }));
    } else if (command === "analytics:cleanup") {
      console.log(JSON.stringify(await cleanupAnalytics(pool, new Date(), 100)));
    } else {
      console.log(
        JSON.stringify(await readSchemaStatus(pool, resolve(__dirname, "../../migrations"))),
      );
    }
  } finally {
    await pool.end();
  }
}

void (async () => {
  if (process.env.BIBI_PRIVATE_ENV_FILE) {
    const env = readPrivateEnvironment(process.env.BIBI_PRIVATE_ENV_FILE);
    for (const key of Object.keys(process.env))
      if (/^(DB_|MASTER_ADMIN_PASSWORD$|SEED_USER_PASSWORD$|RELEASE_PROBE_PASSWORD$)/.test(key))
        delete process.env[key];
    Object.assign(process.env, env);
  }
  await main();
})().catch(() => {
  // mysql errors can contain SQL and connection details. CLI reports a safe failure only.
  console.error(
    JSON.stringify({
      ok: false,
      error: "Database operation failed; check private configuration and migration status",
    }),
  );
  process.exitCode = 1;
});
