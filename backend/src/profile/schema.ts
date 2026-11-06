import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";
type Connection = Pool | PoolConnection;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const targets = ["phone", "avatar_id", "profile_avatar_assets"] as const;
export interface ProfileSchemaStatus {
  version: number;
  state: "empty" | "complete" | "dirty" | "incompatible";
  migrationChecksums: Record<string, string>;
}
async function asset(directory: string) {
  const names = (await readdir(directory)).filter((n) => n.endsWith(".sql")).sort();
  if (names.join() !== "001_profiles.sql") throw new Error("Unknown profile migration assets");
  const sql = await readFile(join(directory, names[0]), "utf8");
  const steps = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    steps.length !== 3 ||
    !/^ALTER TABLE users ADD COLUMN phone VARCHAR\(32\) NULL$/i.test(steps[0]) ||
    !/^ALTER TABLE users ADD COLUMN avatar_id CHAR\(36\) NULL$/i.test(steps[1]) ||
    !/^CREATE TABLE profile_avatar_assets \(/.test(steps[2])
  )
    throw new Error("Invalid profile DDL assets");
  return { name: names[0], checksum: digest(sql), steps };
}
async function fingerprint(c: Connection, target: string): Promise<string | null> {
  if (target === "phone" || target === "avatar_id") {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name=?",
      [target],
    );
    return rows.length ? digest(JSON.stringify(rows[0])) : null;
  }
  const [[exists]] = await c.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='profile_avatar_assets'",
  );
  if (!exists.n) return null;
  const [[row]] = await c.query<RowDataPacket[]>("SHOW CREATE TABLE profile_avatar_assets");
  return digest(String(row["Create Table"]));
}
async function history(c: Connection): Promise<RowDataPacket[]> {
  const [[exists]] = await c.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='profile_schema_migrations'",
  );
  return exists.n
    ? (
        await c.query<RowDataPacket[]>("SELECT * FROM profile_schema_migrations ORDER BY version")
      )[0]
    : [];
}
async function verify(c: Connection, row: RowDataPacket) {
  const hashes: Record<string, string> =
    typeof row.ddl_hashes === "string" ? JSON.parse(row.ddl_hashes) : row.ddl_hashes;
  if (!Number.isInteger(row.completed_steps) || row.completed_steps < 0 || row.completed_steps > 3)
    throw new Error("Dirty profile step count");
  for (let i = 0; i < row.completed_steps; i++) {
    if (!hashes[targets[i]] || (await fingerprint(c, targets[i])) !== hashes[targets[i]])
      throw new Error("Dirty profile DDL drift");
  }
}
export async function profileSchemaStatus(
  pool: Connection,
  directory: string,
): Promise<ProfileSchemaStatus> {
  const a = await asset(directory),
    rows = await history(pool);
  const migrationChecksums = rows.length ? { [a.name]: String(rows[0].checksum) } : {};
  if (!rows.length) {
    const untracked = (await Promise.all(targets.map((t) => fingerprint(pool, t)))).some(Boolean);
    return { version: 0, state: untracked ? "dirty" : "empty", migrationChecksums };
  }
  if (rows.length !== 1 || rows[0].version !== 1 || rows[0].checksum !== a.checksum)
    return { version: Number(rows.at(-1)?.version), state: "incompatible", migrationChecksums };
  try {
    await verify(pool, rows[0]);
  } catch {
    return { version: 1, state: "dirty", migrationChecksums };
  }
  return {
    version: 1,
    state: rows[0].state === "complete" && rows[0].completed_steps === 3 ? "complete" : "dirty",
    migrationChecksums,
  };
}
export async function assertProfileSchemaReady(connection: PoolConnection): Promise<void> {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT version,state,completed_steps FROM profile_schema_migrations ORDER BY version",
    );
    if (
      rows.length === 1 &&
      rows[0].version === 1 &&
      rows[0].state === "complete" &&
      rows[0].completed_steps === 3
    )
      return;
  } catch {
    /* feature not yet migrated, never run DDL here */
  }
  throw new ApiError(503, "PROFILE_NOT_READY", "Dịch vụ hồ sơ chưa sẵn sàng");
}
export async function migrateProfiles(
  pool: Pool,
  directory: string,
  options: { resumeDirty?: boolean } = {},
): Promise<void> {
  const a = await asset(directory),
    c = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await c.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-profile-migrate:',LEFT(SHA2(DATABASE(),256),32)),10) acquired",
    );
    if (lock.acquired !== 1) throw new Error("Profile migration lock unavailable");
    locked = true;
    const rows = await history(c);
    if (
      rows.length &&
      (rows.length !== 1 || rows[0].version !== 1 || rows[0].checksum !== a.checksum)
    )
      throw new Error("Profile migration checksum/history mismatch");
    if (!rows.length && (await Promise.all(targets.map((t) => fingerprint(c, t)))).some(Boolean))
      throw new Error("Untracked profile DDL; inspect manually");
    if (rows.length) {
      await verify(c, rows[0]);
      if (rows[0].state === "complete" && rows[0].completed_steps === 3) return;
      if (!options.resumeDirty || rows[0].state !== "dirty")
        throw new Error("Dirty profile schema; inspect and resume explicitly");
    }
    await c.query(
      "CREATE TABLE IF NOT EXISTS profile_schema_migrations (version INT UNSIGNED PRIMARY KEY,checksum CHAR(64) NOT NULL,state VARCHAR(20) NOT NULL,completed_steps INT UNSIGNED NOT NULL DEFAULT 0,ddl_hashes JSON NOT NULL,applied_at DATETIME(3) NULL) ENGINE=InnoDB",
    );
    if (!rows.length)
      await c.execute(
        "INSERT INTO profile_schema_migrations(version,checksum,state,ddl_hashes) VALUES(1,?,'dirty','{}')",
        [a.checksum],
      );
    const hashes: Record<string, string> = rows.length
      ? typeof rows[0].ddl_hashes === "string"
        ? JSON.parse(rows[0].ddl_hashes)
        : rows[0].ddl_hashes
      : {};
    for (let i = rows[0]?.completed_steps ?? 0; i < a.steps.length; i++) {
      if (await fingerprint(c, targets[i]))
        throw new Error("Unrecorded profile DDL; manual inspection required");
      await c.query(a.steps[i]);
      hashes[targets[i]] = (await fingerprint(c, targets[i]))!;
      await c.execute(
        "UPDATE profile_schema_migrations SET completed_steps=?,ddl_hashes=? WHERE version=1",
        [i + 1, JSON.stringify(hashes)],
      );
    }
    await c.execute(
      "UPDATE profile_schema_migrations SET state='complete',applied_at=UTC_TIMESTAMP(3) WHERE version=1",
    );
  } finally {
    try {
      if (locked)
        await c.query(
          "SELECT RELEASE_LOCK(CONCAT('bibi-profile-migrate:',LEFT(SHA2(DATABASE(),256),32)))",
        );
    } finally {
      c.release();
    }
  }
}
