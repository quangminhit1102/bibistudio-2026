import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { assertTestDatabaseTarget } from "../../../scripts/test-database.mjs";

export async function createDatabaseFixture(t) {
  const database = `bibi_test_${randomBytes(8).toString("hex")}`;
  const host = process.env.BIBI_TEST_DB_HOST || "127.0.0.1";
  assertTestDatabaseTarget({ host, database });
  const password =
    process.env.BIBI_TEST_DB_PASSWORD ||
    (
      await readFile(new URL("../../../.superpowers/auth-test-db.env", import.meta.url), "utf8")
    ).match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)?.[1];
  if (!password) throw new Error("Explicit isolated test DB credentials required");
  const config = {
    host,
    port: Number(process.env.BIBI_TEST_DB_PORT || 33384),
    user: "root",
    password,
    database,
  };
  const admin = await mysql.createConnection({ ...config, database: undefined });
  await admin.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  const pool = mysql.createPool({
    ...config,
    timezone: "Z",
    dateStrings: true,
    connectionLimit: 5,
  });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await pool.end();
    assertTestDatabaseTarget({ host, database });
    try {
      await admin.query(`DROP DATABASE \`${database}\``);
    } finally {
      await admin.end();
    }
  };
  t.after(close);
  let now = new Date("2026-11-04T00:00:00Z");
  const clock = {
    now: () => new Date(now),
    set: (date) => {
      now = new Date(date);
    },
    advance: (ms) => {
      now = new Date(+now + ms);
    },
  };
  return { pool, config, clock, close };
}
