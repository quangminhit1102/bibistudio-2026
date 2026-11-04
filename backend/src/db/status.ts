import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, RowDataPacket } from "mysql2/promise";

export async function readSchemaStatus(pool: Pool, directory: string) {
  const [[ledger]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='schema_migrations'",
  );
  if (!Number(ledger.n))
    return { version: 0, state: "empty", migrationChecksums: {}, ready: false };
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT version,state,checksum FROM schema_migrations ORDER BY version",
  );
  const files = (await readdir(directory))
    .filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name))
    .sort();
  const migrationChecksums: Record<string, string> = {};
  let valid = rows.length === files.length && rows.length > 0;
  for (const [index, row] of rows.entries()) {
    const file = files.find((name) => Number(name.slice(0, 3)) === row.version);
    if (!file || row.version !== index + 1) {
      valid = false;
      continue;
    }
    migrationChecksums[file] = row.checksum;
    const hash = createHash("sha256")
      .update(await readFile(join(directory, file)))
      .digest("hex");
    if (hash !== row.checksum || row.state !== "complete") valid = false;
  }
  return {
    version: rows.at(-1)?.version ?? 0,
    state: valid ? "complete" : "dirty",
    migrationChecksums,
    ready: valid,
  };
}
