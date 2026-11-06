import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileFixture } from "./helpers/profiles.mjs";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { pngImage } from "./helpers/avatar-images.mjs";
import { bridge } from "./helpers/native-backup.mjs";
import { runNativeTool } from "../dist/db/backup.js";
test("paired native backup restores DB and every referenced private image, and pins retired assets", async (t) => {
  const { createProfileBackup, cleanupProfileAssets } = await import("../dist/profile/backup.js");
  const f = await createProfileFixture(t),
    verify = await createDatabaseFixture(t),
    directory = await mkdtemp(join(tmpdir(), "bibi-paired-backup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const a = await (await f.upload(pngImage(), 1)).json();
  const receipt = await createProfileBackup({
    pool: f.pool,
    database: f.dbConfig,
    verifyDatabase: verify.config.database,
    directory,
    assetDirectory: f.assetDirectory,
    releaseId: "a".repeat(40) + "-123",
    flavor: "mariadb",
    runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
  });
  assert.equal(receipt.verified, true);
  assert.equal(receipt.profiles, true);
  assert.equal(receipt.assetCount, 1);
  const manifest = JSON.parse(await readFile(receipt.manifestPath, "utf8"));
  assert.equal(manifest.assets[0].id, a.avatarId);
  await f.upload(pngImage(20, 20), a.revision);
  await f.pool.query("UPDATE profile_avatar_assets SET retired_at=? WHERE id=?", [
    "2026-01-01",
    a.avatarId,
  ]);
  const cleanup = await cleanupProfileAssets({
    pool: f.pool,
    assetDirectory: f.assetDirectory,
    backupDirectory: directory,
    now: new Date("2026-11-07"),
  });
  assert.equal(cleanup.removed, 0);
  await writeFile(join(receipt.assetsDirectory, a.avatarId + ".png"), "corrupted");
  await assert.rejects(
    cleanupProfileAssets({
      pool: f.pool,
      assetDirectory: f.assetDirectory,
      backupDirectory: directory,
      now: new Date("2026-11-07"),
    }),
    /backup|avatar|ảnh/i,
  );
});
test("missing active file blocks paired backup before success receipt", async (t) => {
  const { createProfileBackup } = await import("../dist/profile/backup.js");
  const f = await createProfileFixture(t),
    verify = await createDatabaseFixture(t),
    directory = await mkdtemp(join(tmpdir(), "bibi-paired-broken-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const a = await (await f.upload(pngImage(), 1)).json();
  await f.assets.remove(a.avatarId, "png");
  await assert.rejects(
    createProfileBackup({
      pool: f.pool,
      database: f.dbConfig,
      verifyDatabase: verify.config.database,
      directory,
      assetDirectory: f.assetDirectory,
      releaseId: "b".repeat(40) + "-123",
      flavor: "mariadb",
      runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
    }),
  );
});

test("cleanup preserves current/recent assets, removes aged retired and orphan files only", async (t) => {
  const { cleanupProfileAssets } = await import("../dist/profile/backup.js");
  const { utimes } = await import("node:fs/promises");
  const f = await createProfileFixture(t),
    directory = await mkdtemp(join(tmpdir(), "bibi-profile-gc-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await (await f.upload(pngImage(), 1)).json(),
    current = await (await f.upload(pngImage(20, 20), first.revision)).json();
  await f.pool.query("UPDATE profile_avatar_assets SET retired_at=? WHERE id=?", [
    "2026-01-01",
    first.avatarId,
  ]);
  const old = await f.assets.write({ bytes: pngImage(), format: "png", width: 10, height: 10 }),
    fresh = await f.assets.write({ bytes: pngImage(), format: "png", width: 10, height: 10 });
  const now = new Date(),
    aged = new Date(+now - 25 * 3600000);
  await utimes(join(f.assetDirectory, old.id + ".png"), aged, aged);
  const receipt = await cleanupProfileAssets({
    pool: f.pool,
    assetDirectory: f.assetDirectory,
    backupDirectory: directory,
    now,
  });
  assert.deepEqual(receipt, { removed: 1, orphans: 1 });
  const { readdir } = await import("node:fs/promises");
  assert.deepEqual(
    (await readdir(f.assetDirectory)).sort(),
    [current.avatarId + ".png", fresh.id + ".png"].sort(),
  );
});
test("paired snapshot holds writer lock and a corrupted copied asset blocks restore verification", async (t) => {
  const { createProfileBackup } = await import("../dist/profile/backup.js");
  const f = await createProfileFixture(t),
    verify = await createDatabaseFixture(t),
    directory = await mkdtemp(join(tmpdir(), "bibi-profile-locked-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const a = await (await f.upload(pngImage(), 1)).json();
  let checked = false;
  await assert.rejects(
    createProfileBackup({
      pool: f.pool,
      database: f.dbConfig,
      verifyDatabase: verify.config.database,
      directory,
      assetDirectory: f.assetDirectory,
      releaseId: "c".repeat(40) + "-123",
      flavor: "mariadb",
      runTool: async (kind, args, io) => {
        await bridge(kind, args, io, runNativeTool);
        if (kind === "restore") {
          const blocked = await f.request(
            "/api/profile",
            "PATCH",
            { revision: a.revision, displayName: "must not commit" },
            f.user.accessToken,
          );
          assert.equal(blocked.status, 503);

          const c = await f.pool.getConnection();
          try {
            const [[row]] = await c.query(
              "SELECT GET_LOCK(CONCAT('bibi-profile-assets:',LEFT(SHA2(DATABASE(),256),32)),0) acquired",
            );
            assert.equal(row.acquired, 0);
            checked = true;
          } finally {
            c.release();
          }
          const { dirname } = await import("node:path");
          await writeFile(join(dirname(io.inputFile), "assets", a.avatarId + ".png"), "corrupted");
        }
      },
    }),
  );
  assert.equal(checked, true);
  const [[remaining]] = await verify.pool.query(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE()",
  );
  assert.equal(remaining.n, 0);
  const [[source]] = await f.pool.query("SELECT avatar_id FROM users WHERE id=?", [
    f.user.profile.id,
  ]);
  assert.equal(source.avatar_id, a.avatarId);
});
test(
  "paired backup rejects a referenced symlink without following it",
  { skip: process.platform === "win32" ? "POSIX symlink acceptance required in Linux CI" : false },
  async (t) => {
    const { createProfileBackup } = await import("../dist/profile/backup.js"),
      { rename, symlink } = await import("node:fs/promises");
    const f = await createProfileFixture(t),
      verify = await createDatabaseFixture(t),
      directory = await mkdtemp(join(tmpdir(), "bibi-profile-link-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const a = await (await f.upload(pngImage(), 1)).json(),
      path = join(f.assetDirectory, a.avatarId + ".png");
    await rename(path, path + ".original");
    await symlink(path + ".original", path);
    await assert.rejects(
      createProfileBackup({
        pool: f.pool,
        database: f.dbConfig,
        verifyDatabase: verify.config.database,
        directory,
        assetDirectory: f.assetDirectory,
        releaseId: "d".repeat(40) + "-123",
        flavor: "mariadb",
        runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
      }),
    );
  },
);

test("paired backup refuses a drifted pointer column before creating a receipt or invoking native tools", async (t) => {
  const { createProfileBackup } = await import("../dist/profile/backup.js");
  const { readdir } = await import("node:fs/promises");
  const f = await createProfileFixture(t),
    verify = await createDatabaseFixture(t),
    directory = await mkdtemp(join(tmpdir(), "bibi-profile-drift-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await f.upload(pngImage(), 1);
  await f.pool.query("ALTER TABLE users DROP COLUMN avatar_id");
  let calls = 0;
  await assert.rejects(
    createProfileBackup({
      pool: f.pool,
      database: f.dbConfig,
      verifyDatabase: verify.config.database,
      directory,
      assetDirectory: f.assetDirectory,
      releaseId: "e".repeat(40) + "-123",
      flavor: "mariadb",
      runTool: async (kind, args, io) => {
        calls++;
        await bridge(kind, args, io, runNativeTool);
      },
    }),
    /schema/i,
  );
  assert.equal(calls, 0);
  assert.equal((await readdir(directory)).length, 0);
  assert.equal((await readdir(f.assetDirectory)).length, 1);
});
test("cleanup refuses an incompatible profile ledger without deleting retired images or rows", async (t) => {
  const { cleanupProfileAssets } = await import("../dist/profile/backup.js");
  const { readdir } = await import("node:fs/promises");
  const f = await createProfileFixture(t),
    directory = await mkdtemp(join(tmpdir(), "bibi-profile-incompatible-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const a = await (await f.upload(pngImage(), 1)).json();
  await f.upload(pngImage(20, 20), a.revision);
  await f.pool.query("UPDATE profile_avatar_assets SET retired_at=? WHERE id=?", [
    "2020-01-01",
    a.avatarId,
  ]);
  await f.pool.query("UPDATE profile_schema_migrations SET version=2");
  await assert.rejects(
    cleanupProfileAssets({
      pool: f.pool,
      assetDirectory: f.assetDirectory,
      backupDirectory: directory,
      now: new Date(),
    }),
    /schema/i,
  );
  assert.equal((await readdir(f.assetDirectory)).length, 2);
  const [[row]] = await f.pool.query("SELECT COUNT(*) n FROM profile_avatar_assets");
  assert.equal(row.n, 2);
});

test("paired backup allows a genuinely empty pre-migration profile schema", async (t) => {
  const { createProfileBackup } = await import("../dist/profile/backup.js");
  const { createAuthFixture } = await import("./helpers/auth.mjs");
  const f = await createAuthFixture(t),
    verify = await createDatabaseFixture(t),
    directory = await mkdtemp(join(tmpdir(), "bibi-profile-initial-")),
    assetDirectory = await mkdtemp(join(tmpdir(), "bibi-profile-initial-assets-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.after(() => rm(assetDirectory, { recursive: true, force: true }));
  const receipt = await createProfileBackup({
    pool: f.pool,
    database: f.dbConfig,
    verifyDatabase: verify.config.database,
    directory,
    assetDirectory,
    releaseId: "f".repeat(40) + "-123",
    flavor: "mariadb",
    runTool: (kind, args, io) => bridge(kind, args, io, runNativeTool),
  });
  assert.equal(receipt.verified, true);
  assert.equal(receipt.assetCount, 0);
});
