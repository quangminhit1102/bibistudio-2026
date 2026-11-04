/** Never load the application's DB_* variables in the test lifecycle. */
export function assertTestDatabaseTarget({ host, database }) {
  if (
    !["127.0.0.1", "localhost", "::1"].includes(host) ||
    !/^bibi_test_[a-f0-9]{12,32}$/.test(database)
  ) {
    throw new Error("Refusing target: an isolated test database on loopback is required");
  }
}
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import mysql from "../backend/node_modules/mysql2/promise.js";
import { root } from "./runtime.mjs";

export const TEST_MYSQL_IMAGE =
  "mariadb@sha256:d769e37960821dfdcf096954f6e7ac89f747e116c1bba98e48edd265dfc7deae";
const execute = promisify(execFile);
export function testDatabaseConfiguration(env = process.env, fallbackSecret) {
  const explicit = Object.keys(env).some((key) => key.startsWith("BIBI_TEST_DB_") && env[key]);
  const host = explicit ? env.BIBI_TEST_DB_HOST : "127.0.0.1";
  const port = Number(explicit ? env.BIBI_TEST_DB_PORT : 33384);
  const password = explicit ? env.BIBI_TEST_DB_PASSWORD : fallbackSecret;
  assertTestDatabaseTarget({ host, database: "bibi_test_0123456789abcdef" });
  if (!password || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Complete loopback BIBI_TEST_DB_HOST/PORT/PASSWORD settings are required");
  return { host, port, user: "root", password };
}

/** Reuse only the labelled local test container; each test owns/drop its random schema. */
export async function ensureTestDatabase(env = process.env) {
  let settings;
  const explicit = Object.keys(env).some((key) => key.startsWith("BIBI_TEST_DB_") && env[key]);
  if (explicit) settings = testDatabaseConfiguration(env);
  else {
    const privatePath = join(root, ".superpowers/auth-test-db.env");
    let secret;
    try {
      secret = (await readFile(privatePath, "utf8")).match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)?.[1];
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (!secret) {
      secret = randomBytes(32).toString("hex");
      await mkdir(join(root, ".superpowers"), { recursive: true });
      await writeFile(privatePath, `MYSQL_ROOT_PASSWORD=${secret}\nMYSQL_ROOT_HOST=%\n`, {
        mode: 0o600,
        flag: "wx",
      });
    }
    settings = testDatabaseConfiguration({}, secret);
    const executable =
      process.platform === "win32"
        ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
        : "docker";
    const prefix = process.platform === "win32" ? ["--context", "desktop-linux"] : [];
    const docker = (args) =>
      execute(executable, [...prefix, ...args], {
        env: { ...env, DOCKER_API_VERSION: "1.43" },
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      });
    const name = "bibi-auth-test-mariadb-20261104";
    let info;
    try {
      info = JSON.parse((await docker(["inspect", name])).stdout)[0];
    } catch {
      try {
        await docker([
          "run",
          "-d",
          "--name",
          name,
          "--label",
          "bibi.owner=admin-auth-mariadb-20261104",
          "--env-file",
          privatePath,
          "-p",
          "127.0.0.1:33384:3306",
          TEST_MYSQL_IMAGE,
        ]);
        info = JSON.parse((await docker(["inspect", name])).stdout)[0];
      } catch {
        throw new Error(
          "Test MySQL unavailable. Start Docker Desktop or supply guarded loopback BIBI_TEST_DB settings.",
        );
      }
    }
    const port = info.HostConfig?.PortBindings?.["3306/tcp"]?.[0];
    if (
      info.Config?.Labels?.["bibi.owner"] !== "admin-auth-mariadb-20261104" ||
      info.Config?.Image !== TEST_MYSQL_IMAGE ||
      port?.HostIp !== "127.0.0.1" ||
      port?.HostPort !== "33384"
    )
      throw new Error("Refusing unowned or unexpected test container");
    if (!info.State?.Running) await docker(["start", name]);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    let connection;
    try {
      connection = await mysql.createConnection({ ...settings, connectTimeout: 1000 });
      await connection.query("SELECT 1");
      return settings;
    } catch {
      if (attempt === 29)
        throw new Error(
          "Isolated test MySQL did not become ready; application DB credentials are never used.",
        );
    } finally {
      await connection?.end();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
