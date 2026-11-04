import { resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { readDbConfig } from "../config";
import { createDbPool } from "./pool";
import { migrate } from "./migrate";
import { seedIdentity } from "./seed";

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!["migrate", "seed", "status"].includes(command)) {
    throw new Error("Use migrate, seed or status");
  }
  const pool = createDbPool(readDbConfig());
  try {
    if (command === "migrate") {
      console.log(JSON.stringify(await migrate(pool, resolve(__dirname, "../../migrations"))));
    } else if (command === "seed") {
      const masterPassword = process.env.MASTER_ADMIN_PASSWORD || "";
      const userPassword = process.env.SEED_USER_PASSWORD || "";
      if (!masterPassword || !userPassword) throw new Error("Bootstrap secrets missing");
      await seedIdentity(pool, { masterPassword, userPassword });
      console.log(JSON.stringify({ ok: true }));
    } else {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT version,state FROM schema_migrations ORDER BY version",
      );
      console.log(
        JSON.stringify({
          version: rows.at(-1)?.version ?? 0,
          ready: rows.length === 4 && rows.every((row) => row.state === "complete"),
        }),
      );
    }
  } finally {
    await pool.end();
  }
}

void main().catch(() => {
  // mysql errors can contain SQL and connection details. CLI reports a safe failure only.
  console.error(
    JSON.stringify({
      ok: false,
      error: "Database operation failed; check private configuration and migration status",
    }),
  );
  process.exitCode = 1;
});
