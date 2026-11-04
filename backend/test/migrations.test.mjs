import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabaseFixture } from "./helpers/database.mjs";

const directory = fileURLToPath(new URL("../migrations", import.meta.url));
const migrationModule = new URL("../dist/db/migrate.js", import.meta.url);

test("empty real database migrates all identity/session/analytics tables and repeated migration is no-op", async (t) => {
  const { pool } = await createDatabaseFixture(t);
  const { migrate } = await import(migrationModule);
  const first = await migrate(pool, directory);
  assert.equal(first.version, 4);
  const [rows] = await pool.query("SHOW TABLES");
  const tables = rows.map((row) => Object.values(row)[0]);
  for (const name of [
    "users",
    "roles",
    "permissions",
    "user_roles",
    "role_permissions",
    "refresh_token_sessions",
    "refresh_tokens",
    "audit_logs",
    "visitors",
    "visitor_sessions",
    "visitor_session_pages",
    "visitor_viewed_products",
    "rate_limit_counters",
    "release_probes",
  ])
    assert.ok(tables.includes(name), name);
  assert.deepEqual(await migrate(pool, directory), { version: 4, applied: [] });
  await pool.execute(
    "INSERT INTO users (id,username,display_name,password_hash) VALUES ('u','test','Test','hash')",
  );
  await pool.execute("INSERT INTO roles (id,name) VALUES ('r1','Role1'),('r2','Role2')");
  await pool.execute("INSERT INTO user_roles (user_id,role_id) VALUES ('u','r1'),('u','r2')");
  await assert.rejects(
    pool.execute("INSERT INTO user_roles (user_id,role_id) VALUES ('u','missing')"),
    /foreign key/i,
  );
});

test("migration checksum change and dirty unknown DDL fail closed", async (t) => {
  const { pool } = await createDatabaseFixture(t);
  const { migrate } = await import(migrationModule);
  await migrate(pool, directory);
  const copy = await mkdtemp(join(tmpdir(), "bibi-migrations-"));
  t.after(() => rm(copy, { recursive: true, force: true }));
  await cp(directory, copy, { recursive: true });
  const file = join(copy, "001_identity.sql");
  await writeFile(file, (await readFile(file, "utf8")) + "\n-- changed\n");
  await assert.rejects(migrate(pool, copy), /checksum/i);
  await pool.execute("UPDATE schema_migrations SET state='dirty' WHERE version=1");
  await assert.rejects(migrate(pool, directory), /dirty/i);
});

test("identity seed stores hashes, allows multiple roles and never overwrites existing edited seed accounts", async (t) => {
  const { pool } = await createDatabaseFixture(t);
  const { migrate } = await import(migrationModule);
  const { seedIdentity } = await import("../dist/db/seed.js");
  await migrate(pool, directory);
  const secrets = { masterPassword: "Only-test-Master!98", userPassword: "Only-test-User!87" };
  await seedIdentity(pool, secrets);
  const [before] = await pool.query(
    "SELECT id,username,password_hash,is_master FROM users ORDER BY username",
  );
  assert.deepEqual(
    before.map((u) => u.username),
    ["admin", "user01"],
  );
  assert.equal(before[0].is_master, 1);
  for (const user of before) assert.match(user.password_hash, /^\$2[aby]\$12\$/);
  await pool.execute("UPDATE users SET active=0,display_name='Changed' WHERE username='user01'");
  await seedIdentity(pool, {
    masterPassword: "different-test!98",
    userPassword: "different-test!87",
  });
  const [after] = await pool.query(
    "SELECT id,username,password_hash,is_master FROM users ORDER BY username",
  );
  assert.deepEqual(after, before);
  const [[user]] = await pool.query(
    "SELECT active,display_name FROM users WHERE username='user01'",
  );
  assert.equal(user.active, 0);
  assert.equal(user.display_name, "Changed");
  const [permissions] = await pool.query(
    "SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN roles r ON r.id=rp.role_id WHERE r.id='system-user'",
  );
  assert.deepEqual(
    permissions.map((p) => p.code),
    ["customer_access.view"],
  );
  const [[count]] = await pool.query("SELECT COUNT(*) n FROM visitors");
  assert.equal(count.n, 0);
});

test("explicit recovery verifies completed DDL before completing a known dirty migration", async (t) => {
  const { pool } = await createDatabaseFixture(t);
  const { migrate } = await import(migrationModule);
  await migrate(pool, directory);
  await pool.execute("UPDATE schema_migrations SET state='dirty' WHERE version=4");
  assert.equal((await migrate(pool, directory, { resumeDirty: true })).version, 4);
  await pool.execute("ALTER TABLE release_probes ADD unexpected_column INT NULL");
  await pool.execute("UPDATE schema_migrations SET state='dirty' WHERE version=4");
  await assert.rejects(migrate(pool, directory, { resumeDirty: true }), /DDL verification/i);
  const [[state]] = await pool.query("SELECT state FROM schema_migrations WHERE version=4");
  assert.equal(state.state, "dirty");
});

test("failed DDL stays dirty and explicit recovery resumes only recorded completed steps", async (t) => {
  const { pool } = await createDatabaseFixture(t);
  const { migrate } = await import(migrationModule);
  await pool.query("CREATE TABLE roles (obstruction INT) ENGINE=InnoDB");
  await assert.rejects(migrate(pool, directory), /already exists/i);
  const [[record]] = await pool.query(
    "SELECT state,completed_steps FROM schema_migrations WHERE version=1",
  );
  assert.equal(record.state, "dirty");
  assert.equal(record.completed_steps, 1);
  await assert.rejects(migrate(pool, directory), /dirty/i);
  await pool.query("DROP TABLE roles");
  assert.equal((await migrate(pool, directory, { resumeDirty: true })).version, 4);
});
