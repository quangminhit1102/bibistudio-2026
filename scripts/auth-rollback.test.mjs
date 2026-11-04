import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readlink, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createAuthFixture } from "../backend/test/helpers/auth.mjs";
import { createDatabaseFixture } from "../backend/test/helpers/database.mjs";
import { bridge } from "../backend/test/helpers/native-backup.mjs";
const require = createRequire(import.meta.url);
const deploy = require("../ops/deploy.cjs");
const { createDatabaseMetadata } = require("../ops/database-metadata.cjs");
test("failed post-activation probe rolls app back while keeping DB writes and logout after actual verified backup", async (t) => {
  const f = await createAuthFixture(t);
  const verifier = await createDatabaseFixture(t);
  const { createVerifiedBackup, runNativeTool } = await import("../backend/dist/db/backup.js");
  const { readSchemaStatus } = await import("../backend/dist/db/status.js");
  const root = await mkdtemp(join(tmpdir(), "bibi-auth-rollback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = { root, site: join(root, "site"), environment: "staging" };
  await mkdir(config.site);
  await writeFile(join(config.site, ".htaccess"), "original");
  const database = await createDatabaseMetadata(resolve("backend"));
  const first = "a".repeat(40) + "-1",
    second = "b".repeat(40) + "-2";
  for (const id of [first, second]) {
    const dir = join(root, "releases", id);
    await mkdir(join(dir, "frontend/assets"), { recursive: true });
    await cp("backend/migrations", join(dir, "backend/migrations"), { recursive: true });
    await cp("backend/analytics-catalogue.json", join(dir, "backend/analytics-catalogue.json"));
    await writeFile(join(dir, "frontend/index.html"), "test");
    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify({
        schemaVersion: 2,
        releaseId: id,
        sourceSha: id.slice(0, 40),
        ciRunId: id.slice(-1),
        database,
      }),
    );
  }
  const hooks = {
    install: async () => {},
    restart: async () => {},
    verify: async () => {},
    databaseStatus: () => readSchemaStatus(f.pool, resolve("backend/migrations")),
    prepareDatabase: async (_config, release) =>
      createVerifiedBackup({
        pool: f.pool,
        database: f.dbConfig,
        verifyDatabase: verifier.config.database,
        directory: join(root, "backups"),
        releaseId: release.manifest.releaseId,
        flavor: "mariadb",
        runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
      }),
    verifyReleaseProbe: async () => ({ ok: true }),
  };
  await deploy.activateRelease(config, first, hooks);
  const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  await assert.rejects(
    deploy.activateRelease(config, second, {
      ...hooks,
      verifyReleaseProbe: async (_c, release) => {
        if (release.manifest.releaseId !== second) return { ok: true };
        await f.pool.execute(
          "UPDATE users SET display_name='Saved after backup' WHERE username='user01'",
        );
        await f.auth.logout(grant.refreshToken);
        throw new Error("release probe rejected");
      },
    }),
    /release probe rejected; previous release restored/,
  );
  assert.ok((await readlink(join(root, "current"))).endsWith(first));
  const [[user]] = await f.pool.query("SELECT display_name FROM users WHERE username='user01'");
  assert.equal(user.display_name, "Saved after backup");
  await assert.rejects(f.auth.refresh(grant.refreshToken));
  const [[audits]] = await f.pool.query(
    "SELECT COUNT(*) n FROM audit_logs WHERE action='auth.logout'",
  );
  assert.ok(audits.n >= 1);
  await assert.rejects(readFile(join(root, "releases", second, ".successful")), { code: "ENOENT" });
  const before = await readlink(join(root, "current"));
  await assert.rejects(
    deploy.rollbackRelease(config, first, {
      ...hooks,
      databaseStatus: async () => ({ version: 5, state: "complete" }),
    }),
    /Incompatible database schema/,
  );
  assert.equal(await readlink(join(root, "current")), before);
});
