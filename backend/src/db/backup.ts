import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, realpath, chmod, writeFile, unlink, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { DbConfig } from "../config";

export interface ToolFiles {
  inputFile?: string;
  outputFile?: string;
  maxBytes?: number;
}
export type BackupTool = (
  kind: "dump" | "restore",
  args: string[],
  files: ToolFiles,
) => Promise<void>;
export interface BackupReceipt {
  path: string;
  sha256: string;
  bytes: number;
  verified: true;
  tableCount: number;
}
const identifier = /^[a-zA-Z0-9_]{1,64}$/;
const quote = (value: string) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;

/** Passwords travel through a private option file, never argv or diagnostic output. */
export async function runNativeTool(
  binary: string,
  args: string[],
  files: ToolFiles,
): Promise<void> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/PASSWORD|SECRET|TOKEN|PRIVATE_KEY/i.test(key)),
  );
  const child = spawn(binary, args, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env,
    signal: AbortSignal.timeout(120000),
  });
  child.stderr.resume();
  const tasks: Promise<unknown>[] = [
    new Promise<void>((done, fail) => {
      child.once("error", () => fail(new Error("Database client operation failed")));
      child.once("close", (code) =>
        code === 0 ? done() : fail(new Error("Database client operation failed")),
      );
    }),
  ];
  if (files.inputFile) tasks.push(pipeline(createReadStream(files.inputFile), child.stdin));
  else child.stdin.end();
  if (files.outputFile) {
    let size = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        size += chunk.length;
        done(
          size > (files.maxBytes ?? 128 * 1024 ** 2)
            ? new Error("Backup size limit exceeded")
            : null,
          chunk,
        );
      },
    });
    tasks.push(
      pipeline(
        child.stdout,
        limit,
        createWriteStream(files.outputFile, { flags: "wx", mode: 0o600, flush: true }),
      ),
    );
  } else child.stdout.resume();
  try {
    await Promise.all(tasks);
  } catch {
    child.kill();
    await Promise.allSettled(tasks);
    throw new Error("Database backup/restore client failed");
  }
}
async function digest(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function tableNames(connection: PoolConnection, database: string): Promise<string[]> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT table_name name FROM information_schema.tables WHERE table_schema=? ORDER BY table_name",
    [database],
  );
  const names = rows.map((row) => String(row.name));
  if (names.some((name) => !identifier.test(name)))
    throw new Error("Unsupported database table name");
  return names;
}
async function clearVerifier(connection: PoolConnection, database: string, expected: string[]) {
  const names = await tableNames(connection, database);
  if (names.some((name) => !expected.includes(name)))
    throw new Error("Unexpected verification objects; manual cleanup required");
  await connection.query("SET FOREIGN_KEY_CHECKS=0");
  try {
    for (const name of names) await connection.query(`DROP TABLE \`${database}\`.\`${name}\``);
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  }
}

