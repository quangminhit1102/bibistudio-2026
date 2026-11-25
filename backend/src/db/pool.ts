import mysql, {
  type Pool,
  type QueryResult,
  type QueryOptions,
  type QueryValues,
  type ExecuteValues,
} from "mysql2/promise";
import type { DbConfig } from "../config";

export function createDbPool(config: DbConfig, { acquireTimeoutMs = 5000 } = {}): Pool {
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
  const acquire = pool.getConnection.bind(pool);
  pool.getConnection = () =>
    new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(new Error("Database connection acquisition timed out"));
      }, acquireTimeoutMs);
      acquire().then(
        (connection) => {
          clearTimeout(timer);
          if (settled) connection.release();
          else {
            settled = true;
            resolve(connection);
          }
        },
        (error) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            reject(error);
          }
        },
      );
    });
  // Direct reads must use the same bounded acquisition path as transactions.
  pool.query = async <T extends QueryResult>(sql: string | QueryOptions, values?: QueryValues) => {
    const connection = await pool.getConnection();
    try {
      return await connection.query<T>(typeof sql === "string" ? { sql } : sql, values);
    } finally {
      connection.release();
    }
  };
  pool.execute = async <T extends QueryResult>(
    sql: string | QueryOptions,
    values?: ExecuteValues,
  ) => {
    const connection = await pool.getConnection();
    try {
      return await connection.execute<T>(typeof sql === "string" ? { sql } : sql, values);
    } finally {
      connection.release();
    }
  };
  return pool;
}
