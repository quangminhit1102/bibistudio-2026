import test from "node:test";
import assert from "node:assert/strict";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDatabaseFixture } from "./helpers/database.mjs";
const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/db/cli.js", import.meta.url));

test("explicit migrate/status/seed CLI operates only the supplied DB and prints no credentials", async (t) => {
  const { config } = await createDatabaseFixture(t);
  const env = {
    ...process.env,
    DB_HOST: config.host,
    DB_PORT: String(config.port),
    DB_NAME: config.database,
    DB_USER: config.user,
    DB_PASSWORD: config.password,
    MASTER_ADMIN_PASSWORD: "Only-test-Cli!99",
    SEED_USER_PASSWORD: "Only-test-Cli!88",
  };
  const run = async (command) => {
    const { stdout, stderr } = await exec(process.execPath, [cli, command], { env });
    for (const secret of [env.DB_PASSWORD, env.MASTER_ADMIN_PASSWORD, env.SEED_USER_PASSWORD])
      assert.ok(!(stdout + stderr).includes(secret));
    return JSON.parse(stdout);
  };
  assert.equal((await run("migrate")).version, 4);
  assert.equal((await run("status")).ready, true);
  assert.equal((await run("seed")).ok, true);
  assert.equal((await run("seed")).ok, true);
  const withoutBootstrap = await exec(process.execPath, [cli, "seed"], {
    env: { ...env, MASTER_ADMIN_PASSWORD: "", SEED_USER_PASSWORD: "" },
  });
  assert.equal(JSON.parse(withoutBootstrap.stdout).ok, true);
  await assert.rejects(exec(process.execPath, [cli, "drop"], { env }), /Command failed/);
});
