import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";

type Connection = Pool | PoolConnection;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const targets = [
  "product_categories",
  "content_categories",
  "posts",
  "products",
  "customers",
] as const;

export interface ContentSchemaStatus {
  version: number;
  state: "empty" | "complete" | "dirty" | "incompatible";
  migrationChecksums: Record<string, string>;
}

async function asset(directory: string) {
  const names = (await readdir(directory)).filter((n) => n.endsWith(".sql")).sort();
  if (names.join() !== "001_content.sql") throw new Error("Unknown content migration assets");
  const sql = await readFile(join(directory, names[0]), "utf8");
  const steps = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    steps.length !== 5 ||
    steps.some(
      (step) =>
        !/^CREATE TABLE (product_categories|content_categories|posts|products|customers) /.test(
          step,
        ),
    )
  )
    throw new Error("Invalid content DDL assets");
  return { name: names[0], checksum: digest(sql), steps };
}

async function fingerprint(c: Connection, target: string): Promise<string | null> {
  const [[exists]] = await c.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
    [target],
  );
  if (!exists.n) return null;
  const [[ddl]] = await c.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${target}\``);
  return digest(String(ddl["Create Table"]));
}

async function history(c: Connection): Promise<RowDataPacket[]> {
  const [[exists]] = await c.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='content_schema_migrations'",
  );
  return exists.n
    ? (
        await c.query<RowDataPacket[]>("SELECT * FROM content_schema_migrations ORDER BY version")
      )[0]
    : [];
}

async function verify(c: Connection, row: RowDataPacket) {
  const hashes: Record<string, string> =
    typeof row.ddl_hashes === "string" ? JSON.parse(row.ddl_hashes) : row.ddl_hashes;
  if (!Number.isInteger(row.completed_steps) || row.completed_steps < 0 || row.completed_steps > 5)
    throw new Error("Dirty content step count");
  for (let i = 0; i < row.completed_steps; i++) {
    if (!hashes[targets[i]] || (await fingerprint(c, targets[i])) !== hashes[targets[i]])
      throw new Error("Dirty content DDL drift");
  }
}

export async function contentSchemaStatus(
  pool: Connection,
  directory: string,
): Promise<ContentSchemaStatus> {
  const a = await asset(directory),
    rows = await history(pool);
  const migrationChecksums = rows.length ? { [a.name]: String(rows[0].checksum) } : {};
  if (!rows.length) {
    const untracked = (await Promise.all(targets.map((t) => fingerprint(pool, t)))).some(Boolean);
    return { version: 8, state: untracked ? "dirty" : "empty", migrationChecksums };
  }
  if (rows.length !== 1 || rows[0].version !== 1 || rows[0].checksum !== a.checksum)
    return { version: 8, state: "incompatible", migrationChecksums };
  try {
    await verify(pool, rows[0]);
  } catch {
    return { version: 8, state: "dirty", migrationChecksums };
  }
  return {
    version: 8,
    state: rows[0].state === "complete" && rows[0].completed_steps === 5 ? "complete" : "dirty",
    migrationChecksums,
  };
}

export async function assertContentReady(connection: Connection): Promise<void> {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT version,state,completed_steps FROM content_schema_migrations ORDER BY version",
    );
    if (
      rows.length === 1 &&
      rows[0].version === 1 &&
      rows[0].state === "complete" &&
      rows[0].completed_steps === 5
    )
      return;
  } catch {
    /* feature not yet migrated, never run DDL here */
  }
  throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng");
}

export async function migrateContent(
  pool: Pool,
  directory: string,
  options: { resumeDirty?: boolean } = {},
): Promise<void> {
  const a = await asset(directory),
    c = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await c.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-content-migrate:',LEFT(SHA2(DATABASE(),256),32)),10) acquired",
    );
    if (lock.acquired !== 1) throw new Error("Content migration lock unavailable");
    locked = true;
    const rows = await history(c);
    if (
      rows.length &&
      (rows.length !== 1 || rows[0].version !== 1 || rows[0].checksum !== a.checksum)
    )
      throw new Error("Content migration checksum/history mismatch");
    if (!rows.length && (await Promise.all(targets.map((t) => fingerprint(c, t)))).some(Boolean))
      throw new Error("Untracked content DDL; inspect manually");
    if (rows.length) {
      await verify(c, rows[0]);
      if (rows[0].state === "complete" && rows[0].completed_steps === 5) return;
      if (!options.resumeDirty || rows[0].state !== "dirty")
        throw new Error("Dirty content schema; inspect and resume explicitly");
    }
    await c.query(
      "CREATE TABLE IF NOT EXISTS content_schema_migrations (version INT UNSIGNED PRIMARY KEY,checksum CHAR(64) NOT NULL,state VARCHAR(20) NOT NULL,completed_steps INT UNSIGNED NOT NULL DEFAULT 0,ddl_hashes JSON NOT NULL,applied_at DATETIME(3) NULL) ENGINE=InnoDB",
    );
    if (!rows.length)
      await c.execute(
        "INSERT INTO content_schema_migrations(version,checksum,state,ddl_hashes) VALUES(1,?,'dirty','{}')",
        [a.checksum],
      );
    const hashes: Record<string, string> = rows.length
      ? typeof rows[0].ddl_hashes === "string"
        ? JSON.parse(rows[0].ddl_hashes)
        : rows[0].ddl_hashes
      : {};
    for (let i = rows[0]?.completed_steps ?? 0; i < a.steps.length; i++) {
      if (await fingerprint(c, targets[i]))
        throw new Error("Unrecorded content DDL; manual inspection required");
      await c.query(a.steps[i]);
      hashes[targets[i]] = (await fingerprint(c, targets[i]))!;
      await c.execute(
        "UPDATE content_schema_migrations SET completed_steps=?,ddl_hashes=? WHERE version=1",
        [i + 1, JSON.stringify(hashes)],
      );
    }
    await c.execute(
      "UPDATE content_schema_migrations SET state='complete',applied_at=UTC_TIMESTAMP(3) WHERE version=1",
    );
  } finally {
    try {
      if (locked)
        await c.query(
          "SELECT RELEASE_LOCK(CONCAT('bibi-content-migrate:',LEFT(SHA2(DATABASE(),256),32)))",
        );
    } finally {
      c.release();
    }
  }
}
