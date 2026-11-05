import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const tables = [
  "access_log_sources",
  "access_log_records",
  "access_log_import_runs",
  "access_log_current_sources",
  "access_log_current_records",
];
interface Asset {
  version: number;
  name: string;
  checksum: string;
  steps: string[];
}
export interface AccessLogSchemaStatus {
  state: "empty" | "complete" | "dirty";
  version: number;
  checksums: Record<string, string>;
}
async function assets(directory: string): Promise<Asset[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  if (!names.length) throw new Error("Access log migration assets missing");
  return Promise.all(
    names.map(async (name, index) => {
      if (!/^\d{3}_[a-z_]+\.sql$/.test(name) || +name.slice(0, 3) !== index + 1)
        throw new Error("Invalid access log migration sequence");
      const sql = await readFile(join(directory, name), "utf8");
      const steps = sql
        .split(";")
        .map((step) => step.trim())
        .filter(Boolean);
      if (
        !steps.length ||
        steps.some((step) => !tables.includes(/^CREATE TABLE ([a-z_]+)\s*\(/.exec(step)?.[1] ?? ""))
      )
        throw new Error("Invalid access log DDL asset");
      return { version: index + 1, name, checksum: hash(sql), steps };
    }),
  );
}
async function history(
  connection: Pool | PoolConnection,
): Promise<{ exists: boolean; untracked: boolean; rows: RowDataPacket[] }> {
  const [found] = await connection.query<RowDataPacket[]>(
    "SELECT table_name name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('access_log_migrations','access_log_sources','access_log_records','access_log_import_runs','access_log_current_sources','access_log_current_records')",
  );
  const exists = found.some((row) => row.name === "access_log_migrations");
  return {
    exists,
    untracked: !exists && found.length > 0,
    rows: exists
      ? (
          await connection.query<RowDataPacket[]>(
            "SELECT * FROM access_log_migrations ORDER BY version",
          )
        )[0]
      : [],
  };
}
async function verifyHistory(
  connection: Pool | PoolConnection,
  list: Asset[],
  rows: RowDataPacket[],
): Promise<void> {
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index],
      asset = list.find((a) => a.version === row.version);
    if (!asset || row.version !== index + 1) throw new Error("Unknown access log schema history");
    if (row.checksum !== asset.checksum) throw new Error("Access log migration checksum mismatch");
    if (row.state !== "complete" || row.completed_steps !== asset.steps.length)
      throw new Error("Dirty access log schema; inspect before recovery");
    const ddl = typeof row.ddl_hashes === "string" ? JSON.parse(row.ddl_hashes) : row.ddl_hashes;
    for (const step of asset.steps) {
      const table = /^CREATE TABLE ([a-z_]+)\s*\(/.exec(step)![1];
      try {
        const [[actual]] = await connection.query<RowDataPacket[]>(
          `SHOW CREATE TABLE \`${table}\``,
        );
        if (hash(String(actual["Create Table"])) !== ddl[table]) throw new Error("drift");
      } catch {
        throw new Error("Dirty access log DDL; manual inspection required");
      }
    }
  }
}
export async function readAccessLogSchema(
  pool: Pool,
  directory: string,
): Promise<AccessLogSchemaStatus> {
  const list = await assets(directory),
    prior = await history(pool);
  const checksums = Object.fromEntries(
    prior.rows.map((row) => [
      list.find((a) => a.version === row.version)?.name ?? String(row.version),
      String(row.checksum),
    ]),
  );
  const version = Number(prior.rows.at(-1)?.version ?? 0);
  if (prior.untracked) return { state: "dirty", version, checksums };
  try {
    await verifyHistory(pool, list, prior.rows);
  } catch {
    return { state: "dirty", version, checksums };
  }
  return { state: prior.rows.length === list.length ? "complete" : "empty", version, checksums };
}
export async function migrateAccessLogs(pool: Pool, directory: string): Promise<void> {
  const list = await assets(directory),
    connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-access-logs:',LEFT(SHA2(DATABASE(),256),32)),10) acquired",
    );
    if (lock.acquired !== 1) throw new Error("Access log migration lock unavailable");
    locked = true;
    const prior = await history(connection);
    if (prior.untracked) throw new Error("Untracked access log tables; manual inspection required");
    await verifyHistory(connection, list, prior.rows);
    if (!prior.exists)
      await connection.query(`CREATE TABLE access_log_migrations (
      version INT UNSIGNED PRIMARY KEY, checksum CHAR(64) NOT NULL,
      state VARCHAR(20) NOT NULL, completed_steps INT UNSIGNED NOT NULL DEFAULT 0,
      ddl_hashes JSON NOT NULL, applied_at DATETIME(3) NULL
    ) ENGINE=InnoDB`);
    for (const asset of list) {
      if (prior.rows.some((row) => row.version === asset.version)) continue;
      await connection.execute(
        "INSERT INTO access_log_migrations(version,checksum,state,ddl_hashes) VALUES (?,?,'dirty','{}')",
        [asset.version, asset.checksum],
      );
      const ddlHashes: Record<string, string> = {};
      for (let i = 0; i < asset.steps.length; i++) {
        await connection.query(asset.steps[i]);
        const table = /^CREATE TABLE ([a-z_]+)\s*\(/.exec(asset.steps[i])![1];
        const [[created]] = await connection.query<RowDataPacket[]>(
          `SHOW CREATE TABLE \`${table}\``,
        );
        ddlHashes[table] = hash(String(created["Create Table"]));
        await connection.execute(
          "UPDATE access_log_migrations SET completed_steps=?,ddl_hashes=? WHERE version=?",
          [i + 1, JSON.stringify(ddlHashes), asset.version],
        );
      }
      await connection.execute(
        "UPDATE access_log_migrations SET state='complete',applied_at=UTC_TIMESTAMP(3) WHERE version=?",
        [asset.version],
      );
    }
  } finally {
    try {
      if (locked)
        await connection.query(
          "SELECT RELEASE_LOCK(CONCAT('bibi-access-logs:',LEFT(SHA2(DATABASE(),256),32)))",
        );
    } finally {
      connection.release();
    }
  }
}
