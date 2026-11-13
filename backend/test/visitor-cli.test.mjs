import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createAuthFixture } from "./helpers/auth.mjs";
const execute = promisify(execFile);
test("actual visitor CLI accepts empty status before first migration and rejects dirty state", async (t) => {
  const f = await createAuthFixture(t, { visitorHistory: false });
  const directory = await mkdtemp(join(tmpdir(), "bibi-visitor-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "maintenance.env");
  const values = {
    DB_HOST: f.dbConfig.host,
    DB_PORT: String(f.dbConfig.port),
    DB_NAME: f.dbConfig.database,
    DB_USER: f.dbConfig.user,
    DB_PASSWORD: f.dbConfig.password,
  };
  await writeFile(
    file,
    Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  const invoke = (command) =>
    execute(process.execPath, [resolve("backend/dist/visitors/cli.js"), command], {
      windowsHide: true,
      env: { ...process.env, NODE_ENV: "test", BIBI_PRIVATE_ENV_FILE: file },
    });
  const empty = JSON.parse((await invoke("status")).stdout);
  assert.equal(empty.state, "empty");
  assert.equal(empty.version, 0);
  assert.equal(JSON.parse((await invoke("migrate")).stdout).state, "complete");
  assert.equal(JSON.parse((await invoke("status")).stdout).state, "complete");
  await f.pool.query("UPDATE visitor_history_schema_migrations SET state='dirty'");
  await assert.rejects(invoke("status"), (error) => error.code === 1);
});
