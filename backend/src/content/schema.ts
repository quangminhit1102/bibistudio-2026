import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";

type Connection = Pool | PoolConnection;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const tables = [
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
  const steps = sql.split(";").map((s) => s.trim()).filter(Boolean);
  if (steps.length !== tables.length) throw new Error("Invalid content DDL assets");
  return { name: names[0], checksum: digest(sql) };
}

async function fingerprint(c: Connection, table: string): Promise<string | null> {
  const [[exists]] = await c.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
    [table],
  );
  if (!exists.n) return null;
  const [[ddl]] = await c.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${table}\``);
  return digest(String(ddl["Create Table"]));
}

export async function contentSchemaStatus(
  pool: Connection,
  directory: string,
): Promise<ContentSchemaStatus> {
  const { checksum } = await asset(directory);
  const hashes: (string | null)[] = [];
  for (const t of tables) hashes.push(await fingerprint(pool, t));
  if (hashes.every((h) => h === null)) return { version: 8, state: "empty", migrationChecksums: {} };
  const complete = hashes.every((h) => h !== null);
  return {
    version: 8,
    state: complete ? "complete" : "dirty",
    migrationChecksums: { "001_content.sql": checksum },
  };
}

export async function assertContentReady(c: Connection) {
  const status = await contentSchemaStatus(c, process.env.BIBI_CONTENT_MIGRATIONS ?? "");
  if (status.state !== "complete")
    throw new ApiError(503, "CONTENT_NOT_READY", "Dịch vụ nội dung chưa sẵn sàng");
}
