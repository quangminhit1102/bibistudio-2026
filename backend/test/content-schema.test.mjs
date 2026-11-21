import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createDatabaseFixture } from "./helpers/database.mjs";
import { contentSchemaStatus } from "../dist/content/schema.js";

const directory = resolve("backend/content-migrations");

test("content schema reports empty before migration", async (t) => {
  const f = await createDatabaseFixture(t);
  const status = await contentSchemaStatus(f.pool, directory);
  assert.equal(status.state, "empty");
  assert.equal(status.version, 8);
  assert.deepEqual(status.migrationChecksums, {});
});

test("content schema reports dirty when only some tables exist", async (t) => {
  const f = await createDatabaseFixture(t);
  await f.pool.query(
    "CREATE TABLE customers (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, kind VARCHAR(16) NOT NULL) ENGINE=InnoDB",
  );
  const status = await contentSchemaStatus(f.pool, directory);
  assert.equal(status.state, "dirty");
  assert.equal(status.version, 8);
});
