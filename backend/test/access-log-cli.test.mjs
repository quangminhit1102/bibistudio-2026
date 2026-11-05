import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { createAuthFixture } from "./helpers/auth.mjs";
import { archiveFixture, accessLogLine } from "./helpers/access-logs.mjs";
import { readAccessLogConfig } from "../dist/access-logs/config.js";
import { createRuntime } from "../dist/runtime.js";
const execute = promisify(execFile);
async function run(file, args) {
  const options = {
    env: { ...process.env, BIBI_PRIVATE_ENV_FILE: file, DB_PASSWORD: "ambient-must-not-be-used" },
    timeout: 15000,
    windowsHide: true,
  };
  try {
    const r = await execute(
      process.execPath,
      ["backend/dist/access-logs/cli.js", ...args],
      options,
    );
    return { ...r, code: 0 };
  } catch (error) {
    return { stdout: error.stdout ?? "", stderr: error.stderr ?? "", code: error.code };
  }
}
async function privateFile(f, env) {
  const file = join(f.root, "private", "runtime.env");
  await mkdir(join(f.root, "private"));
  await writeFile(
    file,
    Object.entries(env)
      .map(([k, v]) => k + "=" + JSON.stringify(v))
      .join("\n"),
    { mode: 0o600 },
  );
  return file;
}
function environment(db, files) {
  return {
    DB_HOST: db.config.host,
    DB_PORT: String(db.config.port),
    DB_USER: db.config.user,
    DB_PASSWORD: db.config.password,
    DB_NAME: db.config.database,
    DB_POOL_LIMIT: "5",
    ACCESS_LOG_ARCHIVE_DIR: files.config.archiveDirectory,
    ACCESS_LOG_DOMAIN_ALIAS: files.config.domainAlias,
    ACCESS_LOG_WORK_DIR: files.config.workDirectory,
  };
}
test("access log config requires complete private absolute paths and fixed bounded defaults", () => {
  assert.throws(() => readAccessLogConfig({}), /config/i);
  assert.throws(
    () =>
      readAccessLogConfig({
        ACCESS_LOG_ARCHIVE_DIR: "../../etc",
        ACCESS_LOG_DOMAIN_ALIAS: "example.test",
        ACCESS_LOG_WORK_DIR: "/tmp/work",
      }),
    /config/i,
  );
  const value = readAccessLogConfig({
    ACCESS_LOG_ARCHIVE_DIR: join(process.cwd(), "archive"),
    ACCESS_LOG_DOMAIN_ALIAS: "example.test",
    ACCESS_LOG_WORK_DIR: join(process.cwd(), "work"),
  });
  assert.equal(value.limits.batchRows, 500);
  assert.equal(value.limits.runMs, 120000);
});
test("real CLI migrates explicitly, uses private env, exits2 for pending and never prints secrets/raw data", async (t) => {
  const db = await createDatabaseFixture(t),
    files = await archiveFixture(t);
  const env = environment(db, files),
    file = await privateFile(files, env);
  assert.equal((await run(file, ["migrate"])).code, 0);
  const status = await run(file, ["status"]);
  assert.equal(status.code, 0);
  assert.equal(JSON.parse(status.stdout).version, 1);
  await files.write([accessLogLine(), accessLogLine()]);
  const complete = await run(file, ["sync"]);
  assert.equal(complete.code, 0);
  assert.equal(JSON.parse(complete.stdout).inserted, 2);
  assert.equal(JSON.parse((await run(file, ["sync"])).stdout).inserted, 0);
  await files.write([accessLogLine(), accessLogLine(), accessLogLine()], "");
  const pending = await run(file, ["sync"]);
  assert.equal(pending.code, 2);
  assert.equal(JSON.parse(pending.stdout).state, "pending");
  for (const output of [complete.stdout, complete.stderr, pending.stdout, pending.stderr]) {
    assert.ok(!output.includes(env.DB_PASSWORD));
    assert.ok(!output.includes("token=secret"));
    assert.ok(!output.includes("203.0.113.42"));
  }
});
test("CLI fails closed for extra args, missing/relative private config and unsafe owner modes", async (t) => {
  const db = await createDatabaseFixture(t),
    files = await archiveFixture(t),
    file = await privateFile(files, environment(db, files));
  for (const [path, args] of [
    [file, ["sync", "/etc/passwd"]],
    ["relative.env", ["status"]],
    [file + ".missing", ["migrate"]],
    [file, ["unknown"]],
  ]) {
    const result = await run(path, args);
    assert.equal(result.code, 1);
    assert.ok(!result.stderr.includes(db.config.password));
    assert.ok(!result.stderr.includes("stack"));
  }
  if (process.platform !== "win32") {
    await chmod(file, 0o644);
    assert.equal((await run(file, ["status"])).code, 1);
  }
});
test("runtime publishes only read dependencies, never source paths, migration or importer at startup", async (t) => {
  const f = await createAuthFixture(t),
    files = await archiveFixture(t);
  const env = {
    ...environment({ config: f.dbConfig }, files),
    AUTH_JWT_SECRET: f.config.jwtSecret,
    AUTH_ALLOWED_ORIGINS: "http://localhost:5173",
    ANALYTICS_ID_SECRET: randomBytes(32).toString("hex"),
    RELEASE_PROBE_SECRET: randomBytes(32).toString("hex"),
  };
  const runtime = createRuntime(env, f.clock);
  try {
    assert.equal(runtime.appOptions.accessLogs.pool, runtime.appOptions.db);
    assert.equal("archiveDirectory" in runtime.appOptions.accessLogs, false);
    const [[state]] = await f.pool.query(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='access_log_records'",
    );
    assert.equal(state.n, 0);
    assert.throws(() => createRuntime({ ...env, ACCESS_LOG_WORK_DIR: "" }, f.clock), /config/i);
  } finally {
    await runtime.close();
  }
  await assert.rejects(runtime.appOptions.db.getConnection());
});
