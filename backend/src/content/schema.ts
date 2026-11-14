import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";
type Connection = Pool | PoolConnection;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const targets = [
  "content_categories",
  "content_category_revisions",
  "content_posts",
  "content_post_revisions",
  "content_tags",
  "content_post_tags",
  "content_slug_reservations",
  "content_media",
  "content_media_variants",
  "content_media_references",
  "content_published_snapshots",
  "content_publication_jobs",
  "content_generations",
  "content_generation_posts",
  "content_seed_imports",
];
export interface ContentSchemaStatus {
  version: 1;
  state: "empty" | "complete" | "dirty";
  migrationChecksums: Record<string, string>;
}
async function assets(directory: string) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  if (names.join() !== "001_content.sql") throw Error("Unknown content migration assets");
  const sql = await readFile(join(directory, names[0]), "utf8"),
    steps = sql
      .split(";")
      .map((step) => step.trim())
      .filter(Boolean);
  if (
    steps.length !== targets.length ||
    steps.some((step, index) => !step.startsWith(`CREATE TABLE ${targets[index]} (`))
  )
    throw Error("Invalid content DDL assets");
  return { name: names[0], checksum: hash(sql), steps };
}
async function tableNames(c: Connection): Promise<string[]> {
  const [rows] = await c.execute<RowDataPacket[]>(
    "SELECT table_name name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE ? ORDER BY table_name",
    ["content\\_%"],
  );
  return rows.map((row) => String(row.name));
}
async function history(c: Connection): Promise<RowDataPacket[]> {
  if (!(await tableNames(c)).includes("content_schema_migrations")) return [];
  return (
    await c.query<RowDataPacket[]>("SELECT * FROM content_schema_migrations ORDER BY version")
  )[0];
}
async function fingerprint(c: Connection, target: string): Promise<string | null> {
  if (!targets.includes(target)) throw Error("Unknown content table");
  if (!(await tableNames(c)).includes(target)) return null;
  const [[row]] = await c.query<RowDataPacket[]>(`SHOW CREATE TABLE ${target}`);
  return hash(String(row["Create Table"]));
}
async function verify(c: Connection, row: RowDataPacket): Promise<void> {
  const hashes: Record<string, string> =
    typeof row.ddl_hashes === "string" ? JSON.parse(row.ddl_hashes) : row.ddl_hashes;
  if (
    !Number.isInteger(row.completed_steps) ||
    row.completed_steps < 0 ||
    row.completed_steps > targets.length
  )
    throw Error("Dirty content schema step count");
  const known = new Set([...targets, "content_schema_migrations"]);
  if ((await tableNames(c)).some((name) => !known.has(name)))
    throw Error("Untracked content schema drift");
  for (let n = 0; n < row.completed_steps; n++)
    if (!hashes[targets[n]] || (await fingerprint(c, targets[n])) !== hashes[targets[n]])
      throw Error("Content DDL drift");
  for (let n = row.completed_steps; n < targets.length; n++)
    if (await fingerprint(c, targets[n])) throw Error("Unrecorded content DDL; inspect manually");
}
export async function contentSchemaStatus(
  c: Connection,
  directory: string,
): Promise<ContentSchemaStatus> {
  const a = await assets(directory),
    rows = await history(c),
    migrationChecksums = rows.length ? { [a.name]: String(rows[0].checksum) } : {};
  if (!rows.length)
    return {
      version: 1,
      state: (await tableNames(c)).some((name) => name !== "content_schema_migrations")
        ? "dirty"
        : "empty",
      migrationChecksums,
    };
  if (rows.length !== 1 || rows[0].version !== 1 || rows[0].checksum !== a.checksum)
    return { version: 1, state: "dirty", migrationChecksums };
  try {
    await verify(c, rows[0]);
  } catch {
    return { version: 1, state: "dirty", migrationChecksums };
  }
  return {
    version: 1,
    state:
      rows[0].state === "complete" && rows[0].completed_steps === targets.length
        ? "complete"
        : "dirty",
    migrationChecksums,
  };
}
export async function migrateContent(pool: Pool, directory: string): Promise<void> {
  const a = await assets(directory),
    c = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await c.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-content-migrate:',LEFT(SHA2(DATABASE(),256),32)),10) acquired",
    );
    if (lock.acquired !== 1) throw Error("Content migration lock unavailable");
    locked = true;
    const rows = await history(c);
    if (rows.length) {
      if (rows.length !== 1 || rows[0].version !== 1 || rows[0].checksum !== a.checksum)
        throw Error("Content migration checksum/history mismatch");
      await verify(c, rows[0]);
      if (rows[0].state === "complete" && rows[0].completed_steps === targets.length) return;
      throw Error("Dirty content schema; inspect manually before recovery");
    }
    if ((await tableNames(c)).some((name) => name !== "content_schema_migrations"))
      throw Error("Untracked content DDL; inspect manually");
    await c.query(
      "CREATE TABLE IF NOT EXISTS content_schema_migrations (version INT UNSIGNED PRIMARY KEY,checksum CHAR(64) NOT NULL,state VARCHAR(20) NOT NULL,completed_steps INT UNSIGNED NOT NULL DEFAULT 0,ddl_hashes JSON NOT NULL,applied_at DATETIME(3) NULL) ENGINE=InnoDB",
    );
    await c.execute(
      "INSERT INTO content_schema_migrations(version,checksum,state,ddl_hashes) VALUES(1,?,'dirty','{}')",
      [a.checksum],
    );
    const hashes: Record<string, string> = {};
    for (let n = 0; n < a.steps.length; n++) {
      await c.query(a.steps[n]);
      hashes[targets[n]] = (await fingerprint(c, targets[n]))!;
      await c.execute(
        "UPDATE content_schema_migrations SET completed_steps=?,ddl_hashes=? WHERE version=1",
        [n + 1, JSON.stringify(hashes)],
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
export async function assertContentSchemaReady(c: Connection): Promise<void> {
  try {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT version,state,completed_steps FROM content_schema_migrations ORDER BY version",
    );
    if (
      rows.length === 1 &&
      rows[0].version === 1 &&
      rows[0].state === "complete" &&
      rows[0].completed_steps === targets.length
    )
      return;
  } catch {
    /* no runtime DDL */
  }
  throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng");
}
