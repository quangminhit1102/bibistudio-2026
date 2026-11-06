import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { legacyProfileBackend } from "./helpers/legacy-profile-backend.mjs";
import { seedIdentity } from "../dist/db/seed.js";
import { createAuthFixture } from "./helpers/auth.mjs";
import { serve } from "./helpers/http.mjs";
import { migrateProfiles, profileSchemaStatus } from "../dist/profile/schema.js";
const directory = resolve("backend/profile-migrations");

test("profile migration preserves identity schema4, credentials/roles and old compiled backend behavior", async (t) => {
  const f = await createAuthFixture(t);
  const [[before]] = await f.pool.query("SELECT * FROM users WHERE username='user01'");
  await migrateProfiles(f.pool, directory);
  await migrateProfiles(f.pool, directory);
  const status = await profileSchemaStatus(f.pool, directory);
  assert.equal(status.state, "complete");
  assert.equal(status.version, 1);
  const [[after]] = await f.pool.query("SELECT * FROM users WHERE id=?", [before.id]);
  for (const key of Object.keys(before)) assert.equal(after[key], before[key]);
  assert.equal(after.phone, null);
  assert.equal(after.avatar_id, null);
  const [[count]] = await f.pool.query("SELECT COUNT(*) n FROM schema_migrations");
  assert.equal(count.n, 4);
  await f.pool.query("UPDATE users SET phone='0392969000',avatar_id=? WHERE id=?", [
    "00000000-0000-4000-8000-000000000001",
    before.id,
  ]);
  await seedIdentity(f.pool, f.secrets);
  const { createApp } = await legacyProfileBackend(t);
  const base = await serve(
    t,
    createApp(
      { releaseId: "old", sourceSha: "old" },
      { db: f.pool, config: f.config, clock: f.clock },
    ),
  );
  assert.equal((await fetch(base + "/api/ready")).status, 200);
  const grant = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      Origin: f.config.allowedOrigins[0],
      "X-Bibi-Request": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username: "admin", password: f.secrets.masterPassword }),
  });
  assert.equal(grant.status, 200);
  const { accessToken } = await grant.json();
  assert.equal(
    (
      await fetch(base + "/api/accounts/" + before.id, {
        method: "PUT",
        headers: {
          Origin: f.config.allowedOrigins[0],
          "X-Bibi-Request": "1",
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessToken,
        },
        body: JSON.stringify({ revision: before.revision, displayName: "Tên từ backend cũ" }),
      })
    ).status,
    200,
  );
  const [[kept]] = await f.pool.query("SELECT phone,avatar_id FROM users WHERE id=?", [before.id]);
  assert.equal(kept.phone, "0392969000");
  assert.equal(kept.avatar_id, "00000000-0000-4000-8000-000000000001");
});

test("profile migration fails closed on checksum/dirty history and explicitly resumes recorded DDL", async (t) => {
  const f = await createAuthFixture(t);
  const get = f.pool.getConnection.bind(f.pool);
  let fail = true;
  f.pool.getConnection = async () => {
    const c = await get(),
      query = c.query.bind(c);
    c.query = async (sql, ...args) => {
      if (
        fail &&
        typeof sql === "string" &&
        sql.startsWith("ALTER TABLE users ADD COLUMN avatar_id")
      ) {
        fail = false;
        throw new Error("controlled DDL outage");
      }
      return query(sql, ...args);
    };
    return c;
  };
  await assert.rejects(migrateProfiles(f.pool, directory), /controlled/);
  assert.equal((await profileSchemaStatus(f.pool, directory)).state, "dirty");
  await assert.rejects(migrateProfiles(f.pool, directory), /Dirty/);
  await migrateProfiles(f.pool, directory, { resumeDirty: true });
  assert.equal((await profileSchemaStatus(f.pool, directory)).state, "complete");
  const changed = await mkdtemp(resolve(tmpdir(), "bibi-profile-sql-"));
  t.after(() => rm(changed, { recursive: true, force: true }));
  const sql = await readFile(directory + "/001_profiles.sql", "utf8");
  await writeFile(changed + "/001_profiles.sql", sql + "\n");
  assert.equal((await profileSchemaStatus(f.pool, changed)).state, "incompatible");
  await assert.rejects(migrateProfiles(f.pool, changed), /checksum/i);
  await f.pool.query(
    "INSERT INTO profile_schema_migrations(version,checksum,state,completed_steps,ddl_hashes) VALUES(2,?,'complete',0,'{}')",
    ["f".repeat(64)],
  );
  assert.equal((await profileSchemaStatus(f.pool, directory)).state, "incompatible");
  await assert.rejects(migrateProfiles(f.pool, directory), /history/i);
});

test("legacy rollback fixture builds from pinned git history without a local artifact", async (t) => {
  const f = await createAuthFixture(t);
  await migrateProfiles(f.pool, directory);
  const { createApp } = await legacyProfileBackend(t, { fresh: true });
  const base = await serve(
    t,
    createApp(
      { releaseId: "pinned", sourceSha: "pinned" },
      { db: f.pool, config: f.config, clock: f.clock },
    ),
  );
  assert.equal((await fetch(base + "/api/ready")).status, 200);
});
