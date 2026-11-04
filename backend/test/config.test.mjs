import test from "node:test";
import assert from "node:assert/strict";

test("DB config fails closed and bounds pool, port and database identifiers", async () => {
  const { readDbConfig } = await import("../dist/config.js");
  assert.throws(() => readDbConfig({}), /configuration/i);
  const env = {
    DB_HOST: "127.0.0.1",
    DB_NAME: "bibi_local",
    DB_USER: "runtime",
    DB_PASSWORD: "test-only",
  };
  assert.equal(readDbConfig(env).connectionLimit, 5);
  assert.equal(readDbConfig(env).port, 3306);
  for (const patch of [
    { DB_PORT: "0" },
    { DB_POOL_LIMIT: "10000" },
    { DB_NAME: "bad;sql" },
    { DB_PASSWORD: "" },
  ])
    assert.throws(() => readDbConfig({ ...env, ...patch }), /configuration/i);
  assert.equal(readDbConfig({ ...env, DB_POOL_LIMIT: "2" }).connectionLimit, 2);
});

test("runtime pool uses UTC and parameterized transaction rolls back a failed write", async (t) => {
  const { createDatabaseFixture } = await import("./helpers/database.mjs");
  const { createDbPool } = await import("../dist/db/pool.js");
  const { withTransaction } = await import("../dist/db/transaction.js");
  const { config } = await createDatabaseFixture(t);
  const pool = createDbPool({ ...config, connectionLimit: 2 });
  t.after(() => pool.end());
  await pool.query("CREATE TABLE rollback_example (id INT PRIMARY KEY) ENGINE=InnoDB");
  await assert.rejects(
    withTransaction(pool, async (conn) => {
      await conn.execute("INSERT INTO rollback_example(id) VALUES (?)", [1]);
      throw new Error("test rollback");
    }),
    /test rollback/,
  );
  const [[count]] = await pool.query("SELECT COUNT(*) n FROM rollback_example");
  assert.equal(count.n, 0);
  const [[zone]] = await pool.query("SELECT @@session.time_zone zone");
  assert.equal(zone.zone, "+00:00");
});