/** Verification is confined to a distinct, pre-created empty DB. Never restores the source DB. */
export async function createVerifiedBackup(options: {
  pool: Pool;
  database: DbConfig;
  verifyDatabase: string;
  directory: string;
  releaseId: string;
  flavor: "mysql" | "mariadb";
  runTool?: BackupTool;
  dumpBin?: string;
  clientBin?: string;
  maxBytes?: number;
  verifyRestored?: (connection: PoolConnection, database: string) => Promise<void>;
}): Promise<BackupReceipt> {
  const { database, verifyDatabase } = options;
  if (
    !identifier.test(database.database) ||
    !identifier.test(verifyDatabase) ||
    database.database.toLowerCase() === verifyDatabase.toLowerCase()
  )
    throw new Error("A distinct verification restore target is required");
  if (!/^[a-f0-9]{40}-[1-9][0-9]*$/.test(options.releaseId))
    throw new Error("Invalid backup release identity");
  if (!["mysql", "mariadb"].includes(options.flavor)) throw new Error("Unknown backup tool flavor");
  const directory = resolve(options.directory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const actual = await realpath(directory);
  if (
    (process.platform === "win32" ? actual.toLowerCase() : actual) !==
    (process.platform === "win32" ? directory.toLowerCase() : directory)
  )
    throw new Error("Backup directory must be a private real directory, not a symbolic link");
  await chmod(directory, 0o700);
  const maxBytes = options.maxBytes ?? 128 * 1024 ** 2;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 1024 ** 3)
    throw new Error("Invalid backup size limit");
  const stem = join(directory, `${options.releaseId}-${randomUUID()}`);
  const backup = stem + ".sql",
    verification = stem + ".verify.sql",
    credentials = stem + ".cnf";
  const connection = await options.pool.getConnection();
  let locked = false,
    restoreStarted = false;
  let expected: string[] = [];
  try {
    const lockName =
      "bibi-restore:" + createHash("sha256").update(verifyDatabase).digest("hex").slice(0, 32);
    const [[lock]] = await connection.execute<RowDataPacket[]>("SELECT GET_LOCK(?,10) acquired", [
      lockName,
    ]);
    if (lock.acquired !== 1) throw new Error("Backup verification lock unavailable");
    locked = true;
    const [databases] = await connection.execute<RowDataPacket[]>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name=?",
      [verifyDatabase],
    );
    if (!databases.length) throw new Error("Verification restore target must be pre-created");
    if ((await tableNames(connection, verifyDatabase)).length)
      throw new Error("Verification database must be empty; refusing to overwrite it");
    const [[unsupported]] = await connection.execute<RowDataPacket[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND (table_type<>'BASE TABLE' OR engine<>'InnoDB')",
      [database.database],
    );
    if (Number(unsupported.n))
      throw new Error("Consistent backup requires an InnoDB-only dedicated database");
    for (const [table, column] of [
      ["triggers", "trigger_schema"],
      ["routines", "routine_schema"],
      ["events", "event_schema"],
    ]) {
      const [[row]] = await connection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) n FROM information_schema.${table} WHERE ${column}=?`,
        [database.database],
      );
      if (Number(row.n))
        throw new Error("Unsupported stored database objects; backup requires explicit review");
    }
    expected = await tableNames(connection, database.database);
    const fields = [
      "[client]",
      `host=${quote(database.host)}`,
      `port=${database.port}`,
      `user=${quote(database.user)}`,
      `password=${quote(database.password)}`,
      "default-character-set=utf8mb4",
      database.socketPath
        ? `socket=${quote(database.socketPath)}\nprotocol=SOCKET`
        : "protocol=TCP",
    ];
    await writeFile(credentials, fields.join("\n") + "\n", { flag: "wx", mode: 0o600 });
    const run =
      options.runTool ??
      ((kind, args, files) => {
        const binary = kind === "dump" ? options.dumpBin : options.clientBin;
        const allowed =
          kind === "dump"
            ? /^\/(?:usr\/)?bin\/(?:mariadb-dump|mysqldump)$/
            : /^\/(?:usr\/)?bin\/(?:mariadb|mysql)$/;
        if (!binary || !allowed.test(binary))
          throw new Error("Measured database tool path required");
        return runNativeTool(binary, args, files);
      });
    const dump = (name: string, outputFile: string) =>
      run(
        "dump",
        [
          `--defaults-file=${credentials}`,
          "--single-transaction",
          "--quick",
          "--skip-lock-tables",
          "--skip-add-locks",
          "--skip-comments",
          "--skip-dump-date",
          "--skip-add-drop-table",
          "--hex-blob",
          "--order-by-primary",
          "--skip-triggers",
          "--no-tablespaces",
          ...(options.flavor === "mysql" ? ["--set-gtid-purged=OFF", "--column-statistics=0"] : []),
          name,
        ],
        { outputFile, maxBytes },
      );
    await dump(database.database, backup);
    const sha256 = await digest(backup);
    restoreStarted = true;
    await run("restore", [`--defaults-file=${credentials}`, "--binary-mode", verifyDatabase], {
      inputFile: backup,
    });
    const restored = await tableNames(connection, verifyDatabase);
    if (JSON.stringify(restored) !== JSON.stringify(expected))
      throw new Error("Restored database table set mismatch");
    await options.verifyRestored?.(connection, verifyDatabase);
    await dump(verifyDatabase, verification);
    if ((await digest(verification)) !== sha256)
      throw new Error("Restored database checksum verification failed");
    return {
      path: backup,
      sha256,
      bytes: (await stat(backup)).size,
      verified: true,
      tableCount: expected.length,
    };
  } finally {
    try {
      if (restoreStarted) {
        await clearVerifier(connection, verifyDatabase, expected);
      }
    } finally {
      try {
        await Promise.all(
          [credentials, verification].map((file) =>
            unlink(file).catch((error) => {
              if (error.code !== "ENOENT") throw error;
            }),
          ),
        );
      } finally {
        try {
          if (locked)
            await connection.execute("SELECT RELEASE_LOCK(?)", [
              "bibi-restore:" +
                createHash("sha256").update(verifyDatabase).digest("hex").slice(0, 32),
            ]);
        } finally {
          connection.release();
        }
      }
    }
  }
}
