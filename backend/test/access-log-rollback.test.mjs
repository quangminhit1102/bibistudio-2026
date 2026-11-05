import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, writeFile, readFile, readlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import vm from "node:vm";
import { createAuthFixture } from "./helpers/auth.mjs";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { archiveFixture, accessLogLine } from "./helpers/access-logs.mjs";
import { serve } from "./helpers/http.mjs";
import { bridge } from "./helpers/native-backup.mjs";
import { migrateAccessLogs } from "../dist/access-logs/schema.js";
import { syncAccessLogArchives } from "../dist/access-logs/importer.js";
import { createVerifiedBackup, runNativeTool } from "../dist/db/backup.js";
import { readSchemaStatus } from "../dist/db/status.js";
const require = createRequire(import.meta.url),
  deploy = require("../../ops/deploy.cjs");
const { createDatabaseMetadata } = require("../../ops/database-metadata.cjs");
const { createAccessLogMetadata } = require("../../ops/access-log-metadata.cjs");
const { makeManifest } = require("../../ops/release.cjs");
test("actual native backup includes log checkpoints; failed activation retains post-backup rows and revocation with exact e725 factory ready", async (t) => {
  const f = await createAuthFixture(t),
    verifier = await createDatabaseFixture(t),
    archive = await archiveFixture(t);
  await migrateAccessLogs(f.pool, resolve("backend/access-log-migrations"));
  await archive.write([accessLogLine()]);
  const sync = () =>
    syncAccessLogArchives({
      pool: f.pool,
      config: archive.config,
      clock: f.clock,
      signal: AbortSignal.timeout(120000),
    });
  assert.equal((await sync()).inserted, 1);
  const root = await mkdtemp(join(tmpdir(), "bibi-log-rollback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = { root, site: join(root, "site"), environment: "staging" };
  await mkdir(config.site);
  await writeFile(join(config.site, ".htaccess"), "original");
  const database = await createDatabaseMetadata(resolve("backend")),
    accessLogs = await createAccessLogMetadata(resolve("backend"));
  const first = "e7257b4962d1afd7689234c70cb65fb176e828d3-41852205705",
    second = "b".repeat(40) + "-41852205706";
  for (const id of [first, second]) {
    const dir = join(root, "releases", id);
    await mkdir(join(dir, "frontend/assets"), { recursive: true });
    await cp("backend/migrations", join(dir, "backend/migrations"), { recursive: true });
    await cp("backend/analytics-catalogue.json", join(dir, "backend/analytics-catalogue.json"));
    if (id === second)
      await cp("backend/access-log-migrations", join(dir, "backend/access-log-migrations"), {
        recursive: true,
      });
    await writeFile(join(dir, "frontend/index.html"), "fixture");
    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify(
        makeManifest(
          id.slice(0, 40),
          id.slice(41),
          database,
          id === second ? accessLogs : undefined,
        ),
      ),
    );
  }
  const backups = [];
  const hooks = {
    install: async () => {},
    restart: async () => {},
    verify: async () => {},
    verifyReleaseProbe: async () => ({ ok: true }),
    databaseStatus: () => readSchemaStatus(f.pool, resolve("backend/migrations")),
    prepareDatabase: async (_config, release) => {
      const receipt = await createVerifiedBackup({
        pool: f.pool,
        database: f.dbConfig,
        verifyDatabase: verifier.config.database,
        directory: join(root, "backups"),
        releaseId: release.manifest.releaseId,
        flavor: "mariadb",
        runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
      });
      backups.push(receipt);
      return receipt;
    },
  };
  await deploy.activateRelease(config, first, hooks);
  const grant = await f.auth.login({ username: "user01", password: f.secrets.userPassword });
  await assert.rejects(
    deploy.activateRelease(config, second, {
      ...hooks,
      verifyReleaseProbe: async (_config, release) => {
        if (release.manifest.releaseId === first) return { ok: true };
        await archive.write([accessLogLine(), accessLogLine()]);
        assert.equal((await sync()).inserted, 1);
        await f.auth.logout(grant.refreshToken);
        throw new Error("feature probe rejected");
      },
    }),
    /feature probe rejected; previous release restored/,
  );
  assert.ok((await readlink(join(root, "current"))).endsWith(first));
  assert.ok(backups.at(-1).tableCount >= 4);
  const dump = await readFile(backups.at(-1).path, "utf8");
  for (const table of [
    "access_log_migrations",
    "access_log_sources",
    "access_log_records",
    "access_log_import_runs",
  ])
    assert.ok(dump.includes("`" + table + "`"));
  const [[count]] = await f.pool.query("SELECT COUNT(*) n FROM access_log_records");
  assert.equal(count.n, 2);
  const [[point]] = await f.pool.query(
    "SELECT committed_lines,record_count FROM access_log_sources",
  );
  assert.equal(Number(point.committed_lines), 2);
  assert.equal(Number(point.record_count), 2);
  await assert.rejects(f.auth.refresh(grant.refreshToken));
  const code = gunzipSync(
    await readFile(new URL("./fixtures/pre-log-app.cjs.gz", import.meta.url)),
  ).toString("utf8");
  const receipt = JSON.parse(
    await readFile(new URL("./fixtures/pre-log-app.json", import.meta.url), "utf8"),
  );
  assert.equal(createHash("sha256").update(code).digest("hex"), receipt.compiledSha256);
  const baseline = { exports: {} };
  vm.runInNewContext(code, {
    require: createRequire(new URL("../dist/app.js", import.meta.url)),
    module: baseline,
    exports: baseline.exports,
    process: { env: { NODE_ENV: "production" } },
  });
  const base = await serve(
    t,
    baseline.exports.createApp(
      { releaseId: first, sourceSha: receipt.sourceSha },
      { db: f.pool, config: f.config, clock: f.clock },
    ),
  );
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  assert.equal((await fetch(base + "/api/accounts")).status, 401);
});
