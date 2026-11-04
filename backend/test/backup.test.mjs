import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";


import { createAuthFixture } from "./helpers/auth.mjs";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { bridge } from "./helpers/native-backup.mjs";
test("real native MariaDB backup restores into an empty isolated DB and preserves newer source writes/revocations", async (t) => {
  const f = await createAuthFixture(t);
  const verify = await createDatabaseFixture(t);
  const directory = await mkdtemp(join(tmpdir(), "bibi-backup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { createVerifiedBackup, runNativeTool } = await import("../dist/db/backup.js");
  const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  let changed = false;
  const receipt = await createVerifiedBackup({
    pool: f.pool,
    database: f.dbConfig,
    verifyDatabase: verify.config.database,
    directory,
    releaseId: "a".repeat(40) + "-123",
    flavor: "mariadb",
    runTool: async (kind, args, io) => {
      await bridge(kind, args, io, runNativeTool);
      if (kind === "dump" && args.at(-1) === f.dbConfig.database && !changed) {
        changed = true;
        await f.pool.query(
          "UPDATE users SET display_name='edited-after-backup' WHERE username='user01'",
        );
        await f.auth.logout(grant.refreshToken);
      }
    },
  });
  assert.equal(receipt.verified, true);
  const bytes = await readFile(receipt.path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), receipt.sha256);
  assert.ok(receipt.bytes > 0);
  for (const secret of [f.dbConfig.password, f.secrets.userPassword, grant.refreshToken])
    assert.ok(!bytes.includes(Buffer.from(secret)));
  const [[user]] = await f.pool.query("SELECT display_name FROM users WHERE username='user01'");
  assert.equal(user.display_name, "edited-after-backup");
  const [[session]] = await f.pool.query("SELECT revoked_at FROM refresh_token_sessions");
  assert.ok(session.revoked_at);
  const [[remaining]] = await verify.pool.query(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE()",
  );
  assert.equal(remaining.n, 0);
  assert.equal(
    (await readdir(directory)).some((name) => name.endsWith(".cnf")),
    false,
  );
  if (process.platform !== "win32") assert.equal((await stat(receipt.path)).mode & 0o777, 0o600);
});

test("backup refuses production as restore target and refuses nonempty verification DB without mutation", async (t) => {
  const f = await createAuthFixture(t);
  const verify = await createDatabaseFixture(t);
  const directory = await mkdtemp(join(tmpdir(), "bibi-backup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { createVerifiedBackup } = await import("../dist/db/backup.js");
  let calls = 0;
  const input = {
    pool: f.pool,
    database: f.dbConfig,
    verifyDatabase: f.dbConfig.database,
    directory,
    releaseId: "a".repeat(40) + "-123",
    flavor: "mariadb",
    runTool: async () => {
      calls++;
    },
  };
  await assert.rejects(createVerifiedBackup(input), /verification|restore target/i);
  await verify.pool.query("CREATE TABLE sentinel(id INT PRIMARY KEY) ENGINE=InnoDB");
  await verify.pool.query("INSERT INTO sentinel VALUES(7)");
  await assert.rejects(
    createVerifiedBackup({ ...input, verifyDatabase: verify.config.database }),
    /empty/i,
  );
  assert.equal(calls, 0);
  const [[row]] = await verify.pool.query("SELECT id FROM sentinel");
  assert.equal(row.id, 7);
});
test("native restore failure stops verification, cleans partial verifier and retains private source backup", async (t) => {
  const f = await createAuthFixture(t),
    verify = await createDatabaseFixture(t);
  const directory = await mkdtemp(join(tmpdir(), "bibi-backup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { createVerifiedBackup, runNativeTool } = await import("../dist/db/backup.js");
  await assert.rejects(
    createVerifiedBackup({
      pool: f.pool,
      database: f.dbConfig,
      verifyDatabase: verify.config.database,
      directory,
      releaseId: "b".repeat(40) + "-124",
      flavor: "mariadb",
      runTool: async (kind, args, io) => {
        if (kind !== "restore") return bridge(kind, args, io, runNativeTool);
        const corrupt = io.inputFile + ".invalid";
        await writeFile(
          corrupt,
          Buffer.concat([
            await readFile(io.inputFile),
            Buffer.from("\nTHIS_IS_CONTROLLED_INVALID_SQL;\n"),
          ]),
          { mode: 0o600 },
        );
        try {
          await bridge(kind, args, { ...io, inputFile: corrupt }, runNativeTool);
        } finally {
          await unlink(corrupt);
        }
      },
    }),
    /backup\/restore client failed/,
  );
  const [[source]] = await f.pool.query("SELECT COUNT(*) n FROM users");
  assert.equal(source.n, 2);
  const [[remaining]] = await verify.pool.query(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE()",
  );
  assert.equal(remaining.n, 0);
  const files = await readdir(directory);
  assert.equal(files.filter((name) => name.endsWith(".sql")).length, 1);
  assert.equal(
    files.some((name) => name.endsWith(".cnf")),
    false,
  );
});

