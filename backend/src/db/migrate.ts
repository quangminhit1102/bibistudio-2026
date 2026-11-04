import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, RowDataPacket } from "mysql2/promise";

export interface MigrationStatus {
  version: number;
  applied: number[];
}
/** DDL commits implicitly. Dirty state is persistent and must never be silently replayed. */
export async function migrate(
  pool: Pool,
  directory: string,
  options: { resumeDirty?: boolean } = {},
): Promise<MigrationStatus> {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT(DATABASE(),':bibi-migrate'),10) acquired",
    );
    if (lock.acquired !== 1) throw new Error("Migration lock unavailable");
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT UNSIGNED PRIMARY KEY, checksum CHAR(64) NOT NULL,
      state VARCHAR(20) NOT NULL, completed_steps INT UNSIGNED NOT NULL DEFAULT 0,
      applied_at DATETIME(3) NULL) ENGINE=InnoDB`);
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migration_steps (
      version INT UNSIGNED NOT NULL, step_index INT UNSIGNED NOT NULL,
      table_name VARCHAR(64) NOT NULL, ddl_hash CHAR(64) NOT NULL,
      PRIMARY KEY(version,step_index), FOREIGN KEY(version) REFERENCES schema_migrations(version)) ENGINE=InnoDB`);
    const [existing] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM schema_migrations ORDER BY version",
    );
    if (!options.resumeDirty && existing.some((row) => row.state !== "complete"))
      throw new Error("Dirty schema: inspect DDL and recover explicitly before migration");
    const files = (await readdir(directory))
      .filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name))
      .sort();
    if (files.length === 0) throw new Error("Migration assets missing");
    const applied: number[] = [];
    let version = 0;
    for (const file of files) {
      const next = Number(file.slice(0, 3));
      if (next !== version + 1) throw new Error("Migration sequence invalid");
      version = next;
      const sql = await readFile(join(directory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = existing.find((row) => row.version === version);
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error(`Migration checksum mismatch: ${version}`);
        if (previous.state === "complete") continue;
        if (previous.state !== "dirty") throw new Error("Unknown schema migration state");
      }
      if (!previous)
        await connection.execute(
          "INSERT INTO schema_migrations(version,checksum,state) VALUES (?,?,'dirty')",
          [version, checksum],
        );
      // Assets deliberately contain narrow CREATE TABLE statements, no procedures or dynamic SQL.
      const steps = sql
        .split(";")
        .map((step) => step.trim())
        .filter(Boolean);
      for (let index = 0; index < steps.length; index++) {
        const table = /^CREATE TABLE ([a-z_]+)\s*\(/.exec(steps[index])?.[1];
        if (!table) throw new Error("Unsupported migration step");
        if (index < (previous?.completed_steps ?? 0)) {
          const [recorded] = await connection.execute<RowDataPacket[]>(
            "SELECT ddl_hash,table_name FROM schema_migration_steps WHERE version=? AND step_index=?",
            [version, index],
          );
          const [[actual]] = await connection.query<RowDataPacket[]>(
            `SHOW CREATE TABLE \`${table}\``,
          );
          const actualHash = createHash("sha256")
            .update(String(actual["Create Table"]))
            .digest("hex");
          if (
            recorded.length !== 1 ||
            recorded[0].table_name !== table ||
            recorded[0].ddl_hash !== actualHash
          )
            throw new Error("DDL verification failed; manual recovery required");
          continue;
        }
        await connection.query(steps[index]);
        const [[created]] = await connection.query<RowDataPacket[]>(
          `SHOW CREATE TABLE \`${table}\``,
        );
        const ddlHash = createHash("sha256").update(String(created["Create Table"])).digest("hex");
        await connection.beginTransaction();
        try {
          await connection.execute(
            "INSERT INTO schema_migration_steps(version,step_index,table_name,ddl_hash) VALUES (?,?,?,?)",
            [version, index, table, ddlHash],
          );
          await connection.execute(
            "UPDATE schema_migrations SET completed_steps=? WHERE version=?",
            [index + 1, version],
          );
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        }
      }
      await connection.execute(
        "UPDATE schema_migrations SET state='complete',applied_at=UTC_TIMESTAMP(3) WHERE version=?",
        [version],
      );
      applied.push(version);
    }
    if (existing.some((row) => row.version > version))
      throw new Error("Database is newer than packaged migrations");
    return { version, applied };
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':bibi-migrate'))");
    connection.release();
  }
}
