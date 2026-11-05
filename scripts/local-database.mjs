/** Developer setup has one fixed loopback target, separate from disposable test schemas. */
export function assertLocalDevelopmentTarget(env) {
  if (
    env.DB_HOST !== "127.0.0.1" ||
    String(env.DB_PORT) !== "33385" ||
    env.DB_NAME !== "bibi_local" ||
    env.DB_USER !== "bibi_local_runtime"
  )
    throw new Error("Refusing non-local development database; use the dedicated local setup");
}
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { parseEnv, promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import mysql from "../backend/node_modules/mysql2/promise.js";
import { TEST_MYSQL_IMAGE } from "./test-database.mjs";
import { root, isMain } from "./runtime.mjs";
const execute = promisify(execFile);
const require = createRequire(import.meta.url);
export async function prepareLocalAccessLogs(
  baseDirectory = join(root, ".superpowers/local-access-logs"),
) {
  const archiveDirectory = join(baseDirectory, "archives"),
    workDirectory = join(baseDirectory, "work"),
    currentDirectory = join(baseDirectory, "current");
  await mkdir(archiveDirectory, { recursive: true, mode: 0o700 });
  await mkdir(currentDirectory, { recursive: true, mode: 0o700 });
  const domainAlias = "local.bibistudio.test";
  const file = join(archiveDirectory, domainAlias + "-Jan-2026.gz");
  const example =
    '203.0.113.10 - - [01/Jan/2026:07:00:00 +0700] "GET /products/local-example HTTP/1.1" 200 123 "-" "LocalExampleBrowser/1.0"\n';
  try {
    await writeFile(file, gzipSync(Buffer.from(example)), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  for (const [name, text] of [
    [domainAlias, ""],
    [domainAlias + "-ssl_log", example],
  ]) {
    try {
      await writeFile(join(currentDirectory, name), text, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  return {
    ACCESS_LOG_ARCHIVE_DIR: archiveDirectory,
    ACCESS_LOG_DOMAIN_ALIAS: domainAlias,
    ACCESS_LOG_WORK_DIR: workDirectory,
    ACCESS_LOG_CURRENT_DIR: currentDirectory,
  };
}
async function privateEnv(path) {
  try {
    const text = await readFile(path, "utf8");
    return { text, values: parseEnv(text) };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { text: "", values: {} };
  }
}
async function saveEnv(path, before, values) {
  const added = Object.entries(values)
    .filter(([key, value]) => before.values[key] !== value)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  if (added.length)
    await writeFile(path, `${before.text.trimEnd()}\n${added.join("\n")}\n`, { mode: 0o600 });
}
export async function ensureLocalMysql({ create = false } = {}) {
  const executable =
    process.platform === "win32"
      ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
      : "docker";
  const prefix = process.platform === "win32" ? ["--context", "desktop-linux"] : [];
  const docker = (args) =>
    execute(executable, [...prefix, ...args], {
      env: { ...process.env, DOCKER_API_VERSION: "1.43" },
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
  const name = "bibi-local-mysql",
    volume = "bibi-local-mysql-data";
  let info;
  try {
    info = JSON.parse((await docker(["inspect", name])).stdout)[0];
  } catch {
    if (!create)
      throw new Error(
        "Local MySQL is not initialized. Start Docker Desktop and run npm run db:setup:local.",
      );
    let disk;
    try {
      disk = JSON.parse((await docker(["volume", "inspect", volume])).stdout)[0];
    } catch {
      await docker(["volume", "create", "--label", "bibi.owner=local-development", volume]);
      disk = JSON.parse((await docker(["volume", "inspect", volume])).stdout)[0];
    }
    if (disk.Labels?.["bibi.owner"] !== "local-development")
      throw new Error("Refusing unowned local MySQL volume");
    await docker([
      "run",
      "-d",
      "--name",
      name,
      "--label",
      "bibi.owner=local-development",
      "--env-file",
      join(root, ".superpowers/local-db-root.env"),
      "-p",
      "127.0.0.1:33385:3306",
      "--mount",
      `type=volume,source=${volume},target=/var/lib/mysql`,
      TEST_MYSQL_IMAGE,
    ]);
    info = JSON.parse((await docker(["inspect", name])).stdout)[0];
  }
  const port = info.HostConfig?.PortBindings?.["3306/tcp"]?.[0];
  if (
    info.Config?.Labels?.["bibi.owner"] !== "local-development" ||
    ![
      TEST_MYSQL_IMAGE,
      "mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902",
    ].includes(info.Config?.Image) ||
    port?.HostIp !== "127.0.0.1" ||
    port?.HostPort !== "33385" ||
    !info.Mounts?.some((mount) => mount.Name === volume && mount.Destination === "/var/lib/mysql")
  )
    throw new Error("Refusing unexpected local development container");
  if (!info.State.Running) await docker(["start", name]);
}
export async function setupLocalDatabase() {
  const runtimePath = join(root, ".env.local"),
    migrationPath = join(root, ".env.migration.local");
  const before = await privateEnv(runtimePath),
    beforeMigration = await privateEnv(migrationPath);
  const configured = { ...before.values };
  for (const key of [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "MASTER_ADMIN_PASSWORD",
    "SEED_USER_PASSWORD",
  ])
    if (process.env[key]) configured[key] = process.env[key];
  const runtimeEnv = {
    ...configured,
    DB_HOST: configured.DB_HOST || "127.0.0.1",
    DB_PORT: configured.DB_PORT || "33385",
    DB_NAME: configured.DB_NAME || "bibi_local",
    DB_USER: configured.DB_USER || "bibi_local_runtime",
    DB_PASSWORD: configured.DB_PASSWORD || randomBytes(24).toString("hex"),
    AUTH_JWT_SECRET: configured.AUTH_JWT_SECRET || randomBytes(32).toString("hex"),
    AUTH_ALLOWED_ORIGINS:
      configured.AUTH_ALLOWED_ORIGINS ||
      "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ANALYTICS_ID_SECRET: configured.ANALYTICS_ID_SECRET || randomBytes(32).toString("hex"),
    RELEASE_PROBE_SECRET: configured.RELEASE_PROBE_SECRET || randomBytes(32).toString("hex"),
  };
  assertLocalDevelopmentTarget(runtimeEnv);
  Object.assign(runtimeEnv, await prepareLocalAccessLogs());
  const migrationEnv = {
    DB_HOST: "127.0.0.1",
    DB_PORT: "33385",
    DB_NAME: "bibi_local",
    DB_USER: "bibi_local_migrate",
    DB_PASSWORD: beforeMigration.values.DB_PASSWORD || randomBytes(24).toString("hex"),
    MASTER_ADMIN_PASSWORD:
      beforeMigration.values.MASTER_ADMIN_PASSWORD ||
      configured.MASTER_ADMIN_PASSWORD ||
      randomBytes(18).toString("hex"),
    SEED_USER_PASSWORD:
      beforeMigration.values.SEED_USER_PASSWORD ||
      configured.SEED_USER_PASSWORD ||
      randomBytes(18).toString("hex"),
  };
  await mkdir(join(root, ".superpowers"), { recursive: true });
  const rootPath = join(root, ".superpowers/local-db-root.env");
  let rootSecret = (await privateEnv(rootPath)).values.MYSQL_ROOT_PASSWORD;
  if (!rootSecret) {
    rootSecret = randomBytes(32).toString("hex");
    await writeFile(rootPath, `MYSQL_ROOT_PASSWORD=${rootSecret}\nMYSQL_ROOT_HOST=%\n`, {
      mode: 0o600,
      flag: "wx",
    });
  }
  // Persist generated credentials before creating users, so an interrupted setup is retryable.
  await saveEnv(runtimePath, before, runtimeEnv);
  await saveEnv(migrationPath, beforeMigration, migrationEnv);
  await ensureLocalMysql({ create: true });
  let admin;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      admin = await mysql.createConnection({
        host: "127.0.0.1",
        port: 33385,
        user: "root",
        password: rootSecret,
        connectTimeout: 1000,
      });
      break;
    } catch {
      if (attempt === 29)
        throw new Error("Local MySQL not ready; start Docker Desktop and rerun setup.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  try {
    await admin.query(
      "CREATE DATABASE IF NOT EXISTS bibi_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    for (const env of [runtimeEnv, migrationEnv])
      await admin.query("CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?", [
        env.DB_USER,
        env.DB_PASSWORD,
      ]);
    await admin.query(
      "GRANT SELECT,INSERT,UPDATE,DELETE ON bibi_local.* TO 'bibi_local_runtime'@'%'",
    );
    await admin.query(
      "GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES ON bibi_local.* TO 'bibi_local_migrate'@'%'",
    );
  } finally {
    await admin?.end();
  }
  const pool = mysql.createPool({
    host: "127.0.0.1",
    port: 33385,
    database: "bibi_local",
    user: migrationEnv.DB_USER,
    password: migrationEnv.DB_PASSWORD,
    timezone: "Z",
    dateStrings: true,
    connectionLimit: 2,
  });
  try {
    const { migrate } = require("../backend/dist/db/migrate.js");
    const { seedIdentity } = require("../backend/dist/db/seed.js");
    await migrate(pool, join(root, "backend/migrations"));
    await seedIdentity(pool, {
      masterPassword: migrationEnv.MASTER_ADMIN_PASSWORD,
      userPassword: migrationEnv.SEED_USER_PASSWORD,
    });
    const { migrateAccessLogs } = require("../backend/dist/access-logs/schema.js");
    await migrateAccessLogs(pool, join(root, "backend/access-log-migrations"));
  } finally {
    await pool.end();
  }
  const { createDbPool } = require("../backend/dist/db/pool.js");
  const { readDbConfig } = require("../backend/dist/config.js");
  const { readAccessLogConfig } = require("../backend/dist/access-logs/config.js");
  const { syncAccessLogs } = require("../backend/dist/access-logs/sync-service.js");
  const runtimePool = createDbPool({ ...readDbConfig(runtimeEnv), connectionLimit: 1 });
  try {
    const receipt = await syncAccessLogs({
      pool: runtimePool,
      config: readAccessLogConfig(runtimeEnv),
      clock: { now: () => new Date() },
      signal: AbortSignal.timeout(120000),
    });
    if (receipt.state !== "complete") throw new Error("Local example log import incomplete");
  } finally {
    await runtimePool.end();
  }
  console.log(
    "Local MySQL ready at127.0.0.1:33385. Runtime settings:.env.local; initial login passwords:.env.migration.local. Existing accounts were not reset.",
  );
}
if (isMain(import.meta.url))
  setupLocalDatabase().catch(() => {
    console.error(
      "Local DB setup failed. Check Docker Desktop and the dedicated local target; no production credentials are used.",
    );
    process.exitCode = 1;
  });
