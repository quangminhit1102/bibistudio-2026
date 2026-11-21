import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";
import { normalizeExclusionRules } from "./exclusions";
import { assertVisitorHistoryReady } from "./schema";
type Connection = Pool | PoolConnection;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const targets = ["visitor_exclusion_settings"] as const;
export interface VisitorControlsSchemaStatus {
  version: number;
  state: "empty" | "complete" | "dirty" | "incompatible";
  migrationChecksums: Record<string, string>;
}
async function asset(directory: string) {
  const names = (await readdir(directory)).filter((n) => n.endsWith(".sql")).sort();
  if (names.join() !== "001_controls.sql")
    throw new Error("Unknown visitor controls migration assets");
  const sql = await readFile(join(directory, names[0]), "utf8");
  const steps = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    steps.length !== 1 ||
    steps.some((step) => !/^CREATE TABLE visitor_exclusion_settings /.test(step))
  )
    throw new Error("Invalid visitor controls DDL assets");
  return { name: names[0], checksum: digest(sql), steps };
}
async function fingerprint(c: Connection, target: string): Promise<string | null> {
  const [[exists]] = await c.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
    [target],
  );
  if (!exists.n) return null;
  const [[ddl]] = await c.query<RowDataPacket[]>("SHOW CREATE TABLE visitor_exclusion_settings");
  return digest(String(ddl["Create Table"]));
}
async function verifySettings(c: Connection) {
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT id,revision,rules FROM visitor_exclusion_settings",
  );
  if (
    rows.length !== 1 ||
    rows[0].id !== 1 ||
    !Number.isInteger(rows[0].revision) ||
    rows[0].revision < 1
  )
    throw new Error("Invalid visitor exclusion settings");
  const rules = typeof rows[0].rules === "string" ? JSON.parse(rows[0].rules) : rows[0].rules;
  const normalized = normalizeExclusionRules(rules);
  if (JSON.stringify(normalized) !== JSON.stringify(rules))
    throw new Error("Invalid visitor exclusion rules");
}
async function history(c: Connection): Promise<RowDataPacket[]> {
  const [[exists]] = await c.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='visitor_controls_schema_migrations'",
  );
  return exists.n
    ? (
        await c.query<RowDataPacket[]>(
          "SELECT * FROM visitor_controls_schema_migrations ORDER BY version",
        )
      )[0]
    : [];
}
async function verify(c: Connection, row: RowDataPacket) {
  const hashes: Record<string, string> =
    typeof row.ddl_hashes === "string" ? JSON.parse(row.ddl_hashes) : row.ddl_hashes;
  if (!Number.isInteger(row.completed_steps) || row.completed_steps < 0 || row.completed_steps > 1)
    throw new Error("Dirty visitor controls step count");
  for (let i = 0; i < row.completed_steps; i++) {
    if (!hashes[targets[i]] || (await fingerprint(c, targets[i])) !== hashes[targets[i]])
      throw new Error("Dirty visitor controls DDL drift");
  }
}
export async function visitorControlsSchemaStatus(
  pool: Connection,
  directory: string,
): Promise<VisitorControlsSchemaStatus> {
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
    await verifySettings(pool);
  } catch {
    return { version: 1, state: "dirty", migrationChecksums };
  }
  return {
    version: 1,
    state: rows[0].state === "complete" && rows[0].completed_steps === 1 ? "complete" : "dirty",
    migrationChecksums,
  };
}
export async function assertVisitorControlsReady(connection: Connection): Promise<void> {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT version,state,completed_steps FROM visitor_controls_schema_migrations ORDER BY version",
    );
    if (
      rows.length === 1 &&
      rows[0].version === 1 &&
      rows[0].state === "complete" &&
      rows[0].completed_steps === 1
    ) {
      await verifySettings(connection);
      return;
    }
  } catch {
    /* feature not yet migrated, never run DDL here */
  }
  throw new ApiError(503, "VISITOR_CONTROLS_NOT_READY", "Dịch vụ phân tích chưa sẵn sàng");
}
export async function migrateVisitorControls(
  pool: Pool,
  directory: string,
  options: { resumeDirty?: boolean } = {},
): Promise<void> {
  const a = await asset(directory),
    c = await pool.getConnection();
  let locked = false;
  try {
    await assertVisitorHistoryReady(c);
    const [[lock]] = await c.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-visitor-controls-migrate:',LEFT(SHA2(DATABASE(),256),32)),10) acquired",
    );
    if (lock.acquired !== 1) throw new Error("Visitor controls migration lock unavailable");
    locked = true;
    const rows = await history(c);
    if (
      rows.length &&
      (rows.length !== 1 || rows[0].version !== 1 || rows[0].checksum !== a.checksum)
    )
      throw new Error("Visitor controls migration checksum/history mismatch");
    if (!rows.length && (await Promise.all(targets.map((t) => fingerprint(c, t)))).some(Boolean))
      throw new Error("Untracked visitor controls DDL; inspect manually");
    if (rows.length) {
      await verify(c, rows[0]);
      if (rows[0].state === "complete" && rows[0].completed_steps === 1) {
        await verifySettings(c);
        return;
      }
      if (!options.resumeDirty || rows[0].state !== "dirty")
        throw new Error("Dirty visitor controls schema; inspect and resume explicitly");
    }
    await c.query(
      "CREATE TABLE IF NOT EXISTS visitor_controls_schema_migrations (version INT UNSIGNED PRIMARY KEY,checksum CHAR(64) NOT NULL,state VARCHAR(20) NOT NULL,completed_steps INT UNSIGNED NOT NULL DEFAULT 0,ddl_hashes JSON NOT NULL,applied_at DATETIME(3) NULL) ENGINE=InnoDB",
    );
    if (!rows.length)
      await c.execute(
        "INSERT INTO visitor_controls_schema_migrations(version,checksum,state,ddl_hashes) VALUES(1,?,'dirty','{}')",
        [a.checksum],
      );
    const hashes: Record<string, string> = rows.length
      ? typeof rows[0].ddl_hashes === "string"
        ? JSON.parse(rows[0].ddl_hashes)
        : rows[0].ddl_hashes
      : {};
    for (let i = rows[0]?.completed_steps ?? 0; i < a.steps.length; i++) {
      if (await fingerprint(c, targets[i]))
        throw new Error("Unrecorded visitor controls DDL; manual inspection required");
      await c.query(a.steps[i]);
      hashes[targets[i]] = (await fingerprint(c, targets[i]))!;
      await c.execute(
        "UPDATE visitor_controls_schema_migrations SET completed_steps=?,ddl_hashes=? WHERE version=1",
        [i + 1, JSON.stringify(hashes)],
      );
    }
    await c.beginTransaction();
    try {
      await c.execute(
        "INSERT IGNORE INTO visitor_exclusion_settings(id,revision,rules) VALUES (1,1,'[]')",
      );
      for (const code of ["customer_access.delete", "customer_access.manage_exclusions"]) {
        await c.execute("INSERT IGNORE INTO permissions(id,code,description) VALUES (?,?,?)", [
          code,
          code,
          code,
        ]);
        await c.execute(
          "INSERT IGNORE INTO role_permissions(role_id,permission_id) SELECT id,? FROM roles WHERE id='system-admin'",
          [code],
        );
      }
      await c.execute(
        "UPDATE visitor_controls_schema_migrations SET state='complete',applied_at=UTC_TIMESTAMP(3) WHERE version=1",
      );
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    }
  } finally {
    try {
      if (locked)
        await c.query(
          "SELECT RELEASE_LOCK(CONCAT('bibi-visitor-controls-migrate:',LEFT(SHA2(DATABASE(),256),32)))",
        );
    } finally {
      c.release();
    }
  }
}
