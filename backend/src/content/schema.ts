import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";

type Connection = Pool | PoolConnection;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

const allTables = [
  "product_categories",
  "content_categories",
  "posts",
  "products",
  "customers",
  "media",
  "product_types",
] as const;

/** Expected completed_steps per migration version; must match the parsed SQL assets. */
const versionStepCounts = new Map<number, number>([
  [1, 5],
  [2, 3],
  [3, 3],
]);

export interface ContentSchemaStatus {
  version: number;
  state: "empty" | "complete" | "dirty" | "incompatible";
  migrationChecksums: Record<string, string>;
}

interface MigrationStep {
  sql: string;
  target: string;
  create: boolean;
}

interface MigrationAsset {
  version: number;
  name: string;
  checksum: string;
  steps: MigrationStep[];
  /** Tables this version finalizes: the newest version that alters a table owns its hash. */
  verifyTargets: string[];
}

async function assets(directory: string): Promise<MigrationAsset[]> {
  const names = (await readdir(directory)).filter((n) => n.endsWith(".sql")).sort();
  if (names.join() !== "001_content.sql,002_content_v9.sql,003_content_catalogue.sql")
    throw new Error("Unknown content migration assets");
  const files = await Promise.all(
    names.map(async (name) => ({ name, sql: await readFile(join(directory, name), "utf8") })),
  );
  const [first, second, third] = files;

  const firstStatements = first.sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const tables = ["product_categories", "content_categories", "posts", "products", "customers"];
  if (firstStatements.length !== 5) throw new Error("Invalid content DDL assets");
  tables.forEach((t, i) => {
    if (!new RegExp(`^CREATE TABLE ${t} `).test(firstStatements[i]))
      throw new Error("Invalid content DDL assets");
  });

  const secondStatements = second.sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (secondStatements.length !== 3) throw new Error("Invalid content DDL assets");
  if (!/^ALTER TABLE products\s+ADD COLUMN /.test(secondStatements[0]))
    throw new Error("Invalid content DDL assets");
  if (!/^ALTER TABLE posts\s+ADD COLUMN /.test(secondStatements[1]))
    throw new Error("Invalid content DDL assets");
  if (!/^CREATE TABLE media /.test(secondStatements[2]))
    throw new Error("Invalid content DDL assets");

  const thirdStatements = third.sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (thirdStatements.length !== 3) throw new Error("Invalid content DDL assets");
  if (!/^CREATE TABLE product_types /.test(thirdStatements[0]))
    throw new Error("Invalid content DDL assets");
  if (!/^ALTER TABLE product_categories\s+ADD COLUMN /.test(thirdStatements[1]))
    throw new Error("Invalid content DDL assets");
  if (!/^ALTER TABLE products\s+ADD COLUMN /.test(thirdStatements[2]))
    throw new Error("Invalid content DDL assets");

  return [
    {
      version: 1,
      name: first.name,
      checksum: digest(first.sql),
      steps: tables.map((t, i) => ({ sql: firstStatements[i], target: t, create: true })),
      verifyTargets: ["content_categories", "customers"],
    },
    {
      version: 2,
      name: second.name,
      checksum: digest(second.sql),
      steps: [
        { sql: secondStatements[0], target: "products", create: false },
        { sql: secondStatements[1], target: "posts", create: false },
        { sql: secondStatements[2], target: "media", create: true },
      ],
      verifyTargets: ["posts", "media"],
    },
    {
      version: 3,
      name: third.name,
      checksum: digest(third.sql),
      steps: [
        { sql: thirdStatements[0], target: "product_types", create: true },
        { sql: thirdStatements[1], target: "product_categories", create: false },
        { sql: thirdStatements[2], target: "products", create: false },
      ],
      verifyTargets: ["product_types", "product_categories", "products"],
    },
  ];
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

async function verify(c: Connection, row: RowDataPacket, asset: MigrationAsset) {
  const hashes: Record<string, string> =
    typeof row.ddl_hashes === "string" ? JSON.parse(row.ddl_hashes) : row.ddl_hashes;
  if (
    !Number.isInteger(row.completed_steps) ||
    row.completed_steps < 0 ||
    row.completed_steps > asset.steps.length
  )
    throw new Error("Dirty content step count");
  for (const target of asset.verifyTargets) {
    if (!hashes[target] || (await fingerprint(c, target)) !== hashes[target])
      throw new Error("Dirty content DDL drift");
  }
}

export async function contentSchemaStatus(
  pool: Connection,
  directory: string,
): Promise<ContentSchemaStatus> {
  const list = await assets(directory),
    rows = await history(pool);
  const migrationChecksums: Record<string, string> = {};
  for (const row of rows) {
    const asset = list.find((a) => a.version === row.version);
    if (asset) migrationChecksums[asset.name] = String(row.checksum);
  }
  if (!rows.length) {
    const untracked = (await Promise.all(allTables.map((t) => fingerprint(pool, t)))).some(Boolean);
    return { version: 8, state: untracked ? "dirty" : "empty", migrationChecksums };
  }
  const newest = list[list.length - 1].version;
  const newer = rows.filter((r) => r.version > newest);
  for (const row of rows) {
    if (newer.includes(row)) continue;
    const asset = list.find((a) => a.version === row.version);
    if (!asset) return { version: 8, state: "incompatible", migrationChecksums };
    if (asset.checksum !== row.checksum)
      return { version: 8, state: "incompatible", migrationChecksums };
  }
  if (newer.some((r) => r.state !== "complete"))
    return { version: 8, state: "incompatible", migrationChecksums };
  // A newer complete migration owns the table definitions; only additive changes are
  // allowed there, so the packaged release trusts the ledger instead of its own DDL hashes.
  if (!newer.length)
    for (const row of rows) {
      if (row.state !== "complete") continue;
      const asset = list.find((a) => a.version === row.version)!;
      try {
        await verify(pool, row, asset);
      } catch {
        return { version: 8, state: "dirty", migrationChecksums };
      }
    }
  const complete = list.every((asset) => {
    const row = rows.find((r) => r.version === asset.version);
    return row && row.state === "complete" && row.completed_steps === asset.steps.length;
  });
  return { version: 8, state: complete ? "complete" : "dirty", migrationChecksums };
}

export async function assertContentReady(connection: Connection): Promise<void> {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT version,state,completed_steps FROM content_schema_migrations ORDER BY version",
    );
    const newest = Math.max(...versionStepCounts.keys());
    const known = rows.filter((r) => versionStepCounts.has(r.version));
    if (
      known.length === versionStepCounts.size &&
      known.every((r) => r.completed_steps === versionStepCounts.get(r.version)) &&
      rows.every(
        (r) => r.state === "complete" && (versionStepCounts.has(r.version) || r.version > newest),
      )
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
  const list = await assets(directory),
    c = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await c.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT('bibi-content-migrate:',LEFT(SHA2(DATABASE(),256),32)),10) acquired",
    );
    if (lock.acquired !== 1) throw new Error("Content migration lock unavailable");
    locked = true;
    const rows = await history(c);
    for (const row of rows) {
      const asset = list.find((a) => a.version === row.version);
      if (!asset)
        throw new Error("Unknown newer content schema; packaged migrations cannot modify it");
      if (asset.checksum !== row.checksum)
        throw new Error(`Content migration checksum mismatch: ${row.version}`);
      if (row.state !== "complete" && (!options.resumeDirty || row.state !== "dirty"))
        throw new Error(
          "Dirty content schema: inspect DDL and recover explicitly before migration",
        );
    }
    if (!rows.length && (await Promise.all(allTables.map((t) => fingerprint(c, t)))).some(Boolean))
      throw new Error("Untracked content DDL; inspect manually");
    await c.query(
      "CREATE TABLE IF NOT EXISTS content_schema_migrations (version INT UNSIGNED PRIMARY KEY,checksum CHAR(64) NOT NULL,state VARCHAR(20) NOT NULL,completed_steps INT UNSIGNED NOT NULL DEFAULT 0,ddl_hashes JSON NOT NULL,applied_at DATETIME(3) NULL) ENGINE=InnoDB",
    );
    for (const asset of list) {
      const previous = rows.find((r) => r.version === asset.version);
      if (previous?.state === "complete") continue;
      if (!previous)
        await c.execute(
          "INSERT INTO content_schema_migrations(version,checksum,state,ddl_hashes) VALUES(?,?,'dirty','{}')",
          [asset.version, asset.checksum],
        );
      const hashes: Record<string, string> = previous
        ? typeof previous.ddl_hashes === "string"
          ? JSON.parse(previous.ddl_hashes)
          : previous.ddl_hashes
        : {};
      for (let i = previous?.completed_steps ?? 0; i < asset.steps.length; i++) {
        const step = asset.steps[i];
        if (step.create && (await fingerprint(c, step.target)))
          throw new Error("Unrecorded content DDL; manual inspection required");
        await c.query(step.sql);
        hashes[step.target] = (await fingerprint(c, step.target))!;
        await c.execute(
          "UPDATE content_schema_migrations SET completed_steps=?,ddl_hashes=? WHERE version=?",
          [i + 1, JSON.stringify(hashes), asset.version],
        );
      }
      await c.execute(
        "UPDATE content_schema_migrations SET state='complete',applied_at=UTC_TIMESTAMP(3) WHERE version=?",
        [asset.version],
      );
    }
    if (rows.some((r) => r.version > list[list.length - 1].version))
      throw new Error("Database is newer than packaged content migrations");
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
