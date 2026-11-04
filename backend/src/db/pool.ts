import mysql, { type Pool } from "mysql2/promise";
import type { DbConfig } from "../config";

export function createDbPool(config: DbConfig): Pool {
  const pool = mysql.createPool({
    ...config,
    timezone: "Z",
    dateStrings: true,
    charset: "utf8mb4",
    waitForConnections: true,
    queueLimit: 20,
    connectTimeout: 5000,
    enableKeepAlive: true,
    multipleStatements: false,
  });
  pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
  return pool;
}
